using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.Operations.OngoingTasks;
using Raven.Client.ServerWide.Operations.OngoingTasks;

namespace FitAssistant.Backend.Features.PipelineTelemetry;

[ApiController]
[Route("api/admin/pipeline-stats")]
public class PipelineStatsController(PipelineStatsAggregator aggregator, IDocumentStore store) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
        => Ok(await aggregator.GetSnapshotAsync(ct));

    [HttpPost("/api/admin/olap-etl/run")]
    public async Task<IActionResult> RunOlapEtl(CancellationToken ct)
    {
        var taskInfo = await store.Maintenance.SendAsync(
            new GetOngoingTaskInfoOperation(Constants.Etl.TrendsOlapEtlName, OngoingTaskType.OlapEtl), ct);
        if (taskInfo == null)
            return NotFound(new { error = $"OLAP ETL '{Constants.Etl.TrendsOlapEtlName}' is not registered." });

        await store.Maintenance.SendAsync(
            new ToggleOngoingTaskStateOperation(taskInfo.TaskId, OngoingTaskType.OlapEtl, disable: true), ct);
        // Disable→enable round-trip drains the OLAP ETL buffer; the gap lets the worker observe the toggle.
        await Task.Delay(300, ct);
        await store.Maintenance.SendAsync(
            new ToggleOngoingTaskStateOperation(taskInfo.TaskId, OngoingTaskType.OlapEtl, disable: false), ct);

        return Accepted(new { message = "OLAP ETL retriggered — pending writes flushing, processing resumed." });
    }
}
