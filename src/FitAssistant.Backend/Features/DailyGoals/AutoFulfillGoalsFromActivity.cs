using Raven.Client.Documents;
using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using Raven.Client.Documents.Subscriptions;
using FitAssistant.Backend.Features.HealthData;

namespace FitAssistant.Backend.Features.DailyGoals;


public class AutoFulfillGoalsFromActivity(IDocumentStore store, ILogger<AutoFulfillGoalsFromActivity> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await EnsureSubscriptionExistsAsync<ExerciseSession>(
                Constants.Subscriptions.GoalAutoFulfillFromExercise, stoppingToken);
            await EnsureSubscriptionExistsAsync<FoodEntry>(
                Constants.Subscriptions.GoalAutoFulfillFromFood, stoppingToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not create goal auto-fulfillment subscriptions. Goals will only fulfill via UI toggle.");
            return;
        }

        await Task.WhenAll(
            RunLoopAsync<ExerciseSession>(
                Constants.Subscriptions.GoalAutoFulfillFromExercise,
                GoalType.Burn, e => e.UserProfileId, SumBurnedKcalAsync, stoppingToken),
            RunLoopAsync<FoodEntry>(
                Constants.Subscriptions.GoalAutoFulfillFromFood,
                GoalType.Intake, f => f.UserProfileId, SumIntakeKcalAsync, stoppingToken));
    }

    private async Task RunLoopAsync<T>(
        string subscriptionName,
        GoalType predicateType,
        Func<T, string> userIdOf,
        Func<IAsyncDocumentSession, string, DateTime, DateTime, CancellationToken, Task<int>> sumTodayKcalAsync,
        CancellationToken stoppingToken) where T : class
    {
        var opts = new SubscriptionWorkerOptions(subscriptionName)
        {
            Strategy            = SubscriptionOpeningStrategy.WaitForFree,
            MaxDocsPerBatch     = 16,
            CloseWhenNoDocsLeft = false,
        };

        while (!stoppingToken.IsCancellationRequested)
        {
            using var worker = store.Subscriptions.GetSubscriptionWorker<T>(opts);
            try
            {
                await worker.Run(async batch =>
                {
                    // One re-evaluation per touched user — a 3-row batch is one pass.
                    foreach (var userId in batch.Items.Select(i => userIdOf(i.Result)).Distinct())
                    {
                        try { await EvaluatePredicatesAsync(userId, predicateType, sumTodayKcalAsync, stoppingToken); }
                        catch (Exception ex)
                        {
                            logger.LogWarning(ex, "{Type} predicate evaluation failed for {UserId}.", predicateType, userId);
                        }
                    }
                }, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "{Sub} subscription dropped — reconnecting in 3s.", subscriptionName);
                await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            }
        }
    }

    private async Task EvaluatePredicatesAsync(
        string userProfileId,
        GoalType predicateType,
        Func<IAsyncDocumentSession, string, DateTime, DateTime, CancellationToken, Task<int>> sumTodayKcalAsync,
        CancellationToken ct)
    {
        var (today, dayStart, nextDayStart) = TodayWindowUtc();
        var docId = $"DailyGoals/{Constants.StripCollectionPrefix(userProfileId)}/{today}";

        using var session = store.OpenAsyncSession();
        var goals = await session.LoadAsync<DailyGoals>(docId, ct);
        if (goals == null) return;

        var candidates = goals.Goals
            .Where(g => !g.Fulfilled && g.Predicate?.Type == predicateType)
            .ToList();
        if (candidates.Count == 0) return;

        var totalKcal = await sumTodayKcalAsync(session, userProfileId, dayStart, nextDayStart, ct);

        var anyPatched = false;
        foreach (var goal in candidates)
        {
            if (totalKcal < goal.Predicate!.Amount) continue;
            goal.Fulfilled = true;
            anyPatched = true;
            logger.LogInformation(
                "Auto-fulfilled {Type} goal for {UserId} (today: {Kcal} >= target {Target}).",
                predicateType, userProfileId, totalKcal, goal.Predicate.Amount);
        }

        if (anyPatched) await session.SaveChangesAsync(ct);
    }

    private static async Task<int> SumBurnedKcalAsync(
        IAsyncDocumentSession session, string userId, DateTime from, DateTime to, CancellationToken ct)
    {
        var rows = await session.Query<ExerciseSession>()
            .Where(x => x.UserProfileId == userId
                     && x.StartTime >= from
                     && x.StartTime < to
                     && x.EndTime != null)
            .ToListAsync(ct);
        return rows.Sum(e => e.CaloriesBurned);
    }

    private static async Task<int> SumIntakeKcalAsync(
        IAsyncDocumentSession session, string userId, DateTime from, DateTime to, CancellationToken ct)
    {
        var rows = await session.Query<FoodEntry>()
            .Where(x => x.UserProfileId == userId
                     && x.Timestamp >= from
                     && x.Timestamp < to)
            .ToListAsync(ct);
        return rows.Sum(f => f.Calories);
    }

    private async Task EnsureSubscriptionExistsAsync<T>(string name, CancellationToken ct) where T : class
    {
        try
        {
            await store.Subscriptions.GetSubscriptionStateAsync(name, token: ct);
            return;
        }
        catch (Raven.Client.Exceptions.Documents.Subscriptions.SubscriptionDoesNotExistException)
        {
            // fall through
        }

        await store.Subscriptions.CreateAsync(
            new SubscriptionCreationOptions<T> { Name = name }, token: ct);
        logger.LogInformation("Subscription '{Name}' created.", name);
    }

    private static (string TodayKey, DateTime DayStart, DateTime NextDayStart) TodayWindowUtc()
    {
        var now      = DateTime.UtcNow;
        var dayStart = new DateTime(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);
        return (dayStart.ToString("yyyy-MM-dd"), dayStart, dayStart.AddDays(1));
    }
}
