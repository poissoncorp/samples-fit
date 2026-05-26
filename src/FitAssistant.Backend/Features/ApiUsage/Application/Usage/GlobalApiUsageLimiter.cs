using FitAssistant.Backend.Features.ApiUsage.Application.Exception;
using Raven.Client.Documents;
using Raven.Client.Documents.Operations.TimeSeries;

namespace FitAssistant.Backend.Features.ApiUsage.Application.Usage;

public class GlobalApiUsageLimiter
{
    private readonly int _maxRequestsPer15Minutes;
    private readonly IDocumentStore _store;

    public int MaxRequestsPer15Minutes => _maxRequestsPer15Minutes;

    public GlobalApiUsageLimiter(IDocumentStore store)
    {
        _store = store;

        var raw = Environment.GetEnvironmentVariable(Constants.EnvVars.MaxGlobalRequestsPer15Minutes) ?? "100";
        if (!int.TryParse(raw, out _maxRequestsPer15Minutes))
            throw new InvalidOperationException(
                $"Invalid integer in \"{Constants.EnvVars.MaxGlobalRequestsPer15Minutes}\": {raw}");
    }

    public async Task EnsureAllowedAsync()
    {
        var result = await _store.Operations.SendAsync(
            new GetTimeSeriesOperation(Constants.DocumentIds.GlobalApiUsage, Constants.TimeSeries.Requests,
                DateTime.UtcNow.AddMinutes(-15),
                DateTime.UtcNow));

        var entries = result?.Entries;

        if (entries == null || entries.Length == 0)
            return;

        if (entries.Length >= _maxRequestsPer15Minutes)
            throw new GlobalRateLimitExceededException(
                "Demo request limit exceeded. Service is too busy right now. Please try again in a short while.");
    }
}
