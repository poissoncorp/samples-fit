namespace FitAssistant.Backend.Features.ApiUsage.Application.Usage;

public class GlobalApiUsage
{
    public string Id { get; set; } = Constants.DocumentIds.GlobalApiUsage;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
