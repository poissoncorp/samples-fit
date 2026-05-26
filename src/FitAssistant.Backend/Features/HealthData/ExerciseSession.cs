namespace FitAssistant.Backend.Features.HealthData;

public class ExerciseSession
{
    public string? Id { get; set; }
    public required string UserProfileId { get; set; }
    public required string Type { get; set; }
    public DateTime StartTime { get; set; }

    public DateTime? EndTime { get; set; }
    public int CaloriesBurned { get; set; }

    public string? CoachNote { get; set; }
}
