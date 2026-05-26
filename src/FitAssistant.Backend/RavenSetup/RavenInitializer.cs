using FitAssistant.Backend.Configuration;
using FitAssistant.Backend.Features.HealthData;
using Microsoft.Extensions.Options;
using Raven.Client.Documents;
using Raven.Client.Documents.Indexes;
using Raven.Client.Documents.Operations.OngoingTasks;
using Raven.Client.ServerWide;
using Raven.Client.ServerWide.Operations;

namespace FitAssistant.Backend.RavenSetup;

public partial class RavenInitializer : IHostedService
{
    private readonly IDocumentStore _store;
    private readonly ILogger<RavenInitializer> _logger;
    private readonly IConfiguration _config;
    private readonly MinioOptions _minio;

    public bool BackgroundInitComplete { get; private set; }

    public RavenInitializer(
        IDocumentStore store,
        ILogger<RavenInitializer> logger,
        IConfiguration config,
        IOptions<MinioOptions> minio)
    {
        _store = store;
        _logger = logger;
        _config = config;
        _minio = minio.Value;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Initializing RavenDB for Fit Assistant...");

        await EnsureDatabaseExists();
        await WaitForDatabaseAdmin();
        await RunSetupStep(new RavenSetupStep(
            "remote attachments",
            ConfigureRemoteAttachmentsWithVerify,
            (log, ex) => log.LogWarning(ex, "Remote Attachments config failed. Photos fall back to RavenDB-local storage.")));
        await RunSetupStep(new RavenSetupStep(
            "document lifecycle",
            ConfigureDocumentLifecycleAsync,
            (log, ex) => log.LogWarning(ex, "Document Refresh / Expiration config failed.")));

        _ = Task.Run(async () =>
        {
            foreach (var step in BackgroundSetupSteps())
                await RunSetupStep(step);

            BackgroundInitComplete = true;
            _logger.LogInformation("RavenDB background initialization complete.");
        }, cancellationToken);

        _logger.LogInformation("RavenDB foreground init done; backend HTTP is ready.");
    }

    private IEnumerable<RavenSetupStep> BackgroundSetupSteps()
    {
        yield return new(
            "time-series rollups",
            ConfigureTimeSeriesRollups,
            (log, ex) =>
            {
                if (ex.Message.Contains("license", StringComparison.OrdinalIgnoreCase))
                    log.LogWarning("Time series rollup policies require a license. Skipping.");
                else
                    log.LogWarning(ex, "Time series rollup config failed.");
            });
        yield return new("indexes", ConfigureIndexes,
            (log, ex) => log.LogWarning(ex, "Index creation failed. Percentile features may not work."));
        yield return new("AI agents", ConfigureAiAgent,
            (log, ex) => log.LogWarning(ex, "AI Agent configuration failed."));
        yield return new("Queue ETL", ConfigureQueueEtl,
            (log, ex) => log.LogWarning(ex, "Queue ETL configuration failed."));
        yield return new("OLAP ETL", ConfigureTrendsOlapEtl,
            (log, ex) => log.LogWarning(ex, "OLAP ETL configuration failed."));
    }

    private async Task RunSetupStep(RavenSetupStep step)
    {
        try
        {
            await step.Run();
        }
        catch (Exception ex)
        {
            if (step.OnError is null) throw;
            step.OnError(_logger, ex);
        }
    }

    private async Task WaitForDatabaseAdmin()
    {
        var serverUrl = _store.Urls[0].TrimEnd('/');
        var probeUrl  = $"{serverUrl}/databases/{_store.Database}/admin/attachments/remote/config";

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        for (var attempt = 1; attempt <= 30; attempt++)
        {
            try
            {
                var resp = await http.GetAsync(probeUrl);
                if ((int)resp.StatusCode < 500) return;
            }
            catch { }
            await Task.Delay(TimeSpan.FromMilliseconds(500));
        }
        _logger.LogWarning("Database admin route did not stabilise after 15s. Proceeding anyway.");
    }

    private async Task ConfigureRemoteAttachmentsWithVerify()
    {
        var serverUrl = _store.Urls[0].TrimEnd('/');
        var routeUrl  = $"{serverUrl}/databases/{_store.Database}/admin/attachments/remote/config";

        for (var attempt = 1; attempt <= 5; attempt++)
        {
            await ConfigureRemoteAttachments();

            using var http = new HttpClient();
            var json = await http.GetStringAsync(routeUrl);
            if (json.Contains($"\"{Constants.RemoteAttachments.DestinationId}\""))
            {
                _logger.LogInformation(
                    "Remote Attachments config verified persisted on attempt {Attempt}.", attempt);
                return;
            }

            _logger.LogWarning(
                "Remote Attachments config did not persist on attempt {Attempt}. Retrying in 1s.", attempt);
            await Task.Delay(TimeSpan.FromSeconds(1));
        }

        _logger.LogError("Remote Attachments config failed to persist after 5 attempts.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task ConfigureIndexes()
    {
        await IndexCreation.CreateIndexesAsync(typeof(KcalIntakeByUserDay).Assembly, _store);
        _logger.LogInformation("Indexes created (KcalIntakeByUserDay, KcalBurnedByUserDay).");
    }

    private async Task EnsureDatabaseExists()
    {
        var dbName = _store.Database;
        try
        {
            await _store.Maintenance.Server.SendAsync(
                new CreateDatabaseOperation(new DatabaseRecord(dbName)));
            _logger.LogInformation("Database '{Database}' created.", dbName);
        }
        catch (Exception ex) when (ex.Message.Contains("already exists"))
        {
            _logger.LogInformation("Database '{Database}' already exists.", dbName);
        }
    }

    private async Task UpsertOngoingTaskAsync(string name, OngoingTaskType type, Func<Task> addAsync)
    {
        try
        {
            var existing = await _store.Maintenance.SendAsync(new GetOngoingTaskInfoOperation(name, type));
            if (existing != null)
            {
                await _store.Maintenance.SendAsync(new DeleteOngoingTaskOperation(existing.TaskId, type));
                _logger.LogInformation("Existing {Type} task '{Name}' (id {TaskId}) removed before re-registration.",
                    type, name, existing.TaskId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Lookup for existing {Type} task '{Name}' returned an error — proceeding with add.",
                type, name);
        }
        await addAsync();
    }
}
