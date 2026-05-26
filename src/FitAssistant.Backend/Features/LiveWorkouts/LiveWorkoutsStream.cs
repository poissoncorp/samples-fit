using System.Collections.Concurrent;
using System.Threading.Channels;
using Raven.Client.Documents;
using Raven.Client.Documents.Changes;
using Raven.Client.Documents.Session;
using FitAssistant.Backend.Features.HealthData;
using FitAssistant.Backend.Features.Users;

namespace FitAssistant.Backend.Features.LiveWorkouts;

public sealed record LiveWorkoutEvent(ExerciseSession Session, string UserName);

public sealed class LiveWorkoutsStream : BackgroundService
{
    private readonly IDocumentStore _store;
    private readonly ILogger<LiveWorkoutsStream> _logger;
    private readonly ConcurrentDictionary<Guid, Channel<LiveWorkoutEvent>> _subscribers = new();
    private IDisposable? _changesSubscription;

    public LiveWorkoutsStream(IDocumentStore store, ILogger<LiveWorkoutsStream> logger)
    {
        _store  = store;
        _logger = logger;
    }

    public IDisposable Subscribe(out ChannelReader<LiveWorkoutEvent> reader)
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateUnbounded<LiveWorkoutEvent>();
        _subscribers[id] = channel;
        reader = channel.Reader;
        return new Unsubscriber(this, id);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            var changes = _store.Changes();
            await changes.EnsureConnectedNow();

            _changesSubscription = changes
                .ForDocumentsInCollection<ExerciseSession>()
                .Subscribe(new ChangeObserver(this, stoppingToken));

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) { }
        finally
        {
            _changesSubscription?.Dispose();
            foreach (var ch in _subscribers.Values) ch.Writer.TryComplete();
        }
    }

    private async Task HandleChangeAsync(DocumentChange change, CancellationToken ct)
    {
        if (change.Type != DocumentChangeTypes.Put) return;

        try
        {
            using var session = _store.OpenAsyncSession();
            var doc = await session
                .Include<ExerciseSession>(x => x.UserProfileId)
                .LoadAsync<ExerciseSession>(change.Id, ct);
            if (doc is null) return;

            var user = await session.LoadAsync<UserProfile>(doc.UserProfileId, ct);
            if (user is null) return;

            var evt = new LiveWorkoutEvent(doc, user.Name);
            foreach (var ch in _subscribers.Values) ch.Writer.TryWrite(evt);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LiveWorkoutsStream: change {Id} dropped.", change.Id);
        }
    }

    private sealed class Unsubscriber(LiveWorkoutsStream owner, Guid id) : IDisposable
    {
        public void Dispose()
        {
            if (owner._subscribers.TryRemove(id, out var ch)) ch.Writer.TryComplete();
        }
    }

    private sealed class ChangeObserver(LiveWorkoutsStream owner, CancellationToken ct) : IObserver<DocumentChange>
    {
        public void OnNext(DocumentChange value) => _ = owner.HandleChangeAsync(value, ct);
        public void OnError(Exception error)     => owner._logger.LogWarning(error, "Changes API error.");
        public void OnCompleted() { }
    }
}
