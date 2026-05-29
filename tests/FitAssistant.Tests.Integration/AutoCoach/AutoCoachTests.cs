using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.AutoCoach;


[Collection(AppHostCollection.Name)]
public sealed class AutoCoachTests(AppHostFixture app)
{
    [Fact]
    [Trait("phase", "A")]
    public async Task Free_user_exercise_does_not_get_a_coach_note()
    {
        var freeUserId = await TestData.CreateUser(app.BackendClient, isPremium: false);
        await TestData.LogCompletedExercise(app.BackendClient, freeUserId);

        // The transformation script's IsPremium gate bails immediately —
        // wait briefly to ensure no false positive, then verify CoachNote
        // stays unset on every exercise this user has.
        await Task.Delay(TimeSpan.FromSeconds(4));

        var body = await app.BackendClient
            .GetFromJsonAsync<JsonElement>($"/api/health/{Uri.EscapeDataString(freeUserId)}/exercises?range=24h");
        var exercises = body.GetProperty("exercises");
        exercises.GetArrayLength().Should().BeGreaterThan(0);

        foreach (var ex in exercises.EnumerateArray())
        {
            if (ex.TryGetProperty("CoachNote", out var note))
                note.ValueKind.Should().Be(JsonValueKind.Null);
        }
    }

    [SkippableFact]
    [Trait("phase", "B")]
    public async Task Ultra_user_exercise_gets_a_coach_note_when_ai_is_configured()
    {
        Skip.IfNot(app.HasOpenAiKey, "OPENAI_API_KEY not set — auto-coach Ultra path requires GenAI.");

        var ultraId = await TestData.CreateUser(app.BackendClient, isPremium: true);
        await TestData.LogCompletedExercise(app.BackendClient, ultraId);

        var note = await WaitForNote(ultraId, TimeSpan.FromSeconds(90));

        if (note is null)
        {
            // Build a self-describing failure message: dump the exercise
            // doc state + the most recent auto-coach trace docs so the
            // reader doesn't have to dig into Studio.
            var diag = await BuildDiagnosticsAsync(ultraId);
            note.Should().NotBeNullOrWhiteSpace(
                $"Ultra users should receive an auto-coach note within ~90s.\n\n" +
                $"--- Diagnostics ---\n{diag}");
        }
    }

    private async Task<string?> WaitForNote(string userId, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                var body = await app.BackendClient
                    .GetFromJsonAsync<JsonElement>($"/api/health/{Uri.EscapeDataString(userId)}/exercises?range=24h");
                var exercises = body.GetProperty("exercises");
                foreach (var ex in exercises.EnumerateArray())
                {
                    if (ex.TryGetProperty("CoachNote", out var n) &&
                        n.ValueKind == JsonValueKind.String)
                    {
                        var s = n.GetString();
                        if (!string.IsNullOrWhiteSpace(s)) return s;
                    }
                }
            }
            catch { /* transient, retry */ }
            await Task.Delay(750);
        }
        return null;
    }

    private async Task<string> BuildDiagnosticsAsync(string userId)
    {
        var sb = new System.Text.StringBuilder();

        try
        {
            var exercises = await app.BackendClient
                .GetFromJsonAsync<JsonElement>($"/api/health/{Uri.EscapeDataString(userId)}/exercises?range=24h");
            var arr = exercises.GetProperty("exercises");
            sb.AppendLine($"Exercises on test user: {arr.GetArrayLength()}");
            foreach (var ex in arr.EnumerateArray())
            {
                ex.TryGetProperty("id", out var id);
                ex.TryGetProperty("endTime", out var endTime);
                ex.TryGetProperty("coachNote", out var coachNote);
                ex.TryGetProperty("coachNoteAt", out var coachNoteAt);
                sb.AppendLine(
                    $"  - id={id} endTime={endTime} coachNote={coachNote} coachNoteAt={coachNoteAt}");
            }
        }
        catch (Exception ex)
        {
            sb.AppendLine($"(exercises fetch failed: {ex.Message})");
        }

        try
        {
            var diag = await app.BackendClient
                .GetFromJsonAsync<JsonElement>("/api/admin/genai-traces/auto-coach?limit=5");
            sb.AppendLine();
            sb.AppendLine("auto-coach task state:");
            if (diag.TryGetProperty("taskInfo", out var taskInfo))
                sb.AppendLine($"  taskInfo: {taskInfo}");
            if (diag.TryGetProperty("atConversationsCount", out var atCount))
                sb.AppendLine($"  @conversations (system): {atCount} docs");
            if (diag.TryGetProperty("conversationsCount", out var convCount))
                sb.AppendLine($"  Conversations (regular): {convCount} docs");
        }
        catch (Exception ex)
        {
            sb.AppendLine($"(diagnostics fetch failed: {ex.Message})");
        }

        return sb.ToString();
    }
}
