using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents.Session;

namespace FitAssistant.Backend.Features.DailyGoals;

[ApiController]
[Route("api/goals")]
public class GoalsController(IAsyncDocumentSession session, IConfiguration config) : ControllerBase
{
    private readonly int _cadenceSeconds = config.GetValue(
        "FitAssistant:DailyGoalsCadenceSeconds",
        Constants.GenAi.DefaultDailyGoalsCadenceSeconds);

    [HttpGet("{userId}")]
    public async Task<IActionResult> Get(string userId, CancellationToken ct)
    {
        userId = Constants.UserProfileId(userId);
        var stripped = Constants.StripCollectionPrefix(userId);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var docId = $"DailyGoals/{stripped}/{today}";

        var goals = await session.LoadAsync<DailyGoals>(docId, ct);

        if (goals == null)
        {
            return Ok(new
            {
                ready = false,
                forDate = today,
                cadenceSeconds = _cadenceSeconds,
            });
        }

        return Ok(new
        {
            ready = true,
            id = goals.Id,
            forDate = goals.ForDate,
            motivation = goals.Motivation,
            goals = goals.Goals.Select(g => new
            {
                text      = g.Text,
                fulfilled = g.Fulfilled,
                predicate = g.Predicate,
            }),
            generatedAt    = goals.GeneratedAt,
            cadenceSeconds = _cadenceSeconds,
        });
    }

    [HttpPost("{userId}/toggle")]
    public async Task<IActionResult> Toggle(
        string userId,
        [FromQuery] int index,
        [FromQuery] bool fulfilled,
        CancellationToken ct)
    {
        userId = Constants.UserProfileId(userId);
        var stripped = Constants.StripCollectionPrefix(userId);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var docId = $"DailyGoals/{stripped}/{today}";

        var goals = await session.LoadAsync<DailyGoals>(docId, ct);
        if (goals == null)
        {
            return NotFound(new { error = "No goals doc for today." });
        }
        if (index < 0 || index >= goals.Goals.Count)
        {
            return BadRequest(new { error = "Goal index out of range." });
        }

        goals.Goals[index].Fulfilled = fulfilled;

        await session.SaveChangesAsync(ct);

        return Accepted(new { index, fulfilled });
    }
}
