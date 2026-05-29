using System.Text.Json;
using FitAssistant.Backend.Features.Coach.Models;
using FitAssistant.Backend.Features.HealthData;
using Raven.Client.Documents.Operations.AI.Agents;

namespace FitAssistant.Backend.Features.Coach;

internal static class CoachAgentDefinition
{
    public static List<AiAgentParameter> Parameters() =>
    [
        new AiAgentParameter("userId",
            "The ID of the current user profile document.",
            sendToModel: false,
            policy: AiAgentParameterPolicy.ForbidModelGeneration),
        new AiAgentParameter("isPremium",
            "Whether the current user is on the Fit Assistant Ultra tier.",
            sendToModel: true,
            policy: AiAgentParameterPolicy.ForbidModelGeneration)
    ];

    public static List<AiAgentToolQuery> UserScopedQueries() =>
    [
        new AiAgentToolQuery(
            "GetUserProfile",
            "Get the user's profile including name, age, weight, height, daily calorie goal, and fitness goal.",
            "from UserProfiles where id() == $userId")
        {
            ParametersSampleObject = "{}",
            Options = new AiAgentToolQueryOptions { AddToInitialContext = true }
        },
        new AiAgentToolQuery(
            "GetRecentExercises",
            "Get the user's recent exercise sessions.",
            "from ExerciseSessions where UserProfileId == $userId and StartTime >= $since order by StartTime desc")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new { since = "2026-03-27T00:00:00.0000000" })
        },
        new AiAgentToolQuery(
            "GetRecentHeartRate",
            "Get the user's heart rate time series data.",
            "from UserProfiles where id() == $userId select timeseries(from HeartRates between $from and $to)")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new { from = "2026-04-02T00:00:00.0000000", to = "2026-04-03T00:00:00.0000000" })
        },
        new AiAgentToolQuery(
            "GetKcalIntakeByDay",
            "Per-day kcal-intake totals from the KcalIntakeByUserDay map-reduce index.",
            "from index 'KcalIntakeByUserDay' where UserProfileId == $userId and Day >= $since order by Day desc")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new { since = "2026-03-27T00:00:00.0000000" })
        },
        new AiAgentToolQuery(
            "GetKcalBurnedByDay",
            "Per-day kcal-burned totals from the KcalBurnedByUserDay map-reduce index.",
            "from index 'KcalBurnedByUserDay' where UserProfileId == $userId and Day >= $since order by Day desc")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new { since = "2026-03-27T00:00:00.0000000" })
        },
        new AiAgentToolQuery(
            "GetFoodEntries",
            "Get the user's recent food log entries.",
            "from FoodEntries where UserProfileId == $userId and Timestamp >= $since order by Timestamp desc")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new { since = "2026-03-27T00:00:00.0000000" })
        }
    ];

    public static List<AiAgentToolQuery> ProfileOnlyQuery() =>
    [
        new AiAgentToolQuery(
            "GetUserProfile",
            "Returns the current user's profile (WeightKg, Birthday, FitnessGoal).",
            "from UserProfiles where id() == $userId")
        {
            ParametersSampleObject = "{}",
            Options = new AiAgentToolQueryOptions { AddToInitialContext = true }
        }
    ];

    public static List<AiAgentToolAction> Actions() =>
    [
        new AiAgentToolAction(
            "LogFoodEntry",
            "Log a new food entry for the user.")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new LogFoodEntryArgs
            {
                Description = "Grilled chicken salad with vinaigrette",
                Calories    = 450,
            })
        },
        new AiAgentToolAction(
            "LogExercise",
            "Log a new exercise session for the user.")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new LogExerciseArgs
            {
                Type = "Running",
                DurationMinutes = 30,
                CaloriesBurned = 300,
            })
        }
    ];

    public static List<AiAgentToolAction> FoodPhotoActions() =>
    [
        new AiAgentToolAction(
            "LogFoodEntry",
            "Log a new food entry for the user based on the analysed photo.")
        {
            ParametersSampleObject = JsonSerializer.Serialize(new LogFoodEntryArgs
            {
                Description = "Grilled chicken salad with vinaigrette",
                Calories    = 450,
            })
        }
    ];

    public static List<AiAgentToolSubAgent> SubAgents() =>
    [
        new AiAgentToolSubAgent
        {
            Identifier  = Constants.Agent.FoodPhotoSubAgentId,
            Description = "Use for food-photo turns. It estimates calories and logs a FoodEntry."
        },
        new AiAgentToolSubAgent
        {
            Identifier  = Constants.Agent.MotivateSubAgentId,
            Description = "Use for motivation. It returns a MotivateDigest; compose prose from digest values only."
        },
        new AiAgentToolSubAgent
        {
            Identifier  = Constants.Agent.ExplainWorkoutSubAgentId,
            Description = "Use when explaining a specific workout. Pass the exercise session id in the delegation prompt."
        },
        new AiAgentToolSubAgent
        {
            Identifier  = Constants.Agent.CalorieEstimatorSubAgentId,
            Description = "Use before LogExercise when the user provides exercise type/duration without calories burned."
        }
    ];

    public static AgentReply ParentSample() => new()
    {
        Answer = "Three sessions this week with your max HR climbing to 178 — that is the engine getting bigger, not luck.",
        Followups = ["How is my resting HR trending?", "Log my next workout"]
    };

    public static FoodCalorieReply FoodPhotoSample() => new()
    {
        Description = "Grilled chicken salad with vinaigrette",
        Calories = 450,
        IsFood = true
    };

    public static MotivateDigest MotivateSample() => new()
    {
        Workouts7d      = 4,
        TotalKcalBurned = 1850,
        AvgKcalIntake   = 1950,
        AvgHR           = 62,
        MaxHR           = 178,
        FitnessGoal     = "Improve cardio endurance",
        Patterns        = ["3-day streak", "resting HR trending down", "no recovery day in 6 days"]
    };

    public static WorkoutExplanationDigest ExplainWorkoutSample() => new()
    {
        Type        = "Cycling",
        Duration    = 45,
        KcalBurned  = 380,
        FitnessGoal = "Improve cardio endurance",
        RecentSimilar =
        [
            new RecentSimilarSession { Type = "Cycling", Duration = 30, KcalBurned = 250, StartTime = "2026-05-08T08:30:00Z" }
        ]
    };

    public static ExerciseCalorieReply CalorieEstimatorSample() => new()
    {
        CaloriesBurned = 320,
        Reasoning      = "30 min Running × ~11 kcal/min adjusted for 72 kg"
    };
}
