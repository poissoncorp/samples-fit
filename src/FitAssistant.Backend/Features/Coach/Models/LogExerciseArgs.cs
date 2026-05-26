namespace FitAssistant.Backend.Features.Coach.Models;

public class LogExerciseArgs
{
    public string Type { get; set; } = "";
    public int DurationMinutes { get; set; }
    public int CaloriesBurned { get; set; }
}
