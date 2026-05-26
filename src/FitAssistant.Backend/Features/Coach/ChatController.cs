using FitAssistant.Backend.Features.ApiUsage.Application.Usage;
using FitAssistant.Backend.Features.Coach.Models;
using FitAssistant.Backend.Startup;
using FitAssistant.ServiceDefaults;
using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.AI;

namespace FitAssistant.Backend.Features.Coach;

[ApiController]
[Route("api/chat")]
public class ChatController(
    IDocumentStore store,
    GlobalApiUsageTracker globalTracker,
    SessionApiUsageTracker sessionTracker,
    FoodEntryService foodEntries,
    ExerciseLogService exerciseLog,
    ILogger<ChatController> logger) : ControllerBase
{
    [HttpPost]
    public async Task Chat([FromForm] ChatFormRequest req)
    {
        var sse = new SseStream(Response);
        await sse.StartAsync(HttpContext.RequestAborted);

        byte[]? photoBytes = null;
        string? photoFileName = null;
        string? photoContentType = null;
        if (req.Photo is { Length: > 0 } photo)
        {
            using var ms = new MemoryStream();
            await photo.CopyToAsync(ms);
            photoBytes = ms.ToArray();
            photoFileName = photo.FileName;
            photoContentType = photo.ContentType;
        }

        var apiKey = Environment.GetEnvironmentVariable(Constants.EnvVars.OpenAiApiKey); //todo: don't get env here, either DI, or read with Aspire superpowers (Parameters, no?)
        if (string.IsNullOrEmpty(apiKey))
        {
            await sse.WriteAsync(new ChatTextMessage("AI Agent is not configured. Set the OPENAI_API_KEY environment variable to enable chat."));
            await sse.WriteAsync(new ChatFinalUnconfigured());
            return;
        }

        var sessionId = HttpContext.GetSessionId();
        var conversationId = $"conversations/{sessionId}/{req.UserId}";

        var aiOps = new AiOperations(store);
        var conversation = aiOps.Conversation( //todo: why is a new conversation started every time? shouldn't we preserve them? how to handle multiple clients?
            Constants.Agent.Id,
            conversationId,
            new AiConversationCreationOptions
            {
                Parameters = new Dictionary<string, AiConversationParameter>
                {
                    ["userId"] = new() { Value = req.UserId }
                },
                ExpirationInSec = 60 * 60 * 24
            });

        // LogFoodEntry handler (both parent + sub-agent routes) — when the
        // turn carries a photo, the bytes land as a Remote attachment on the
        // new FoodEntry doc, draining to MinIO ~60s later.
        conversation.WireLogFoodEntry(req.UserId, foodEntries, photoBytes, photoFileName, photoContentType);

        conversation.Handle<LogExerciseArgs, string>("LogExercise", async args =>
        {
            await exerciseLog.WriteAsync(req.UserId, args);
            return $"Exercise logged: {args.Type} for {args.DurationMinutes}min ({args.CaloriesBurned} cal burned)";
        });

        var agentStream = conversation.AttachPhotoIfPresent(photoBytes, photoFileName, photoContentType);
        conversation.SetUserPrompt(req.Message);

        try
        {
            var result = await conversation.StreamAsync<AgentReply>(
                "Answer",
                chunk => sse.WriteAsync(new ChatStreamChunk(chunk), HttpContext.RequestAborted));

            await sse.WriteAsync(new ChatFinalAnswer(
                result.Answer?.Answer,
                result.Answer?.Followups,
                result.Usage));

            await sessionTracker.TrackAsync(HttpContext, result.Usage);
            await globalTracker.TrackAsync(HttpContext, result.Usage);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Chat conversation failed for user {UserId}.", req.UserId);
            await sse.WriteAsync(new ChatErrorEvent("Coach encountered an error."));
        }
        finally
        {
            if (agentStream != null) await agentStream.DisposeAsync();
        }
    }
}

public class ChatFormRequest
{
    public string Message { get; set; } = "";
    public string UserId { get; set; } = "";
    public IFormFile? Photo { get; set; }
}

public sealed record ChatTextMessage(string Text) : SseEvent
{
    public override string? EventName => null;
    public override object Payload => Text;
}

public sealed record ChatStreamChunk(string Text) : SseEvent
{
    public override string? EventName => null;
    public override object Payload => Text;
}

public sealed record ChatFinalAnswer(string? Answer, string[]? Followups, object? Usage) : SseEvent
{
    public override string? EventName => "final";
    public override object Payload => new { answer = Answer, followups = Followups, usage = Usage };
}

public sealed record ChatFinalUnconfigured : SseEvent
{
    public override string? EventName => "final";
    public override object Payload => new { reason = "not_configured" };
}

public sealed record ChatErrorEvent(string Error) : SseEvent
{
    public override string? EventName => "error";
    public override object Payload => new { error = Error };
}
