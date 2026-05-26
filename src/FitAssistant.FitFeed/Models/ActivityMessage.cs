namespace FitAssistant.FitFeed.Models;


public class ActivityMessage
{
    public string? Kind { get; set; }

    public required string RecipientUserId { get; set; }
    public required string ActorUserId     { get; set; }
    public required string SessionId       { get; set; }

    public string?  Type            { get; set; }
    public int      DurationMinutes { get; set; }
    public int      CaloriesBurned  { get; set; }
    public DateTime StartTime       { get; set; }

    public int FulfilledCount { get; set; }
    public int TotalCount     { get; set; }
}
