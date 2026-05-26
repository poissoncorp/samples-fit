using FitAssistant.Backend.Features.Coach.Models;
using Raven.Client.Documents;
using FitAssistant.Backend.Features.HealthData;

namespace FitAssistant.Backend.Features.Coach;

public class ExerciseLogService
{
    private readonly IDocumentStore _store;

    public ExerciseLogService(IDocumentStore store) => _store = store;

    public async Task WriteAsync(string userId, LogExerciseArgs args)
    {
        using var session = _store.OpenAsyncSession();
        var now = DateTime.UtcNow;
        await session.StoreAsync(new ExerciseSession
        {
            UserProfileId  = userId,
            Type           = args.Type,
            StartTime      = now.AddMinutes(-args.DurationMinutes),
            EndTime        = now,
            CaloriesBurned = args.CaloriesBurned,
        });
        await session.SaveChangesAsync();
    }
}
