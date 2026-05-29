using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;

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
        var flushed = await OlapEtlFlush.FlushAsync(store, ct);
        return flushed
            ? Accepted(new { message = "OLAP ETL retriggered — pending writes flushing, processing resumed." })
            : NotFound(new { error = $"OLAP ETL '{Constants.Etl.TrendsOlapEtlName}' is not registered." });
    }
}
