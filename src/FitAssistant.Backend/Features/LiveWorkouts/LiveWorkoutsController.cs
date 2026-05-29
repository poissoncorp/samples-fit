using FitAssistant.Backend.Features.LiveWorkouts;
using FitAssistant.ServiceDefaults;
using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.Session;
using FitAssistant.Backend.Features.HealthData;
using FitAssistant.Backend.Features.PipelineTelemetry;
using FitAssistant.Backend.Features.Users;

namespace FitAssistant.Backend.Features.LiveWorkouts;

[ApiController]
[Route("api/live/workouts")]
public class LiveWorkoutsController(IAsyncDocumentSession session, LiveWorkoutsStream stream) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Snapshot()
    {
        var live = await session.Query<ExerciseSession>()
            .Include(x => x.UserProfileId)
            .Where(x => x.EndTime == null)
            .OrderByDescending(x => x.StartTime)
            .ToListAsync();

        var users = await session.LoadAsync<UserProfile>(live.Select(x => x.UserProfileId));

        var items = live.Select(ex => new
        {
            session  = ex,
            userName = users[ex.UserProfileId].Name,
        });

        return Ok(new { items });
    }

    [HttpGet("stream")]
    public async Task Stream(CancellationToken ct)
    {
        var sse = new SseStream(Response);
        await sse.StartAsync(ct);
        await sse.WriteAsync(new LiveWorkoutsHello(), ct);

        using var _ = stream.Subscribe(out var reader);

        try
        {
            await foreach (var evt in reader.ReadAllAsync(ct))
                await sse.WriteAsync(new LiveWorkoutUpdate(evt.UserName, evt.Session), ct);
        }
        catch (OperationCanceledException) { }
    }
}

public sealed record LiveWorkoutsHello : SseEvent
{
    public override string? EventName => "hello";
    public override object Payload => new { };
}

public sealed record LiveWorkoutUpdate(string UserName, ExerciseSession Session) : SseEvent
{
    public override object Payload => new { userName = UserName, session = Session };
}
