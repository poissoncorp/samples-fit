using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Simulate;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class MealTests(AppHostFixture app)
{
    [Fact]
    public async Task Simulate_calorie_intake_logs_a_meal()
    {
        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);

        var response = await app.BackendClient
            .PostAsync($"/api/simulate/{Uri.EscapeDataString(userId)}/calories?level=0.5", content: null);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("calories").GetInt32().Should().BeGreaterThan(0);
        body.GetProperty("description").GetString().Should().NotBeNullOrEmpty();
    }
}
