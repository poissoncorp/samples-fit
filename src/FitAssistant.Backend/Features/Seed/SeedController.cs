using FitAssistant.Backend.Features.PipelineTelemetry;
using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;

namespace FitAssistant.Backend.Features.Seed;

[ApiController]
[Route("api/seed")]
public class SeedController(IDocumentStore store) : ControllerBase
{
    [HttpPost("all")]
    public async Task<IActionResult> SeedAll(CancellationToken ct)
    {
        await SeedData.SeedAllAsync(store);
        await OlapEtlFlush.FlushAsync(store, ct);
        return Ok(new { message = "Seed data created successfully." });
    }
}
