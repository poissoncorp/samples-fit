using FitAssistant.Backend.Features.Users;
using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.Session;

namespace FitAssistant.Backend.Features.HealthData;

[ApiController]
[Route("api/health")]
public class HealthDataController : ControllerBase
{
    private readonly IAsyncDocumentSession _session;

    public HealthDataController(IAsyncDocumentSession session) => _session = session;

    [HttpGet("{userId}/heartrate")]
    public async Task<IActionResult> GetHeartRate(string userId, [FromQuery] string range = "24h")
    {
        userId = Constants.UserProfileId(userId);
        var since = ParseRange(range);

        var rollupTier = range switch
        {
            "7d"  => "ByHour",
            "30d" => "ByDay",
            _      => null,
        };

        if (rollupTier != null)
        {
            var rollups = await _session.TimeSeriesFor(
                userId, $"{Constants.TimeSeries.HeartRates}@{rollupTier}").GetAsync(since);
            if (rollups != null && rollups.Length > 0)
            {
                return Ok(rollups.Select(e => new
                {
                    timestamp = e.Timestamp,
                    bpm = e.Values.Length >= 6 && e.Values[5] > 0
                        ? (int)Math.Round(e.Values[4] / e.Values[5])  // sum / count = avg
                        : (int)Math.Round(e.Values[0]),                // fallback: first
                }));
            }
        }

        var entries = await _session.TimeSeriesFor<HeartRateEntry>(userId, Constants.TimeSeries.HeartRates)
            .GetAsync(since);
        return Ok((entries ?? []).Select(e => new
        {
            timestamp = e.Timestamp,
            bpm = e.Value.Bpm
        }));
    }

    [HttpGet("{userId}/calories")]
    public async Task<IActionResult> GetCalories(string userId, [FromQuery] string range = "7d")
    {
        userId = Constants.UserProfileId(userId);
        var since = ParseRange(range);
        var sinceDay = since.Date;

        var intakeRows = await _session
            .Query<KcalIntakeByUserDay.Result, KcalIntakeByUserDay>()
            .Where(r => r.UserProfileId == userId && r.Day >= sinceDay)
            .OrderBy(r => r.Day)
            .ToListAsync();

        var burnedRows = await _session
            .Query<KcalBurnedByUserDay.Result, KcalBurnedByUserDay>()
            .Where(r => r.UserProfileId == userId && r.Day >= sinceDay)
            .OrderBy(r => r.Day)
            .ToListAsync();

        var dailyIntake = intakeRows.Select(r => new { date = r.Day, total = r.TotalKcal });
        var dailyBurned = burnedRows.Select(r => new { date = r.Day, total = r.TotalKcal });

        return Ok(new { intake = dailyIntake, burned = dailyBurned });
    }

    [HttpGet("{userId}/exercises")]
    public async Task<IActionResult> GetExercises(string userId, [FromQuery] string range = "7d")
    {
        userId = Constants.UserProfileId(userId);
        var since = ParseRange(range);

        var exercises = await _session.Query<ExerciseSession>()
            .Include(x => x.UserProfileId)
            .Where(x => x.UserProfileId == userId && x.StartTime >= since)
            .OrderByDescending(x => x.StartTime)
            .ToListAsync();

        var userProfile = await _session.LoadAsync<UserProfile>(userId);

        var now = DateTime.UtcNow;
        return Ok(new
        {
            exercises = exercises.Select(e => new
            {
                id = e.Id,
                e.Type,
                e.StartTime,
                e.EndTime,
                durationMinutes = (int)((e.EndTime ?? now) - e.StartTime).TotalMinutes,
                e.CaloriesBurned,
                e.CoachNote
            }),
            userGoal = userProfile?.FitnessGoal
        });
    }

    private static DateTime ParseRange(string range)
    {
        return range switch
        {
            "1h" => DateTime.UtcNow.AddHours(-1),
            "6h" => DateTime.UtcNow.AddHours(-6),
            "24h" => DateTime.UtcNow.AddHours(-24),
            "7d" => DateTime.UtcNow.AddDays(-7),
            "30d" => DateTime.UtcNow.AddDays(-30),
            _ => DateTime.UtcNow.AddDays(-7)
        };
    }
}
