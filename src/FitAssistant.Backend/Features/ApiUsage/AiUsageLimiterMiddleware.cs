using FitAssistant.Backend.Features.ApiUsage.Application.Usage;
using FitAssistant.Backend.Startup;

namespace FitAssistant.Backend.Features.ApiUsage;

public class AiUsageLimiterMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, GlobalApiUsageLimiter global, SessionApiUsageLimiter session)
    {
        var sessionId = context.GetSessionId();

        await global.EnsureAllowedAsync();
        await session.EnsureAllowedAsync(sessionId);

        await next(context);
    }
}
