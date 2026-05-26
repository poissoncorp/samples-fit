using System.Net.Http.Json;
using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FitAssistant.Tests.Integration.Infrastructure;

/// <summary>
/// Boots the real Aspire AppHost (RavenDB + backend + FitFeed + RabbitMQ +
/// MinIO) once per test collection. Does NOT call <c>/api/seed/all</c> —
/// each test creates only the data it needs via <see cref="TestData"/>.
/// Tests that genuinely want the full demo dataset use
/// <see cref="FullSeedFixture"/> instead (collection
/// <c>FullSeedCollection</c>).
/// </summary>
public class AppHostFixture : IAsyncLifetime
{
    private DistributedApplication? _app;

    public HttpClient BackendClient { get; private set; } = default!;
    public bool HasOpenAiKey =>
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("OPENAI_API_KEY"));

    public async Task InitializeAsync()
    {
        var builder = await DistributedApplicationTestingBuilder
            .CreateAsync<Projects.FitAssistant_AppHost>();

        _app = await builder.BuildAsync();
        await _app.StartAsync();

        var notifications = _app.Services.GetRequiredService<ResourceNotificationService>();
        await notifications
            .WaitForResourceAsync("backend", KnownResourceStates.Running)
            .WaitAsync(TimeSpan.FromMinutes(5));

        BackendClient = _app.CreateHttpClient("backend");
        BackendClient.Timeout = TimeSpan.FromMinutes(2);

        // RavenInitializer registers AI Agents + ETL + indexes in a
        // background task after the backend reports Running. Poll the
        // readiness endpoint so AI-dependent tests don't race.
        await WaitForReadyAsync(TimeSpan.FromMinutes(2));

        // Sub-classes (FullSeedFixture) hook in here to seed.
        await AfterReadyAsync();
    }

    protected virtual Task AfterReadyAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        if (_app is not null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }

    private async Task WaitForReadyAsync(TimeSpan budget)
    {
        var deadline = DateTime.UtcNow + budget;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                var resp = await BackendClient.GetAsync("/api/ready");
                if (resp.IsSuccessStatusCode) return;
            }
            catch { /* backend still warming up */ }
            await Task.Delay(TimeSpan.FromSeconds(1));
        }
        // Don't throw — older builds without /api/ready still let tests run.
    }

    public record UserSummary(string Id, string Name, string FitnessGoal, bool IsPremium = false);
}

[CollectionDefinition(Name)]
public sealed class AppHostCollection : ICollectionFixture<AppHostFixture>
{
    public const string Name = "AppHost";
}
