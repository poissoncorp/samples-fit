namespace FitAssistant.FitFeed.Models;

public class AchievementState
{
    public DateTime? LastWorkoutDay { get; set; }
    public int CurrentStreakDays { get; set; }
    public int LongestStreakDays { get; set; }
    public int LifetimeWorkouts { get; set; }
    public long LifetimeKcalBurned { get; set; }

    public int Level => 1 + (int)(LifetimeKcalBurned / 5000);
}
