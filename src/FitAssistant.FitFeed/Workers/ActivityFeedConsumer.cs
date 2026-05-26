using System.Text;
using System.Text.Json;
using FitAssistant.FitFeed.Models;
using FitAssistant.FitFeed.Services;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace FitAssistant.FitFeed.Workers;

/// <summary>
/// Consumes the <c>activity_feed</c> RabbitMQ queue. Workouts land on
/// recipient feeds; achievements land on the actor's own feed.
/// </summary>
public class ActivityFeedConsumer : BackgroundService
{
    /// <summary>Lifetime acked-message count — surfaced via /api/stats for the HUD.</summary>
    public static long ConsumedMessages;

    private readonly IConnection _conn;
    private readonly FeedStore _store;
    private readonly PipelineEventBuffer _events;
    private readonly ILogger<ActivityFeedConsumer> _logger;
    private IChannel? _channel;

    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public ActivityFeedConsumer(IConnection conn, FeedStore store, PipelineEventBuffer events, ILogger<ActivityFeedConsumer> logger)
    {
        _conn   = conn;
        _store  = store;
        _events = events;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _channel = await _conn.CreateChannelAsync(cancellationToken: stoppingToken);

        await _channel.QueueDeclareAsync(
            queue:      "activity_feed",
            durable:    true,
            exclusive:  false,
            autoDelete: false,
            arguments:  null,
            cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += async (_, evt) =>
        {
            try
            {
                await HandleMessageAsync(evt, stoppingToken);
                await _channel.BasicAckAsync(evt.DeliveryTag, multiple: false, stoppingToken);
                Interlocked.Increment(ref ConsumedMessages);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process activity_feed message — nacking.");
                // requeue=false so a poison message doesn't loop. Sample-scope: no DLX wired.
                await _channel.BasicNackAsync(evt.DeliveryTag, multiple: false, requeue: false, stoppingToken);
            }
        };

        await _channel.BasicConsumeAsync(
            queue: "activity_feed",
            autoAck: false,
            consumer: consumer,
            cancellationToken: stoppingToken);

        _logger.LogInformation("ActivityFeedConsumer attached to RabbitMQ queue 'activity_feed'.");

        // RabbitMQ.Client owns the dispatch loop on its own threads — just hold.
        try { await Task.Delay(Timeout.Infinite, stoppingToken); }
        catch (OperationCanceledException) { /* host shutdown */ }
    }

    private async Task HandleMessageAsync(BasicDeliverEventArgs evt, CancellationToken ct)
    {
        var body = Encoding.UTF8.GetString(evt.Body.Span);
        var msg = JsonSerializer.Deserialize<ActivityMessage>(body, Json);
        if (msg is null)
        {
            _logger.LogWarning("Dropping unparsable activity_feed message: {Body}", body);
            return;
        }

        if (msg.Kind == "goal.progress")
            await HandleGoalProgressAsync(msg, ct);
        else
            await HandleWorkoutAsync(msg, ct);
    }

    private async Task HandleWorkoutAsync(ActivityMessage msg, CancellationToken ct)
    {
        await _store.AddItemAsync(new WorkoutFeedItem
        {
            Id              = $"workout/{msg.SessionId}/{msg.RecipientUserId}",
            ViewerUserId    = msg.RecipientUserId,
            ActorUserId     = msg.ActorUserId,
            ExerciseType    = msg.Type ?? "workout",
            DurationMinutes = msg.DurationMinutes,
            CaloriesBurned  = msg.CaloriesBurned,
            CreatedAt       = msg.StartTime,
        }, ct);
        _events.Record("feed.deliver",
            $"{Strip(msg.ActorUserId)} -> {Strip(msg.RecipientUserId)} | {msg.Type ?? "workout"} {msg.DurationMinutes}m / {msg.CaloriesBurned} cal");

        // ETL fan-out sends one copy per friend; the actor's achievement state
        // must only advance once. First message to claim the sessionId wins.
        if (await _store.TryClaimSessionAsync(msg.SessionId))
        {
            var prior  = await _store.GetAchievementsAsync(msg.ActorUserId);
            var result = AchievementEngine.Apply(msg.ActorUserId, prior, msg);
            await _store.SaveAchievementsAsync(msg.ActorUserId, result.NewState);

            foreach (var ach in result.NewAchievements)
            {
                await _store.AddItemAsync(ach, ct);
                _events.Record("achievement.unlock",
                    $"{Strip(msg.ActorUserId)}: {ach.Title} -- {ach.Detail}");
            }
        }
    }

    // Goal-progress deliveries from FanOutFulfilledGoals — one message per
    // (count-tier × friend). SessionId embeds the tier so the same count
    // collapses on Id, each fresh tier lands as a new entry.
    private async Task HandleGoalProgressAsync(ActivityMessage msg, CancellationToken ct)
    {
        await _store.AddItemAsync(new GoalFeedItem
        {
            Id           = $"goal/{msg.SessionId}/{msg.RecipientUserId}",
            ViewerUserId = msg.RecipientUserId,
            ActorUserId  = msg.ActorUserId,
            Title        = "Daily goals",
            Detail       = $"completed {msg.FulfilledCount}/{msg.TotalCount} daily goals today",
            CreatedAt    = DateTime.UtcNow,
        }, ct);

        _events.Record("goal.progress",
            $"{Strip(msg.ActorUserId)} -> {Strip(msg.RecipientUserId)} | goals: {msg.FulfilledCount}/{msg.TotalCount}");
    }

    /// <summary>Strip the "UserProfiles/" collection prefix so events read tidily.</summary>
    private static string Strip(string id) =>
        id.Contains('/') ? id[(id.IndexOf('/') + 1)..] : id;
}
