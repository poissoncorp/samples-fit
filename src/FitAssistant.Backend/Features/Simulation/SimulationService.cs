using FitAssistant.Backend.Features.HealthData;
using Raven.Client.Documents;
using FitAssistant.Backend.Features.Users;

namespace FitAssistant.Backend.Features.Simulation;

public class SimulationService
{
    private readonly IDocumentStore _store;
    private readonly Random _rng = new();

    public SimulationService(IDocumentStore store) => _store = store;

    public async Task<int?> AppendWearableSyncAsync(string userId)
    {
        using var session = _store.OpenAsyncSession();
        var user = await session.LoadAsync<UserProfile>(userId);
        if (user == null) return null;

        var tsf = session.TimeSeriesFor(userId, Constants.TimeSeries.HeartRates);
        var now = DateTime.UtcNow;
        var pointsAdded = 0;
        for (var i = 30; i >= 0; i -= 5)
        {
            tsf.Append(now.AddMinutes(-i), 65 + _rng.NextDouble() * 20);
            pointsAdded++;
        }
        await session.SaveChangesAsync();
        return pointsAdded;
    }

    public record MealResult(string Description, int Calories);

    public async Task<MealResult?> LogMealAsync(string userId, double level, DateTime? date)
    {
        level = Math.Clamp(level, 0.0, 1.0);
        var targetDate = date?.Date ?? DateTime.UtcNow.Date;

        using var session = _store.OpenAsyncSession();
        var user = await session.LoadAsync<UserProfile>(userId);
        if (user == null) return null;

        var (description, calories) = PickMeal(level);
        var actualCalories = calories + _rng.Next(-25, 25);
        var hour = targetDate == DateTime.UtcNow.Date ? DateTime.UtcNow.Hour : _rng.Next(7, 21);
        var timestamp = targetDate.AddHours(hour).AddMinutes(_rng.Next(0, 59));

        await session.StoreAsync(new FoodEntry
        {
            UserProfileId = userId,
            Timestamp     = timestamp,
            Description   = description,
            Calories      = actualCalories,
        });
        await session.SaveChangesAsync();

        return new(description, actualCalories);
    }

    public record CompletedExerciseResult(string Type, int DurationMinutes, int Calories);

    public async Task<CompletedExerciseResult?> LogCompletedExerciseAsync(string userId, DateTime? date)
    {
        var targetDate = date?.Date ?? DateTime.UtcNow.Date;

        using var session = _store.OpenAsyncSession();
        var user = await session.LoadAsync<UserProfile>(userId);
        if (user == null) return null;

        var pick = PickExercise();
        var calories = pick.Calories + _rng.Next(-30, 30);

        DateTime startTime;
        if (targetDate == DateTime.UtcNow.Date)
        {
            var minutesSinceFinish = _rng.Next(0, 60);
            startTime = DateTime.UtcNow.AddMinutes(-(pick.Duration + minutesSinceFinish));
        }
        else
        {
            startTime = targetDate.AddHours(_rng.Next(6, 19)).AddMinutes(_rng.Next(0, 30));
        }

        await session.StoreAsync(new ExerciseSession
        {
            UserProfileId  = userId,
            Type           = pick.Type,
            StartTime      = startTime,
            EndTime        = startTime.AddMinutes(pick.Duration),
            CaloriesBurned = calories,
        });

        var hrTsf = session.TimeSeriesFor(userId, Constants.TimeSeries.HeartRates);
        for (var min = 0; min < pick.Duration; min += 5)
            hrTsf.Append(startTime.AddMinutes(min), pick.HrBase + _rng.Next(-10, 15));

        await session.SaveChangesAsync();
        return new(pick.Type, pick.Duration, calories);
    }

    public async Task<string?> StartActiveExerciseAsync(string userId)
    {
        using var session = _store.OpenAsyncSession();
        var user = await session.LoadAsync<UserProfile>(userId);
        if (user == null) return null;

        var pick = PickExercise();
        await session.StoreAsync(new ExerciseSession
        {
            UserProfileId  = userId,
            Type           = pick.Type,
            StartTime      = DateTime.UtcNow,
            EndTime        = null,
            CaloriesBurned = 0,
        });
        await session.SaveChangesAsync();
        return $"Started a {pick.Type.ToLower()} session";
    }

    public async Task<string?> ExtendActiveExerciseAsync(string exerciseId, int minutes)
    {
        minutes = Math.Clamp(minutes, 1, 240);

        using var session = _store.OpenAsyncSession();
        var ex = await session.LoadAsync<ExerciseSession>(exerciseId);
        if (ex == null) return null;

        ex.StartTime = ex.StartTime.AddMinutes(-minutes);
        ex.CaloriesBurned += minutes * 7;
        await session.SaveChangesAsync();

        var elapsed = Math.Max(1, (int)Math.Round((DateTime.UtcNow - ex.StartTime).TotalMinutes));
        return $"+{minutes}m elapsed — total {elapsed}m so far.";
    }

    public async Task<string?> FinishActiveExerciseAsync(string exerciseId)
    {
        using var session = _store.OpenAsyncSession();
        var ex = await session.LoadAsync<ExerciseSession>(exerciseId);
        if (ex == null) return null;

        var now = DateTime.UtcNow;
        ex.EndTime = now;
        await session.SaveChangesAsync();

        var minutes = Math.Max(1, (int)Math.Round((now - ex.StartTime).TotalMinutes));
        return $"Finished — {minutes} min, {ex.CaloriesBurned} cal logged.";
    }

    private (string Description, int Calories) PickMeal(double level)
    {
        var pool = level <= 0.3 ? LightMeals : level <= 0.6 ? NormalMeals : FeastMeals;
        return pool[_rng.Next(pool.Length)];
    }

    private record ExercisePick(string Type, int Duration, int Calories, int HrBase);

    private ExercisePick PickExercise() => Exercises[_rng.Next(Exercises.Length)];

    private static readonly (string, int)[] LightMeals =
    [
        ("Apple with almond butter",  190),
        ("Greek yogurt",              150),
        ("Small side salad",          120),
        ("Rice cake with avocado",    160),
    ];

    private static readonly (string, int)[] NormalMeals =
    [
        ("Grilled chicken salad",            480),
        ("Turkey sandwich on whole wheat",   520),
        ("Salmon with roasted vegetables",   620),
        ("Oatmeal with berries",             340),
        ("Protein shake with banana",        280),
    ];

    private static readonly (string, int)[] FeastMeals =
    [
        ("Double cheeseburger with fries",       920),
        ("Large pepperoni pizza (4 slices)",     1120),
        ("Pasta carbonara with garlic bread",    980),
        ("Ice cream sundae",                     580),
        ("Nachos with cheese and guacamole",     860),
    ];

    private static readonly ExercisePick[] Exercises =
    [
        new("Running",           35, 310, 148),
        new("Cycling",           45, 380, 135),
        new("HIIT",              25, 290, 155),
        new("Strength Training", 50, 280, 120),
        new("Swimming",          40, 350, 130),
        new("Yoga",              30,  90,  85),
    ];
}
