using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;

namespace FitAssistant.Backend.Features.Seed;

[ApiController]
[Route("api/seed")]
public class SeedController : ControllerBase
{
    private readonly IDocumentStore _store;

    public SeedController(IDocumentStore store)
    {
        _store = store;
    }

    [HttpPost("all")]
    public async Task<IActionResult> SeedAll()
    {
        await SeedData.SeedAllAsync(_store);
        return Ok(new { message = "Seed data created successfully." });
    }
}
