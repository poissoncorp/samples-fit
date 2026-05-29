using Raven.Client.Documents.Operations.Expiration;
using Raven.Client.Documents.Operations.Refresh;
using Raven.Client.Documents.Operations.TimeSeries;
using Sparrow;

namespace FitAssistant.Backend.RavenSetup;

public partial class RavenInitializer
{
    private async Task ConfigureTimeSeriesRollups()
    {
        // Four-tier rollup pyramid for HR (and any other TS on UserProfiles).
        // Each tier feeds a different range in the Heart Rate tab:
        //   24h → raw HeartRates           (288 five-min points)
        //   7d  → HeartRates@ByHour        (168 hourly avgs)
        //   30d → HeartRates@ByDay         (30 daily avgs)
        //   long-term analytics → ByMonth  (forever)
        // Policies must be declared in ascending aggregation-window order.
        await _store.Maintenance.SendAsync(
            new ConfigureRawTimeSeriesPolicyOperation("UserProfiles",
                new RawTimeSeriesPolicy(TimeValue.FromDays(30))));

        await _store.Maintenance.SendAsync(
            new ConfigureTimeSeriesPolicyOperation("UserProfiles",
                new TimeSeriesPolicy("ByHour", TimeValue.FromHours(1), TimeValue.FromDays(30))));

        await _store.Maintenance.SendAsync(
            new ConfigureTimeSeriesPolicyOperation("UserProfiles",
                new TimeSeriesPolicy("ByDay", TimeValue.FromDays(1), TimeValue.FromDays(180))));

        await _store.Maintenance.SendAsync(
            new ConfigureTimeSeriesPolicyOperation("UserProfiles",
                new TimeSeriesPolicy("ByMonth", TimeValue.FromDays(30), TimeValue.FromYears(100))));

        _logger.LogInformation("Time series rollup policies configured (raw 30d → ByHour 30d → ByDay 6mo → ByMonth forever).");
    }

    private async Task ConfigureDocumentLifecycleAsync()
    {
        await _store.Maintenance.SendAsync(new ConfigureRefreshOperation(new RefreshConfiguration
        {
            Disabled = false,
            RefreshFrequencyInSec = 10,
        }));
        _logger.LogInformation("Document Refresh enabled (sweep every 10s).");

        await _store.Maintenance.SendAsync(new ConfigureExpirationOperation(new ExpirationConfiguration
        {
            Disabled = false,
            DeleteFrequencyInSec = 10,
        }));
        _logger.LogInformation("Document Expiration enabled (sweep every 10s).");
    }
}
