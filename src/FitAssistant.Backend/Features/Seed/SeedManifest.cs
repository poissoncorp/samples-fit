using FitAssistant.Backend.Features.HealthData;
using FitAssistant.Backend.Features.Users;
namespace FitAssistant.Backend.Features.Seed;


internal static class SeedManifest
{
    public static readonly UserProfile[] Users =
    [
        new() { Name = "Alex Runner",    Birthday = "1997-04-12", WeightKg = 72, HeightCm = 175, DailyCalorieGoal = 2200, FitnessGoal = "Improve cardio endurance", IsPremium = true  },
        new() { Name = "Sam Lifter",     Birthday = "1993-08-21", WeightKg = 88, HeightCm = 182, DailyCalorieGoal = 2800, FitnessGoal = "Build muscle",              IsPremium = false },
        new() { Name = "Jordan Starter", Birthday = "1999-11-03", WeightKg = 95, HeightCm = 170, DailyCalorieGoal = 1800, FitnessGoal = "Lose weight",               IsPremium = false },
        new() { Name = "Casey Balance",  Birthday = "1990-02-28", WeightKg = 68, HeightCm = 165, DailyCalorieGoal = 2000, FitnessGoal = "General health",            IsPremium = true  },
    ];

    public static readonly (string Follower, string Followed)[] FriendGraph =
    [
        ("Alex Runner",    "Sam Lifter"),
        ("Alex Runner",    "Jordan Starter"),
        ("Sam Lifter",     "Alex Runner"),
        ("Sam Lifter",     "Jordan Starter"),
        ("Jordan Starter", "Alex Runner"),
        ("Jordan Starter", "Sam Lifter"),
    ];

    public static readonly (string Type, int DurMin, int DurMax, int CalMin, int CalMax, int HrMin, int HrMax)[] BackgroundExercises =
    [
        ("Running",           25, 50, 220, 420, 130, 160),
        ("Cycling",           30, 70, 280, 520, 120, 155),
        ("Strength Training", 40, 75, 250, 380, 110, 145),
        ("HIIT",              20, 35, 240, 340, 145, 175),
        ("Yoga",              25, 45, 60,  130, 75,  105),
    ];


    public static readonly (int Day, string Type, int Duration, int Calories)[] RecentWeekStory =
    [
        (0, "Running",           45, 380),
        (1, "Strength Training", 60, 320),
        (2, "Rest Day",           0,   0),
        (3, "Running",           30, 260),
        (3, "Yoga",              30,  90),
        (4, "Cycling",           50, 420),
        (5, "HIIT",              25, 290),
        (5, "Running",           35, 310),
        (6, "Cycling",           40, 350),
    ];

    public static readonly (string Desc, int Cal, string Time)[] MealTemplates =
    [
        ("Oatmeal with berries",          350, "08:00"),
        ("Greek yogurt with granola",     280, "08:30"),
        ("Grilled chicken salad",         480, "12:30"),
        ("Turkey sandwich on whole wheat",520, "12:00"),
        ("Salmon with roasted vegetables",620, "19:00"),
        ("Pasta with marinara sauce",     680, "19:30"),
        ("Protein shake",                 220, "16:00"),
        ("Apple with almond butter",      190, "15:30"),
        ("Trail mix handful",             170, "10:30"),
    ];

    public static readonly (string Desc, int Cal, string Time)[] CheatMeals =
    [
        ("Large pepperoni pizza (4 slices)", 1120, "20:00"),
        ("Ice cream sundae",                  580, "21:30"),
        ("Beer (2 pints)",                    360, "19:00"),
    ];
}
