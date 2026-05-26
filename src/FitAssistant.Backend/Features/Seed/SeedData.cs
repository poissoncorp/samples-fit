using Raven.Client.Documents;
using Raven.Client.Documents.Operations;
using Raven.Client.Documents.Queries;
using Raven.Client.Documents.Session;
using FitAssistant.Backend.Features.HealthData;
using FitAssistant.Backend.Features.Users;

namespace FitAssistant.Backend.Features.Seed;

public static class SeedData
{
    private static readonly Random Rng = new(42);

    public static async Task SeedAllAsync(IDocumentStore store)
    {
        using (var session = store.OpenAsyncSession())
        {
            var existing = await session.Query<UserProfile>().ToListAsync();
            foreach (var user in SeedManifest.Users)
            {
                var match = existing.FirstOrDefault(u => u.Name == user.Name);
                if (match is not null) user.Id = match.Id;
                else await session.StoreAsync(user);
            }
            await session.SaveChangesAsync();
        }

        using (var refreshSession = store.OpenAsyncSession())
        {
            var allUsers = await refreshSession.Query<UserProfile>().ToListAsync();
            foreach (var user in allUsers)
                refreshSession.Advanced.GetMetadataFor(user)["@refresh"] =
                    DateTime.UtcNow.AddSeconds(5).ToString("o");
            await refreshSession.SaveChangesAsync();
        }

        await WipePerUserDataAsync(store);
        await SeedFriendGraphAsync(store);
        foreach (var user in SeedManifest.Users)
            await SeedUserDataAsync(store, user.Id!);
    }

    private static async Task WipePerUserDataAsync(IDocumentStore store)
    {
        var exOp = await store.Operations.SendAsync(new DeleteByQueryOperation(new IndexQuery { Query = "from ExerciseSessions" }));
        var foOp = await store.Operations.SendAsync(new DeleteByQueryOperation(new IndexQuery { Query = "from FoodEntries" }));
        await exOp.WaitForCompletionAsync();
        await foOp.WaitForCompletionAsync();

        using var session = store.OpenAsyncSession();
        foreach (var user in SeedManifest.Users)
        {
            if (user.Id is null) continue;
            session.TimeSeriesFor(user.Id, Constants.TimeSeries.HeartRates).Delete();
        }
        await session.SaveChangesAsync();
    }

    private static async Task SeedFriendGraphAsync(IDocumentStore store)
    {
        var byName = SeedManifest.Users.ToDictionary(u => u.Name, u => u.Id!);
        var followsByUser = SeedManifest.FriendGraph
            .GroupBy(e => byName[e.Follower])
            .ToDictionary(g => g.Key, g => g.Select(e => byName[e.Followed]).ToList());

        using var session = store.OpenAsyncSession();
        foreach (var user in SeedManifest.Users)
        {
            var profile = await session.LoadAsync<UserProfile>(user.Id!);
            if (profile is null) continue;
            profile.Follows = followsByUser.GetValueOrDefault(user.Id!, new List<string>());
        }
        await session.SaveChangesAsync();
    }

    public static async Task SeedUserDataAsync(IDocumentStore store, string userId)
    {
        var now = DateTime.UtcNow;
        await SeedHeartRateAsync(store, userId, now.AddDays(-30), now);
        await SeedExercisesAsync(store, userId, now.AddDays(-90), now);
        await SeedFoodEntriesAsync(store, userId, now.AddDays(-60), now);
    }

    private static async Task SeedHeartRateAsync(IDocumentStore store, string userId, DateTime from, DateTime to)
    {
        using var session = store.OpenAsyncSession();
        var tsf = session.TimeSeriesFor(userId, Constants.TimeSeries.HeartRates);
        var recentWindowStart = to.Date.AddDays(-7);

        for (var current = from; current < to; current = current.AddMinutes(5))
        {
            var hour = current.Hour;
            double baseBpm = hour is >= 23 or < 6 ? 55 + Rng.NextDouble() * 10   // Sleep
                           : hour is >= 6 and < 8 ? 65 + Rng.NextDouble() * 10   // Morning
                           :                        68 + Rng.NextDouble() * 15;  // Daytime

            if (Rng.NextDouble() < 0.03) baseBpm += 15 + Rng.NextDouble() * 20;

            // Day-specific imperfections in the recent week.
            if (current >= recentWindowStart)
            {
                var dayOfRecentWeek = (current - recentWindowStart).Days;
                if (dayOfRecentWeek == 2 && hour >= 22)              baseBpm += 8; // Cheat day late night
                if (dayOfRecentWeek == 5 && hour is >= 6 and < 10)   baseBpm += 6; // Overtraining elevated AM
            }

            tsf.Append(current, baseBpm);
        }

        await session.SaveChangesAsync();
    }

