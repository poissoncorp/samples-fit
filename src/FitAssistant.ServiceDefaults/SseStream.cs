using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace FitAssistant.ServiceDefaults;

/// <summary>One way to write SSE across every endpoint in the demo — same headers,
/// same framing, same flush discipline. Callers pass a typed <see cref="SseEvent"/>;
/// the writer routes by <see cref="SseEvent.EventName"/> (null → unnamed
/// <c>data:</c> frame, non-null → named <c>event:</c> frame).</summary>
public sealed class SseStream(HttpResponse response)
{
    private static readonly JsonSerializerOptions Json = JsonSerializerOptions.Web;

    public async Task StartAsync(CancellationToken ct = default)
    {
        response.ContentType = "text/event-stream";
        response.Headers.CacheControl = "no-cache";
        response.Headers["X-Accel-Buffering"] = "no";
        await response.Body.FlushAsync(ct);
    }

    public async Task WriteAsync(SseEvent ev, CancellationToken ct = default)
    {
        var data = JsonSerializer.Serialize(ev.Payload, Json);
        var frame = ev.EventName is null
            ? $"data: {data}\n\n"
            : $"event: {ev.EventName}\ndata: {data}\n\n";
        await response.WriteAsync(frame, ct);
        await response.Body.FlushAsync(ct);
    }
}

/// <summary>Closed hierarchy of SSE event types. Each concrete subclass lives in
/// the project that owns its payload — the base type carries the wire-framing
/// contract (event name + payload object). Adding a new event = a new sealed
/// record; no magic strings on call sites.</summary>
public abstract record SseEvent
{
    /// <summary>Null → unnamed <c>data:</c> frame (lands on EventSource.onmessage).
    /// Non-null → <c>event: &lt;name&gt;</c> frame (lands on addEventListener).</summary>
    public abstract string? EventName { get; }

    /// <summary>JSON-serialized into the <c>data:</c> line.</summary>
    public abstract object Payload { get; }
}
