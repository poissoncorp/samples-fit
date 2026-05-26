using Microsoft.AspNetCore.Mvc;
using FitAssistant.Backend.RavenSetup;

namespace FitAssistant.Backend.Features.Readiness;

[ApiController]
[Route("api/ready")]
public class ReadinessController : ControllerBase
{
    private readonly RavenInitializer _init;

    public ReadinessController(RavenInitializer init) => _init = init;

    [HttpGet]
    public IActionResult Get()
    {
        return _init.BackgroundInitComplete
            ? Ok(new { ready = true })
            : StatusCode(503, new { ready = false });
    }
}
