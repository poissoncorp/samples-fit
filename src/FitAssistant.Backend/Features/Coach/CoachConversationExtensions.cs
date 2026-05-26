using FitAssistant.Backend.Features.Coach.Models;
using Raven.Client.Documents.AI;

namespace FitAssistant.Backend.Features.Coach;


internal static class CoachConversationExtensions
{
    public static void WireLogFoodEntry(
        this IAiConversationOperations conv,
        string userId,
        FoodEntryService foodEntries,
        byte[]? photoBytes,
        string? photoFileName,
        string? photoContentType)
    {
        conv.Handle<LogFoodEntryArgs, string>("LogFoodEntry",
            args => HandleAsync(args, "Food entry logged"));
        conv.Handle<LogFoodEntryArgs, string>(
            $"{Constants.Agent.FoodPhotoSubAgentId}/LogFoodEntry",
            args => HandleAsync(args, "Logged from photo"));
        return;

        async Task<string> HandleAsync(LogFoodEntryArgs args, string prefix)
        {
            await foodEntries.WriteAsync(userId, args, photoBytes, photoFileName, photoContentType);
            return $"{prefix}: {args.Description} ({args.Calories} cal)";
        }
    }


    public static MemoryStream? AttachPhotoIfPresent(
        this IAiConversationOperations conv,
        byte[]? photoBytes,
        string? photoFileName,
        string? photoContentType)
    {
        if (photoBytes is null || photoFileName is null) return null;
        var stream = new MemoryStream(photoBytes);
        conv.AddAttachment(photoFileName, stream, photoContentType ?? "image/jpeg");
        return stream;
    }
}
