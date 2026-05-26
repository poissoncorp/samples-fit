using System.Collections.Concurrent;
using FitAssistant.FitFeed.Models;

namespace FitAssistant.FitFeed.Services;

/// <summary>
/// Process-local store for feed lists, achievement state, and SSE subscribers.
/// State resets on restart — feed history replays from RabbitMQ.
/// </summary>
public class FeedStore
{
    private const int FeedCap = 100;

    private readonly ConcurrentDictionary<string, LinkedList<FeedItem>> _items = new();
    private readonly ConcurrentDictionary<string, AchievementState> _achievements = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, Action<FeedItem>>> _subscribers = new();
    private readonly ConcurrentDictionary<string, byte> _claimedSessions = new();

    public Task AddItemAsync(FeedItem item, CancellationToken ct = default)
    {
        var list = _items.GetOrAdd(item.ViewerUserId, _ => new LinkedList<FeedItem>());
        lock (list)
        {
            list.AddFirst(item);
            while (list.Count > FeedCap) list.RemoveLast();
        }

        if (_subscribers.TryGetValue(item.ViewerUserId, out var bag))
        {
            foreach (var sink in bag.Values) sink(item);
        }

        return Task.CompletedTask;
    }

    public Task<List<FeedItem>> GetFeedAsync(string userId, int limit = 50)
    {
        if (!_items.TryGetValue(userId, out var list)) return Task.FromResult(new List<FeedItem>());
        lock (list)
        {
            return Task.FromResult(list.Take(limit).ToList());
        }
    }

    // Per-subscriber slot — two browser tabs as the same user keep independent
    // subscriptions; cancelling one leaves the other intact.
    public Task SubscribeLiveAsync(string userId, Action<FeedItem> onItem, CancellationToken ct)
    {
        var bag = _subscribers.GetOrAdd(userId, _ => new ConcurrentDictionary<Guid, Action<FeedItem>>());
        var id = Guid.NewGuid();
        bag[id] = onItem;
        ct.Register(() => bag.TryRemove(id, out _));
        return Task.CompletedTask;
    }

    public Task<AchievementState> GetAchievementsAsync(string userId)
        => Task.FromResult(_achievements.TryGetValue(userId, out var s) ? s : new AchievementState());

    public Task SaveAchievementsAsync(string userId, AchievementState state)
    {
        _achievements[userId] = state;
        return Task.CompletedTask;
    }

    // First message per session wins — Queue ETL fans one workout to N friends;
    // without this gate the actor's streak/level would advance N times.
    public Task<bool> TryClaimSessionAsync(string sessionId)
        => Task.FromResult(_claimedSessions.TryAdd(sessionId, 0));
}
