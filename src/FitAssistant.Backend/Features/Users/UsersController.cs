using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.Session;
using FitAssistant.Backend.Features.Seed;

namespace FitAssistant.Backend.Features.Users;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IDocumentStore _store;
    private readonly IAsyncDocumentSession _session;

    public UsersController(IDocumentStore store, IAsyncDocumentSession session)
    {
        _store = store;
        _session = session;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _session.Query<UserProfile>()
            .Select(u => new { u.Id, u.Name, u.FitnessGoal, u.IsPremium })
            .ToListAsync();
        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        id = Constants.UserProfileId(id);
        var user = await _session.LoadAsync<UserProfile>(id);
        if (user == null) return NotFound();
        return Ok(user);
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateUser([FromBody] GenerateUserRequest request)
    {
        if (string.IsNullOrEmpty(request.FitnessGoal) ||
            !Constants.FitnessGoals.Contains(request.FitnessGoal))
        {
            return BadRequest(new { error = "Invalid fitness goal.", validGoals = Constants.FitnessGoals });
        }

        var rng = new Random();
        var names = new[] { "Taylor", "Morgan", "Riley", "Quinn", "Avery", "Dakota", "Reese", "Skyler" };
        var surnames = new[] { "Active", "Fit", "Strong", "Swift", "Steady", "Bold" };

        var user = new UserProfile
        {
            Name = $"{names[rng.Next(names.Length)]} {surnames[rng.Next(surnames.Length)]}",
            Birthday = DateTime.UtcNow
                .AddYears(-rng.Next(20, 45))
                .AddDays(-rng.Next(0, 365))
                .ToString("yyyy-MM-dd"),
            WeightKg = 55 + rng.NextDouble() * 45,
            HeightCm = rng.Next(155, 195),
            DailyCalorieGoal = request.FitnessGoal switch
            {
                "Lose weight" => rng.Next(1500, 1900),
                "Build muscle" => rng.Next(2500, 3200),
                _ => rng.Next(1900, 2400)
            },
            FitnessGoal = request.FitnessGoal,
            IsPremium = request.IsPremium
        };

        await _session.StoreAsync(user);
        var metadata = _session.Advanced.GetMetadataFor(user);
        metadata["@refresh"] = DateTime.UtcNow.AddSeconds(5).ToString("o");
        await _session.SaveChangesAsync();

        await SeedData.SeedUserDataAsync(_store, user.Id!);

        return Ok(new { id = user.Id, user.Name, user.FitnessGoal, user.IsPremium });
    }

    [HttpPost("{id}/toggle-premium")]
    public async Task<IActionResult> TogglePremium(string id)
    {
        id = Constants.UserProfileId(id);
        var user = await _session.LoadAsync<UserProfile>(id);
        if (user == null) return NotFound();

        user.IsPremium = !user.IsPremium;
        await _session.SaveChangesAsync();

        return Ok(new { id = user.Id, user.Name, user.FitnessGoal, user.IsPremium });
    }

    [HttpGet("fitness-goals")]
    public IActionResult GetFitnessGoals()
    {
        return Ok(Constants.FitnessGoals);
    }
}

public record GenerateUserRequest(string FitnessGoal, bool IsPremium = false);
