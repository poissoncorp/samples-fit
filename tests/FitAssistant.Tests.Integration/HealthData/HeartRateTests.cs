using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.HealthData;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class HeartRateTests(AppHostFixture app)
{
    [Fact]
    public async Task Heartrate_series_returns_points_after_wearable_sync()
    {
        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);
        await TestData.AppendHeartRate(app.BackendClient, userId);

        var response = await app.BackendClient
            .GetAsync($"/api/health/{Uri.EscapeDataString(userId)}/heartrate?range=7d");
        response.EnsureSuccessStatusCode();

        var points = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        points.Should().NotBeNull();
        points!.Should().NotBeEmpty();
        points![0].GetProperty("bpm").GetDouble().Should().BeInRange(30, 220);
    }
}
