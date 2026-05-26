using System.Text.Json.Serialization;

namespace FitAssistant.FitFeed.Models;

/// <summary>
/// Closed set of feed entries. STJ writes the <c>kind</c> discriminator on
/// serialize, so the wire stays flat-with-discriminator (matches the
/// frontend's <c>FeedItem</c> union without any extra plumbing).
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(WorkoutFeedItem),     "workout")]
[JsonDerivedType(typeof(AchievementFeedItem), "achievement")]
[JsonDerivedType(typeof(GoalFeedItem),        "goal")]
public abstract class FeedItem
{
    public required string Id           { get; init; }
    public required string ViewerUserId { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}

public sealed class WorkoutFeedItem : FeedItem
{
    public required string ActorUserId     { get; init; }
    public required string ExerciseType    { get; init; }
    public required int    DurationMinutes { get; init; }
    public required int    CaloriesBurned  { get; init; }
}

public sealed class AchievementFeedItem : FeedItem
{
    public required string Title  { get; init; }
    public required string Detail { get; init; }
    public required string Icon   { get; init; }
}

public sealed class GoalFeedItem : FeedItem
{
    public required string ActorUserId { get; init; }
    public required string Title       { get; init; }
    public required string Detail      { get; init; }
}
