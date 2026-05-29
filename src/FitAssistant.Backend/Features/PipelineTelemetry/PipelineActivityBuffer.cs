using System.Collections.Concurrent;

namespace FitAssistant.Backend.Features.PipelineTelemetry;

public class PipelineActivityBuffer
{
    private const int Capacity = 40;
    private readonly ConcurrentQueue<Entry> _entries = new();

    /// <summary>Last-seen OLAP write count. Baselined on the first observation
    /// so a restart with a pre-populated counter doesn't fire phantom deltas.</summary>
    private long _lastOlapWrites;
    private int _olapBaselined;

    public void Record(string kind, string summary)
    {
        _entries.Enqueue(new Entry(DateTime.UtcNow, kind, summary));
        while (_entries.Count > Capacity && _entries.TryDequeue(out _)) { }
    }

    public void NoticeOlapWrites(long currentTotal)
    {
        if (Interlocked.Exchange(ref _olapBaselined, 1) == 0)
        {
            Interlocked.Exchange(ref _lastOlapWrites, currentTotal);
            return;
        }

        var prev = Interlocked.Exchange(ref _lastOlapWrites, currentTotal);
        var delta = currentTotal - prev;
        if (delta <= 0) return;
        Record("olap.write", $"trends-olap-etl flushed +{delta} row(s) (total {currentTotal})");
    }

    public IReadOnlyList<Entry> Snapshot() => _entries.Reverse().ToArray();

    public record Entry(DateTime At, string Kind, string Summary);
}
