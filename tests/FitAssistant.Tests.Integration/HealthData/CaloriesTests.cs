using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.HealthData;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class CaloriesTests(AppHostFixture app)
{
    [Fact]
    public async Task Calories_endpoint_returns_intake_and_burned_shape()
    {
        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);
        await TestData.LogMeal(app.BackendClient, userId);
        await TestData.LogCompletedExercise(app.BackendClient, userId);

        var response = await app.BackendClient
            .GetAsync($"/api/health/{Uri.EscapeDataString(userId)}/calories?range=30d");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.TryGetProperty("intake", out _).Should().BeTrue();
        body.TryGetProperty("burned", out _).Should().BeTrue();
    }
}
