using FitAssistant.Backend.Features.Coach.Models;
using FitAssistant.Backend.Features.HealthData;
using Raven.Client.Documents;

namespace FitAssistant.Backend.Features.Coach;

public class FoodEntryService(IDocumentStore store)
{
    public async Task<FoodEntry> WriteAsync(string userId, LogFoodEntryArgs args)
    {
        using var session = store.OpenAsyncSession();
        var entry = new FoodEntry
        {
            UserProfileId = userId,
            Timestamp     = DateTime.UtcNow,
            Description   = args.Description,
            Calories      = args.Calories,
        };
        await session.StoreAsync(entry);
        await session.SaveChangesAsync();
        return entry;
    }
}
