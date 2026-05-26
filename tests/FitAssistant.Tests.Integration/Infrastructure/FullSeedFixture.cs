using Xunit;

namespace FitAssistant.Tests.Integration.Infrastructure;

/// <summary>
/// Opt-in fixture for tests that genuinely need the full demo dataset
/// (Trends / PeerRank / anything requiring multi-user aggregation). Boots
/// the AppHost like <see cref="AppHostFixture"/> and additionally calls
/// <c>POST /api/seed/all</c> once. Most tests should use the default
/// <see cref="AppHostFixture"/> + <see cref="TestData"/> instead.
/// </summary>
public sealed class FullSeedFixture : AppHostFixture
{
    protected override async Task AfterReadyAsync()
    {
        var seed = await BackendClient.PostAsync("/api/seed/all", content: null);
        seed.EnsureSuccessStatusCode();
    }
}

[CollectionDefinition(Name)]
public sealed class FullSeedCollection : ICollectionFixture<FullSeedFixture>
{
    public const string Name = "FullSeed";
}
