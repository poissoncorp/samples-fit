using System.Collections.Concurrent;

namespace FitAssistant.Backend.Features.PipelineTelemetry;

public class PipelineActivityBuffer
{
    private const int Capacity = 40;
    private readonly ConcurrentQueue<Entry> _entries = new();

    /// <summary>Track the last-seen OLAP write count so we can emit delta events on increase.</summary>
    private long _lastOlapWrites;
    /// <summary>Have we seen at least one OLAP write count yet? Baselines the first
    /// observation silently so a backend restart with a pre-populated counter doesn't
    /// fire a phantom "+47 row(s)" event for flushes that happened in a previous process.</summary>
    private int _olapBaselined;

    /// <summary>Track the last-seen fit-attachments object count for delta detection.</summary>
    private long _lastAttachmentCount;
    private int _attachmentsBaselined;

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
        if (delta <= 0) return; // counter reset or no change
        Record("olap.write", $"trends-olap-etl flushed +{delta} row(s) (total {currentTotal})");
    }

    public void NoticeAttachmentDrains(long currentObjectCount, long currentTotalBytes)
    {
        if (Interlocked.Exchange(ref _attachmentsBaselined, 1) == 0)
        {
            Interlocked.Exchange(ref _lastAttachmentCount, currentObjectCount);
            return;
        }

        var prev = Interlocked.Exchange(ref _lastAttachmentCount, currentObjectCount);
        var delta = currentObjectCount - prev;
        if (delta <= 0) return;
        Record("attachment.minio-drain",
            $"+{delta} object(s) propagated to fit-attachments (bucket now {currentObjectCount}, {currentTotalBytes:N0} bytes)");
    }

    public IReadOnlyList<Entry> Snapshot() => _entries.Reverse().ToArray();

    public record Entry(DateTime At, string Kind, string Summary);
}
