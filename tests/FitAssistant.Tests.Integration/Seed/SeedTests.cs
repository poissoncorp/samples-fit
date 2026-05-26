using System.Net.Http.Json;
using System.Text.Json;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Seed;

/// <summary>
/// Tests for the <c>/api/seed/all</c> endpoint itself. The fixture does NOT
/// auto-seed, so this test class is the one that actually exercises the
/// seed path. Re-running it must be idempotent.
/// </summary>
[Collection(AppHostCollection.Name)]
[Trait("phase", "A")]
public sealed class SeedTests(AppHostFixture app)
{
    [Fact]
    public async Task Seed_all_returns_ok_response()
    {
        var resp = await app.BackendClient.PostAsync("/api/seed/all", content: null);
        resp.EnsureSuccessStatusCode();

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("message").GetString().Should().Contain("Seed data");
    }
}
