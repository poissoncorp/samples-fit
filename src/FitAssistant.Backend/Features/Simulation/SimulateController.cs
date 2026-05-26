using Microsoft.AspNetCore.Mvc;

namespace FitAssistant.Backend.Features.Simulation;

[ApiController]
[Route("api/simulate")]
public class SimulateController : ControllerBase
{
    private readonly SimulationService _sim;

    public SimulateController(SimulationService sim) => _sim = sim;

    [HttpPost("{userId}")]
    public async Task<IActionResult> SimulateWearableSync(string userId)
    {
        userId = Constants.UserProfileId(userId);
        var pointsAdded = await _sim.AppendWearableSyncAsync(userId);
        if (pointsAdded is null) return NotFound(new { error = "User not found." });

        return Ok(new
        {
            message = $"Wearable sync complete. Added {pointsAdded} heart rate data points.",
            pointsAdded,
        });
    }

    [HttpPost("{userId}/calories")]
    public async Task<IActionResult> SimulateCalorieIntake(
        string userId,
        [FromQuery] double level = 0.5,
        [FromQuery] string? date = null)
    {
        userId = Constants.UserProfileId(userId);
        var parsedDate = string.IsNullOrEmpty(date) ? (DateTime?)null : DateTime.Parse(date);

        var meal = await _sim.LogMealAsync(userId, level, parsedDate);
        if (meal is null) return NotFound(new { error = "User not found." });

        return Ok(new
        {
            message     = $"Logged: {meal.Description} ({meal.Calories} cal)",
            description = meal.Description,
            calories    = meal.Calories,
        });
    }

    [HttpPost("{userId}/exercise/active")]
    public async Task<IActionResult> SimulateActiveExercise(string userId)
    {
        userId = Constants.UserProfileId(userId);
        var message = await _sim.StartActiveExerciseAsync(userId);
        return message is null
            ? NotFound(new { error = "User not found." })
            : Ok(new { message });
    }

    [HttpPost("exercise/{exerciseId}/extend")]
    public async Task<IActionResult> ExtendActiveExercise(string exerciseId, [FromQuery] int minutes = 20)
    {
        var message = await _sim.ExtendActiveExerciseAsync(exerciseId, minutes);
        return message is null
            ? NotFound(new { error = "Exercise not found." })
            : Ok(new { message });
    }

    [HttpPost("exercise/{exerciseId}/finish")]
    public async Task<IActionResult> FinishActiveExercise(string exerciseId)
    {
        var message = await _sim.FinishActiveExerciseAsync(exerciseId);
        return message is null
            ? NotFound(new { error = "Exercise not found." })
            : Ok(new { message });
    }

    [HttpPost("{userId}/exercise")]
    public async Task<IActionResult> SimulateExercise(
        string userId,
        [FromQuery] string? date = null)
    {
        userId = Constants.UserProfileId(userId);
        var parsedDate = string.IsNullOrEmpty(date) ? (DateTime?)null : DateTime.Parse(date);

        var done = await _sim.LogCompletedExerciseAsync(userId, parsedDate);
        if (done is null) return NotFound(new { error = "User not found." });

        return Ok(new
        {
            message         = $"{done.Type} — {done.DurationMinutes}min, {done.Calories} cal burned",
            durationMinutes = done.DurationMinutes,
            caloriesBurned  = done.Calories,
        });
    }
}
