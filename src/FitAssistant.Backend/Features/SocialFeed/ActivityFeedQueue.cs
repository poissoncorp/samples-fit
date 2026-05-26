using RabbitMQ.Client;

namespace FitAssistant.Backend.Features.SocialFeed;

public static class ActivityFeedQueue
{
    public static async Task<IChannel> OpenChannelAsync(IConnection conn, CancellationToken ct)
    {
        var channel = await conn.CreateChannelAsync(cancellationToken: ct);
        await channel.QueueDeclareAsync(
            queue:      Constants.Etl.ActivityFeedQueueName,
            durable:    true,
            exclusive:  false,
            autoDelete: false,
            arguments:  null,
            cancellationToken: ct);
        return channel;
    }
}
