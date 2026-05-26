using Raven.Client.Documents.Session.TimeSeries;

namespace FitAssistant.Backend.Features.HealthData;

public class HeartRateEntry : TimeSeriesEntry
{
    [TimeSeriesValue(0)] public double Bpm { get; set; }
}
