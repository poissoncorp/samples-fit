using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Users;

[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class UsersTests(AppHostFixture app)
{
    [Fact]
    public async Task Get_users_returns_created_users()
    {
        // Create one of each tier so the listing is non-trivial.
        await TestData.CreateUser(app.BackendClient, isPremium: false);
        await TestData.CreateUser(app.BackendClient, isPremium: true);

        var users = await app.BackendClient
            .GetFromJsonAsync<List<AppHostFixture.UserSummary>>("/api/users");

        users.Should().NotBeNull();
        users!.Should().NotBeEmpty();
        users.Should().Contain(u => u.IsPremium);
        users.Should().Contain(u => !u.IsPremium);
        users.Should().AllSatisfy(u =>
        {
            u.Id.Should().NotBeNullOrEmpty();
            u.Name.Should().NotBeNullOrEmpty();
            u.FitnessGoal.Should().NotBeNullOrEmpty();
        });
    }

    [Fact]
    public async Task Get_single_user_returns_full_document()
    {
        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);

        var response = await app.BackendClient.GetAsync($"/api/users/{Uri.EscapeDataString(userId)}");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("name").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("fitnessGoal").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Get_fitness_goals_returns_known_list()
    {
        var goals = await app.BackendClient
            .GetFromJsonAsync<List<string>>("/api/users/fitness-goals");

        goals.Should().Contain("Lose weight");
        goals.Should().Contain("Build muscle");
    }
}
