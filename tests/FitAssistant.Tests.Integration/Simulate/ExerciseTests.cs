using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Simulate;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class ExerciseTests(AppHostFixture app)
{
    [Fact]
    public async Task Simulate_exercise_logs_a_completed_session()
    {
        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);

        var response = await app.BackendClient
            .PostAsync($"/api/simulate/{Uri.EscapeDataString(userId)}/exercise", content: null);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("caloriesBurned").GetInt32().Should().BeGreaterThan(0);
        body.GetProperty("durationMinutes").GetInt32().Should().BeGreaterThan(0);
    }
}
