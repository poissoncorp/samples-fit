using FitAssistant.Backend.Features.ApiUsage.Application.Usage;
using FitAssistant.Backend.Features.Coach.Models;
using FitAssistant.Backend.Features.Users;
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

        var apiKey = Environment.GetEnvironmentVariable(Constants.EnvVars.OpenAiApiKey);
        if (string.IsNullOrEmpty(apiKey))
        {
            await sse.WriteAsync(new ChatTextMessage("AI Agent is not configured. Set the OPENAI_API_KEY environment variable to enable chat."));
            await sse.WriteAsync(new ChatFinalUnconfigured());
            return;
        }

        UserProfile? user;
        using (var lookup = store.OpenAsyncSession())
        {
            user = await lookup.LoadAsync<UserProfile>(Constants.UserProfileId(req.UserId));
        }

        if (req.Intent == "motivate" && user?.IsPremium != true)
        {
            await sse.WriteAsync(new ChatTextMessage(
                "Motivate Me is part of Fit Assistant Ultra. Upgrade in the persona switcher to unlock weekly pep talks."));
            await sse.WriteAsync(new ChatFinalUpsell());
            return;
        }

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

        var sessionId = HttpContext.GetSessionId();
        var conversationId = $"conversations/{sessionId}/{req.UserId}";
        var aiOps = new AiOperations(store);
        var conversation = aiOps.Conversation(
            Constants.Agent.Id,
            conversationId,
            new AiConversationCreationOptions
            {
                Parameters = new Dictionary<string, AiConversationParameter>
                {
                    ["userId"]    = new() { Value = req.UserId },
                    ["isPremium"] = new() { Value = user?.IsPremium == true }
                },
                ExpirationInSec = 60 * 60 * 24
            });

        // Register action tool handlers - log exercise and food entries
        conversation.Handle<LogExerciseArgs, string>("LogExercise", async args =>
        {
            await exerciseLog.WriteAsync(req.UserId, args);
            return $"Exercise logged: {args.Type} for {args.DurationMinutes}min ({args.CaloriesBurned} cal burned)";
        });
        
        conversation.Handle<LogFoodEntryArgs, string>("LogFoodEntry", async args =>
        {
            await foodEntries.WriteAsync(req.UserId, args);
            return $"Food entry logged: {args.Description} ({args.Calories} cal)";
        });

        var photoLogged = false;
        conversation.Handle<LogFoodEntryArgs, string>(
            $"{Constants.Agent.FoodPhotoSubAgentId}/LogFoodEntry", async args =>
            {
                if (photoLogged)
                    return $"Already logged for this photo: ignoring extra '{args.Description}' ({args.Calories} cal). One photo = one entry.";
                photoLogged = true;
                await foodEntries.WriteAsync(req.UserId, args);
                return $"Logged from photo: {args.Description} ({args.Calories} cal)";
            });
        
        
        // Set attachment and user prompt, then run, and stream response chunks
        if (photoBytes is not null)
            conversation.AddAttachment(photoFileName, new MemoryStream(photoBytes),
                photoContentType ?? "image/jpeg");
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
    }
}

public class ChatFormRequest
{
    public string Message { get; set; } = "";
    public string UserId { get; set; } = "";
    public string? Intent { get; set; }
    public IFormFile? Photo { get; set; }
}

public sealed record ChatTextMessage(string Text) : SseEvent
{
    public override object Payload => Text;
}

public sealed record ChatStreamChunk(string Text) : SseEvent
{
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

public sealed record ChatFinalUpsell : SseEvent
{
    public override string? EventName => "final";
    public override object Payload => new { reason = "upsell_ultra" };
}

public sealed record ChatErrorEvent(string Error) : SseEvent
{
    public override string? EventName => "error";
    public override object Payload => new { error = Error };
}
