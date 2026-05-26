using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Users;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class PremiumToggleTests(AppHostFixture app)
{
    [Fact]
    public async Task Generate_user_with_isPremium_true_creates_ultra_user()
    {
        var resp = await app.BackendClient.PostAsJsonAsync("/api/users/generate",
            new { fitnessGoal = "Build muscle", isPremium = true });
        resp.EnsureSuccessStatusCode();

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("isPremium").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Toggle_premium_flips_the_tier()
    {
        var freeUserId = await TestData.CreateUser(app.BackendClient, isPremium: false);

        var resp = await app.BackendClient
            .PostAsync($"/api/users/{Uri.EscapeDataString(freeUserId)}/toggle-premium", content: null);
        resp.EnsureSuccessStatusCode();

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("isPremium").GetBoolean().Should().BeTrue();
    }
}
