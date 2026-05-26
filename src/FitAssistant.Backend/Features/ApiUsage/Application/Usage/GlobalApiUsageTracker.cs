using Raven.Client.Documents;
using Raven.Client.Documents.Operations.AI;

namespace FitAssistant.Backend.Features.ApiUsage.Application.Usage;

public class GlobalApiUsageTracker(IDocumentStore store)
{
    public async Task TrackAsync(HttpContext http, AiUsage usage)
    {
        var sessionId = (string?)http.Items["SessionId"]
            ?? throw new System.Exception("Missing SessionId in HttpContext.");

        using var session = store.OpenAsyncSession();

        var doc = await session.LoadAsync<GlobalApiUsage>(Constants.DocumentIds.GlobalApiUsage);
        if (doc == null)
        {
            doc = new GlobalApiUsage();
            await session.StoreAsync(doc);
        }

        // SessionId rides along as a TS tag so cross-session attribution is
        // queryable without joining against the per-session doc.
        session.TimeSeriesFor(doc, Constants.TimeSeries.Requests)
            .Append(DateTime.UtcNow, 1, sessionId);

        session.CountersFor(doc).Increment("TotalPromptTokens", usage.PromptTokens);
        session.CountersFor(doc).Increment("TotalCompletionTokens", usage.CompletionTokens);
        session.CountersFor(doc).Increment("TotalCachedTokens", usage.CachedTokens);

        await session.SaveChangesAsync();
    }
}
