using System.Text.Json;
using RabbitMQ.Client;
using Raven.Client.Documents;
using Raven.Client.Documents.Subscriptions;
using FitAssistant.Backend.Features.HealthData;
using FitAssistant.Backend.Features.PipelineTelemetry;
using FitAssistant.Backend.Features.SocialFeed;
using FitAssistant.Backend.Features.Users;

namespace FitAssistant.Backend.Features.DailyGoals;

public class FanOutFulfilledGoals : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly IConnection _rabbit;
    private readonly PipelineActivityBuffer _activity;
    private readonly ILogger<FanOutFulfilledGoals> _logger;

    public FanOutFulfilledGoals(
        IDocumentStore store,
        IConnection rabbit,
        PipelineActivityBuffer activity,
        ILogger<FanOutFulfilledGoals> logger)
    {
        _store    = store;
        _rabbit   = rabbit;
        _activity = activity;
        _logger   = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        IChannel channel;
        try
        {
            await EnsureSubscriptionExistsAsync(stoppingToken);
            channel = await ActivityFeedQueue.OpenChannelAsync(_rabbit, stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Goal-progress fan-out failed to start; broadcast disabled.");
            return;
        }

        await using (channel)
        {
            var workerOptions = new SubscriptionWorkerOptions(Constants.Subscriptions.GoalFulfilled)
            {
                Strategy            = SubscriptionOpeningStrategy.WaitForFree,
                MaxDocsPerBatch     = 16,
                CloseWhenNoDocsLeft = false,
            };

            while (!stoppingToken.IsCancellationRequested)
            {
                using var worker = _store.Subscriptions.GetSubscriptionWorker<DailyGoals>(workerOptions);
                try
                {
                    await worker.Run(async batch =>
                    {
                        foreach (var item in batch.Items)
                        {
                            var doc = item.Result;
                            var fulfilledCount = doc.Goals.Count(g => g.Fulfilled);
                            if (fulfilledCount == 0) continue;

                            await PublishGoalProgressAsync(channel, doc, fulfilledCount, doc.Goals.Count, stoppingToken);
                        }
                    }, stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "Goal-progress subscription dropped — reconnecting in 3s.");
                    await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
                }
            }
        }
    }

    private async Task PublishGoalProgressAsync(
        IChannel channel,
        DailyGoals doc,
        int fulfilledCount,
        int totalCount,
        CancellationToken ct)
    {
        using var session = _store.OpenAsyncSession();
        var actor = await session.LoadAsync<UserProfile>(doc.UserProfileId, ct);
        if (actor is null || actor.Follows.Count == 0) return;

        foreach (var friendId in actor.Follows)
        {
            // SessionId embeds the count tier so FitFeed dedupes per tier;
            // duplicate fires at the same count collapse, fresh tiers don't.
            var msg = new
            {
                kind            = "goal.progress",
                recipientUserId = friendId,
                actorUserId     = doc.UserProfileId,
                sessionId       = $"{doc.Id}/{fulfilledCount}",
                fulfilledCount  = fulfilledCount,
                totalCount      = totalCount,
            };
            await channel.BasicPublishAsync(
                exchange:   "",
                routingKey: Constants.Etl.ActivityFeedQueueName,
                body:       JsonSerializer.SerializeToUtf8Bytes(msg),
                cancellationToken: ct);
        }

        _activity.Record(
            "goal.progress",
            $"{Constants.StripCollectionPrefix(doc.UserProfileId)} hit {fulfilledCount}/{totalCount} goals (fanned to {actor.Follows.Count} friend(s))");
    }

    private async Task EnsureSubscriptionExistsAsync(CancellationToken ct)
    {
        try
        {
            await _store.Subscriptions.GetSubscriptionStateAsync(
                Constants.Subscriptions.GoalFulfilled, token: ct);
            return;
        }
        catch (Raven.Client.Exceptions.Documents.Subscriptions.SubscriptionDoesNotExistException)
        {
            // fall through to create
        }

        await _store.Subscriptions.CreateAsync(
            new SubscriptionCreationOptions<DailyGoals> { Name = Constants.Subscriptions.GoalFulfilled },
            token: ct);
        _logger.LogInformation("Subscription '{Name}' created.", Constants.Subscriptions.GoalFulfilled);
    }
}
