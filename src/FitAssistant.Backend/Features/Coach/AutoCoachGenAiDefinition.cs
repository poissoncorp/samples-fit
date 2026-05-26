using System.Text.Json;

namespace FitAssistant.Backend.Features.Coach;

internal static class AutoCoachGenAiDefinition
{
    public const string TransformScript = """
if (!this.EndTime) return;
var user = load(this.UserProfileId);
if (!user || user.IsPremium !== true) return;
if (this.CoachNote) return;

var contextObj = {
    UserName: user.Name,
    FitnessGoal: user.FitnessGoal,
    Session: {
        Type: this.Type,
        DurationMinutes: Math.round((new Date(this.EndTime).getTime() - new Date(this.StartTime).getTime()) / 60000),
        CaloriesBurned: this.CaloriesBurned
    }
};

ai.genContext({ Context: JSON.stringify(contextObj) });
""";

    public const string UpdateScript = "this.CoachNote = $output.Note;";

    public static string SampleOutput() => JsonSerializer.Serialize(new
    {
        Note = "Solid 40-minute cycling block — that's the longest endurance session of your week so far."
    });
}
