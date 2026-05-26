namespace FitAssistant.Backend.Features.Users;

public class UserProfile
{
    public string? Id { get; set; }
    public required string Name { get; set; }

    public required string Birthday { get; set; }

    public double WeightKg { get; set; }
    public int HeightCm { get; set; }
    public int DailyCalorieGoal { get; set; }
    public required string FitnessGoal { get; set; }

    public bool IsPremium { get; set; }

    public string Theme { get; set; } = "light";

    public List<string> Follows { get; set; } = new();
}
