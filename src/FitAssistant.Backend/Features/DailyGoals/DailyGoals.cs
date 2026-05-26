using System.Text.Json.Serialization;

namespace FitAssistant.Backend.Features.DailyGoals;

public class DailyGoals
{
    public string? Id { get; set; }

    public required string UserProfileId { get; set; }

    public required string ForDate { get; set; }

    public string? Motivation { get; set; }

    public List<DailyGoalItem> Goals { get; set; } = new();

    public DateTime GeneratedAt { get; set; }
}

public class DailyGoalItem
{
    public required string Text { get; set; }

    public bool Fulfilled { get; set; }

    public GoalPredicate? Predicate { get; set; }
}

public class GoalPredicate
{
    public required GoalType Type { get; set; }

    public int Amount { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter<GoalType>))]
public enum GoalType
{
    [JsonStringEnumMemberName("BURN")]   Burn,
    [JsonStringEnumMemberName("INTAKE")] Intake,
}
