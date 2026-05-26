namespace FitAssistant.Backend.Startup;

public class SessionMiddleware
{
    private const string SessionCookieName = "FitAssistant.Session";
    private readonly RequestDelegate _next;

    public SessionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Cookies.TryGetValue(SessionCookieName, out var sessionId)
            || string.IsNullOrEmpty(sessionId))
        {
            sessionId = Guid.NewGuid().ToString("N");
            context.Response.Cookies.Append(SessionCookieName, sessionId, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                MaxAge = TimeSpan.FromDays(7)
            });
        }

        context.Items["SessionId"] = sessionId;

        context.Items["UserAgent"] = context.Request.Headers.UserAgent.ToString();
        context.Items["ClientIP"] = context.Connection.RemoteIpAddress?.ToString();
        context.Items["AcceptLanguage"] = context.Request.Headers.AcceptLanguage.ToString();
        context.Items["Referer"] = context.Request.Headers.Referer.ToString();
        context.Items["UtmSource"] = context.Request.Query["utm_source"].ToString();
        context.Items["UtmMedium"] = context.Request.Query["utm_medium"].ToString();
        context.Items["UtmCampaign"] = context.Request.Query["utm_campaign"].ToString();
        context.Items["UtmTerm"] = context.Request.Query["utm_term"].ToString();
        context.Items["UtmContent"] = context.Request.Query["utm_content"].ToString();

        await _next(context);
    }
}

public static class SessionMiddlewareExtensions
{
    public static string GetSessionId(this HttpContext context)
        => context.Items["SessionId"] as string ?? throw new InvalidOperationException("Session not initialized");
}
