using Microsoft.AspNetCore.Mvc;

namespace FitAssistant.Backend.Features.Trends;

[ApiController]
[Route("api/trends")]
public class TrendsController : ControllerBase
{
    private readonly TrendsQueryService _trends;

    public TrendsController(TrendsQueryService trends) => _trends = trends;

    [HttpGet("peer-standing/{userId}")]
    public IActionResult GetPeerStanding(string userId, [FromQuery] string period = "week")
    {
        userId = Constants.UserProfileId(userId);
        var days = PeriodDays(period);
        var standing = _trends.GetUserPeerStanding(userId, days);
        return Ok(new { period, days, you = standing });
    }

    [HttpGet("{period}")]
    public IActionResult Get(string period, [FromQuery] string? userId)
    {
        var days = PeriodDays(period);

        var trending    = _trends.GetTrendingExerciseTypes(days);
        var dailyVolume = _trends.GetDailyVolumeSeries(days);

        object? userVsPlatform = null;
        UserPeerStanding? you = null;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            userId = Constants.UserProfileId(userId);
            userVsPlatform = _trends.GetUserVsPlatformAverages(userId, days);
            you            = _trends.GetUserPeerStanding(userId, days);
        }

        return Ok(new
        {
            period,
            days,
            you,
            trendingTypes  = trending,
            dailyVolume,
            userVsPlatform,
        });
    }

    private static int PeriodDays(string period) => period.ToLowerInvariant() switch
    {
        "month" => 30,
        "year"  => 365,
        _       => 7,
    };
}
