namespace FitAssistant.Backend.Features.Coach.Models;

public class WorkoutExplanationDigest
{
    public string Type { get; set; } = "";
    public int Duration { get; set; }
    public int KcalBurned { get; set; }
    public RecentSimilarSession[] RecentSimilar { get; set; } = [];
    public string FitnessGoal { get; set; } = "";
}

public class RecentSimilarSession
{
    public string Type { get; set; } = "";
    public int Duration { get; set; }
    public int KcalBurned { get; set; }
    public string StartTime { get; set; } = "";
}
