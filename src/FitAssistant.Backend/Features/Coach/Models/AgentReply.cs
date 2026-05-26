namespace FitAssistant.Backend.Features.Coach.Models;

public class AgentReply
{
    public string Answer { get; init; } = "";
    public string[]? Followups { get; init; }
}
