namespace FitAssistant.Backend.Features.ApiUsage.Application.Exception;

public class SessionRateLimitExceededException(string message) : System.Exception(message);
