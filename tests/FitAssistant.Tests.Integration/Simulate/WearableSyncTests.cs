using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Simulate;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class WearableSyncTests(AppHostFixture app)
{
    [Fact]
    public async Task Simulate_wearable_sync_adds_heart_rate_points()
    {
        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);

        var response = await app.BackendClient
            .PostAsync($"/api/simulate/{Uri.EscapeDataString(userId)}", content: null);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("pointsAdded").GetInt32().Should().BeGreaterThan(0);
    }
}
