using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.HealthData;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class ExercisesTests(AppHostFixture app)
{
    [Fact]
    public async Task Exercises_list_includes_logged_session()
    {
        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);
        await TestData.LogCompletedExercise(app.BackendClient, userId);

        var response = await app.BackendClient
            .GetAsync($"/api/health/{Uri.EscapeDataString(userId)}/exercises?range=30d");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("exercises").GetArrayLength().Should().BeGreaterThan(0);
    }
}
