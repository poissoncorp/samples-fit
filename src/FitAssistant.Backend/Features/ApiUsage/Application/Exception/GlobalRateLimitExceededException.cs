namespace FitAssistant.Backend.Features.ApiUsage.Application.Exception;

public class GlobalRateLimitExceededException(string message) : System.Exception(message);
