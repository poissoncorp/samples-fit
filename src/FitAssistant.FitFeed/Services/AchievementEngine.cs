using FitAssistant.FitFeed.Models;

namespace FitAssistant.FitFeed.Services;

public static class AchievementEngine
{
    public record Result(AchievementState NewState, List<AchievementFeedItem> NewAchievements);

    public static Result Apply(string viewerUserId, AchievementState prior, ActivityMessage msg)
    {
        var newAchievements = new List<AchievementFeedItem>();
        var state = new AchievementState
        {
            LastWorkoutDay     = prior.LastWorkoutDay,
            CurrentStreakDays  = prior.CurrentStreakDays,
            LongestStreakDays  = prior.LongestStreakDays,
            LifetimeWorkouts   = prior.LifetimeWorkouts + 1,
            LifetimeKcalBurned = prior.LifetimeKcalBurned + Math.Max(0, msg.CaloriesBurned),
        };

        var workoutDay = msg.StartTime.Date;
        if (prior.LastWorkoutDay is null)
        {
            state.CurrentStreakDays = 1;
        }
        else
        {
            var diff = (workoutDay - prior.LastWorkoutDay.Value.Date).Days;
            state.CurrentStreakDays = diff switch
            {
                0 => prior.CurrentStreakDays,
                1 => prior.CurrentStreakDays + 1,
                _ => 1
            };
        }
        state.LastWorkoutDay    = workoutDay;
        state.LongestStreakDays = Math.Max(prior.LongestStreakDays, state.CurrentStreakDays);

        if (state.CurrentStreakDays > prior.CurrentStreakDays &&
            state.CurrentStreakDays is 3 or 7 or 14 or 30)
        {
            newAchievements.Add(MakeAch(viewerUserId,
                title: $"{state.CurrentStreakDays}-day streak",
                detail: $"You've trained {state.CurrentStreakDays} days in a row.",
                icon: "🔥"));
        }

        if (state.Level > prior.Level)
        {
            newAchievements.Add(MakeAch(viewerUserId,
                title: $"Level {state.Level} unlocked",
                detail: $"{state.LifetimeKcalBurned:N0} kcal lifetime. Keep moving.",
                icon: "⚡"));
        }

        if (IsWorkoutMilestone(state.LifetimeWorkouts))
        {
            newAchievements.Add(MakeAch(viewerUserId,
                title: $"{state.LifetimeWorkouts} workouts logged",
                detail: $"Average kcal/session so far: ~{(state.LifetimeKcalBurned / Math.Max(1, state.LifetimeWorkouts)):N0}.",
                icon: "🏆"));
        }

        return new Result(state, newAchievements);
    }

    private static bool IsWorkoutMilestone(int count) =>
        count is 10 or 25 or 50 or 100 || (count > 100 && count % 50 == 0);

    private static AchievementFeedItem MakeAch(string viewerUserId, string title, string detail, string icon) =>
        new()
        {
            Id           = $"ach/{viewerUserId}/{Guid.NewGuid():N}",
            ViewerUserId = viewerUserId,
            Title        = title,
            Detail       = detail,
            Icon         = icon,
        };
}
