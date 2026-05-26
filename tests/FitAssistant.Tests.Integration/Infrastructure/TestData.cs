using System.Net.Http.Json;
using System.Text.Json;

namespace FitAssistant.Tests.Integration.Infrastructure;

/// <summary>
/// Tiny per-test data helpers — every integration test in this project
/// creates only the data it needs via these primitives instead of relying on
/// a global <c>/api/seed/all</c> call. Keeps the test surface fast,
/// deterministic, and isolated from cross-test interference (e.g. the
/// auto-coach GenAI Task chewing through a seeded backlog).
/// </summary>
public static class TestData
{
    /// <summary>Create a fresh user. Returns the document id.</summary>
    public static async Task<string> CreateUser(
        HttpClient client, bool isPremium, string fitnessGoal = "Build muscle")
    {
        var resp = await client.PostAsJsonAsync("/api/users/generate",
            new { fitnessGoal, isPremium });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetString()!;
    }

    /// <summary>Log a completed exercise session (EndTime != null).</summary>
    public static async Task LogCompletedExercise(HttpClient client, string userId)
    {
        var resp = await client.PostAsync($"/api/simulate/{Uri.EscapeDataString(userId)}/exercise", content: null);
        resp.EnsureSuccessStatusCode();
    }

    /// <summary>Start a live (EndTime == null) exercise session.</summary>
    public static async Task<JsonElement> StartLiveExercise(HttpClient client, string userId)
    {
        var resp = await client.PostAsync($"/api/simulate/{Uri.EscapeDataString(userId)}/exercise/active", content: null);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<JsonElement>();
    }

    /// <summary>Append a batch of heart-rate points via the wearable-sync sim.</summary>
    public static async Task AppendHeartRate(HttpClient client, string userId)
    {
        var resp = await client.PostAsync($"/api/simulate/{Uri.EscapeDataString(userId)}", content: null);
        resp.EnsureSuccessStatusCode();
    }

    /// <summary>Log a meal (FoodEntry) at the given intensity level.</summary>
    public static async Task LogMeal(HttpClient client, string userId, double level = 0.5)
    {
        var resp = await client.PostAsync($"/api/simulate/{Uri.EscapeDataString(userId)}/calories?level={level}",
            content: null);
        resp.EnsureSuccessStatusCode();
    }
}