    private static async Task SeedExercisesAsync(IDocumentStore store, string userId, DateTime from, DateTime to)
    {
        using var session = store.OpenAsyncSession();
        var recentWindowStart = to.Date.AddDays(-7);

        for (var day = from.Date; day < recentWindowStart; day = day.AddDays(1))
        {
            var isWeekend = day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            if (Rng.NextDouble() >= (isWeekend ? 0.45 : 0.60)) continue;

            var t = SeedManifest.BackgroundExercises[Rng.Next(SeedManifest.BackgroundExercises.Length)];
            var duration = Rng.Next(t.DurMin, t.DurMax + 1);
            var startTime = day.AddHours(7 + Rng.Next(0, 12)).AddMinutes(Rng.Next(0, 60));

            await session.StoreAsync(new ExerciseSession
            {
                UserProfileId  = userId,
                Type           = t.Type,
                StartTime      = startTime,
                EndTime        = startTime.AddMinutes(duration),
                CaloriesBurned = Rng.Next(t.CalMin, t.CalMax + 1),
            });
        }

        // Hand-tuned recent week — drives the dashboard storytelling. HR
        // baseline per type keeps the workout's TS noise centered on its
        // expected zone.
        var hrTsf = session.TimeSeriesFor(userId, Constants.TimeSeries.HeartRates);
        var hrBaseByType = SeedManifest.BackgroundExercises
            .ToDictionary(b => b.Type, b => (b.HrMin + b.HrMax) / 2);

        foreach (var (day, type, duration, calories) in SeedManifest.RecentWeekStory)
        {
            if (type == "Rest Day") continue;

            var startTime = recentWindowStart.AddDays(day).AddHours(7 + Rng.Next(0, 4));
            await session.StoreAsync(new ExerciseSession
            {
                UserProfileId  = userId,
                Type           = type,
                StartTime      = startTime,
                EndTime        = startTime.AddMinutes(duration),
                CaloriesBurned = calories + Rng.Next(-20, 20),
            });

            var hrBase = hrBaseByType.GetValueOrDefault(type, 120);
            for (var min = 0; min < duration; min += 5)
                hrTsf.Append(startTime.AddMinutes(min), hrBase + Rng.Next(-10, 15));
        }

        await session.SaveChangesAsync();
    }

    private static async Task SeedFoodEntriesAsync(IDocumentStore store, string userId, DateTime from, DateTime to)
    {
        using var session = store.OpenAsyncSession();

        var totalDays         = (int)(to.Date - from.Date).TotalDays;
        var cheatDayAbs       = totalDays - 5;
        var skippedMealDayAbs = totalDays - 3;
        var meals             = SeedManifest.MealTemplates;

        for (var day = 0; day < totalDays; day++)
        {
            var date = from.AddDays(day);
            var todays = new List<(string Desc, int Cal, string Time)>();
            if (day != skippedMealDayAbs)       todays.Add(meals[Rng.Next(0, 2)]); // Breakfast
            todays.Add(meals[Rng.Next(2, 4)]);                                     // Lunch
            todays.Add(meals[Rng.Next(4, 6)]);                                     // Dinner
            if (Rng.NextDouble() > 0.4)         todays.Add(meals[Rng.Next(6, 9)]); // Snack
            if (day == cheatDayAbs)             todays.AddRange(SeedManifest.CheatMeals);

            foreach (var (desc, cal, time) in todays)
            {
                var parts = time.Split(':');
                var timestamp = date.AddHours(int.Parse(parts[0])).AddMinutes(int.Parse(parts[1]));
                await session.StoreAsync(new FoodEntry
                {
                    UserProfileId = userId,
                    Timestamp     = timestamp,
                    Description   = desc,
                    Calories      = cal + Rng.Next(-30, 30),
                });
            }
        }

        await session.SaveChangesAsync();
    }
}
