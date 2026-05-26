using FitAssistant.Backend.Features.Coach.Models;
using Raven.Client.Documents;
using Raven.Client.Documents.Operations.Attachments;
using Raven.Client.Documents.Operations.Attachments.Remote;
using FitAssistant.Backend.Features.HealthData;

namespace FitAssistant.Backend.Features.Coach;

public class FoodEntryService
{
    private readonly IDocumentStore _store;
    private readonly ILogger<FoodEntryService> _logger;

    public FoodEntryService(IDocumentStore store, ILogger<FoodEntryService> logger)
    {
        _store = store;
        _logger = logger;
    }

    public async Task<FoodEntry> WriteAsync(
        string userId, LogFoodEntryArgs args,
        byte[]? photoBytes = null, string? photoFileName = null, string? photoContentType = null)
    {
        FoodEntry entry;
        using (var session = _store.OpenAsyncSession())
        {
            entry = new FoodEntry
            {
                UserProfileId = userId,
                Timestamp     = DateTime.UtcNow,
                Description   = args.Description,
                Calories      = args.Calories,
            };
            await session.StoreAsync(entry);
            await session.SaveChangesAsync();
        }

        if (photoBytes != null && photoFileName != null)
        {
            try
            {
                using var attachSession = _store.OpenAsyncSession();
                await using var stream = new MemoryStream(photoBytes);
                attachSession.Advanced.Attachments.Store(
                    entry.Id,
                    new StoreAttachmentParameters(photoFileName, stream)
                    {
                        ContentType      = photoContentType ?? "image/jpeg",
                        RemoteParameters = new RemoteAttachmentParameters(
                            Constants.RemoteAttachments.DestinationId,
                            DateTime.UtcNow.AddSeconds(60))
                    });
                await attachSession.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "FoodEntry {Id} saved but Remote attachment write failed.",
                    entry.Id);
            }
        }

        return entry;
    }
}
