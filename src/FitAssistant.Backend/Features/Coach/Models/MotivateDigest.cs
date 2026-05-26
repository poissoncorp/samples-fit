namespace FitAssistant.Backend.Features.Coach.Models;


public class MotivateDigest
{
    public int Workouts7d { get; set; }
    public int TotalKcalBurned { get; set; }
    public int AvgKcalIntake { get; set; }
    public int AvgHR { get; set; }
    public int MaxHR { get; set; }
    public string FitnessGoal { get; set; } = "";
    public string[] Patterns { get; set; } = [];
}
