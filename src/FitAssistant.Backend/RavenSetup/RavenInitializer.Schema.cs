using Raven.Client.Documents.Operations.Expiration;
using Raven.Client.Documents.Operations.Refresh;
using Raven.Client.Documents.Operations.TimeSeries;
using Sparrow;

namespace FitAssistant.Backend.RavenSetup;

public partial class RavenInitializer
{
    private async Task ConfigureTimeSeriesRollups()
    {
        var config = new TimeSeriesConfiguration
        {
            PolicyCheckFrequency = TimeSpan.FromSeconds(10),
            Collections = new Dictionary<string, TimeSeriesCollectionConfiguration>
            {
                ["UserProfiles"] = new TimeSeriesCollectionConfiguration
                {
                    RawPolicy = new RawTimeSeriesPolicy(TimeValue.FromDays(30)),
                    Policies = new List<TimeSeriesPolicy>
                    {
                        new("ByHour",  TimeValue.FromHours(1), TimeValue.FromDays(30)),
                        new("ByDay",   TimeValue.FromDays(1),  TimeValue.FromDays(180)),
                        new("ByMonth", TimeValue.FromDays(30), TimeValue.FromYears(100)),
                    },
                },
            },
        };

        await _store.Maintenance.SendAsync(new ConfigureTimeSeriesOperation(config));

        _logger.LogInformation("Time series rollups configured (raw 30d → ByHour 30d → ByDay 6mo → ByMonth forever; rollup worker tick every 10s).");
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
