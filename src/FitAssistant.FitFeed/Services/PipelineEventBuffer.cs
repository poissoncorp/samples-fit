using System.Collections.Concurrent;

namespace FitAssistant.FitFeed.Services;

/// <summary>
/// Ring of the last ~30 events FitFeed has processed. The main backend polls
/// it via <c>GET /api/stats</c> and merges it into the HUD's unified timeline.
/// </summary>
public class PipelineEventBuffer
{
    private const int Capacity = 30;
    private readonly ConcurrentQueue<Entry> _entries = new();

    public void Record(string kind, string summary)
    {
        _entries.Enqueue(new Entry(DateTime.UtcNow, kind, summary));
        while (_entries.Count > Capacity && _entries.TryDequeue(out _)) { }
    }

    public IReadOnlyList<Entry> Snapshot() => _entries.Reverse().ToArray();

    public record Entry(DateTime At, string Kind, string Summary);
}
