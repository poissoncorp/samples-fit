using System.Text.Json;
using FitAssistant.FitFeed.Models;
using FitAssistant.FitFeed.Services;
using FitAssistant.FitFeed.Workers;
using FitAssistant.ServiceDefaults;
using RabbitMQ.Client;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddSingleton<IConnection>(_ =>
{
    var conn = builder.Configuration.GetConnectionString("rabbit")
               ?? throw new InvalidOperationException("ConnectionStrings:rabbit not set");
    return new ConnectionFactory { Uri = new Uri(conn) }
        .CreateConnectionAsync().GetAwaiter().GetResult();
});

builder.Services.AddSingleton<FeedStore>();
builder.Services.AddSingleton<PipelineEventBuffer>();
builder.Services.AddHostedService<ActivityFeedConsumer>();

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

app.UseDeveloperExceptionPage();
app.MapDefaultEndpoints();
app.UseCors();

var jsonOpts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

app.MapGet("/api/stats", (PipelineEventBuffer events) =>
    Results.Json(new
    {
        consumed = Interlocked.Read(ref ActivityFeedConsumer.ConsumedMessages),
        recent   = events.Snapshot(),
    }, jsonOpts));

app.MapGet("/api/feed/{userId}", async (string userId, int? limit, FeedStore store) =>
{
    var normalized = NormalizeUserId(userId);
    var items = await store.GetFeedAsync(normalized, limit ?? 50);
    return Results.Json(new { userId = normalized, items }, jsonOpts);
});

app.MapGet("/api/achievements/{userId}", async (string userId, FeedStore store) =>
{
    var normalized = NormalizeUserId(userId);
    var state = await store.GetAchievementsAsync(normalized);
    return Results.Json(new
    {
        userId            = normalized,
        currentStreakDays = state.CurrentStreakDays,
        longestStreakDays = state.LongestStreakDays,
        level             = state.Level,
        lifetimeWorkouts  = state.LifetimeWorkouts,
        lifetimeKcalBurned = state.LifetimeKcalBurned,
    }, jsonOpts);
});

app.MapGet("/feed/{userId}/live", async (string userId, FeedStore store, HttpContext http, CancellationToken ct) =>
{
    var normalized = NormalizeUserId(userId);

    var sse = new SseStream(http.Response);
    await sse.StartAsync(ct);

    // Channel decouples the RabbitMQ consumer callback thread from the HTTP writer.
    var queue = System.Threading.Channels.Channel.CreateUnbounded<FeedItem>();
    await store.SubscribeLiveAsync(normalized, item => queue.Writer.TryWrite(item), ct);

    try
    {
        await foreach (var item in queue.Reader.ReadAllAsync(ct))
            await sse.WriteAsync(new FeedItemDelivered(item), ct);
    }
    catch (OperationCanceledException) { /* client disconnect */ }
    finally
    {
        // Drop in-flight publishes from the consumer thread once we're done.
        queue.Writer.TryComplete();
    }
});

static string NormalizeUserId(string userId)
{
    userId = Uri.UnescapeDataString(userId);
    return userId.Contains('/') ? userId : $"UserProfiles/{userId}";
}

app.Run();

public sealed record FeedItemDelivered(FeedItem Item) : SseEvent
{
    public override object Payload => Item;
}
