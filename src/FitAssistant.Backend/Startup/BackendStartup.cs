using FitAssistant.Backend.Configuration;
using FitAssistant.Backend.Features.ApiUsage.Application.Exception;
using FitAssistant.Backend.Features.ApiUsage.Application.Usage;
using FitAssistant.Backend.Features.LiveWorkouts;
using FitAssistant.Backend.Features.DailyGoals;
using FitAssistant.ServiceDefaults;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using Raven.Client.Documents;
using Raven.Client.Documents.Session;
using FitAssistant.Backend.Features.ApiUsage;
using FitAssistant.Backend.Features.Coach;
using FitAssistant.Backend.Features.PipelineTelemetry;
using FitAssistant.Backend.Features.Simulation;
using FitAssistant.Backend.Features.Trends;
using FitAssistant.Backend.RavenSetup;

namespace FitAssistant.Backend.Startup;

public static class BackendStartup
{
    public static WebApplicationBuilder AddFitAssistantBackend(this WebApplicationBuilder builder)
    {
        builder.AddServiceDefaults();
        builder.AddRavenDBClient("FitAssistant");

        var minioConn = builder.Configuration.GetConnectionString("minio")
                        ?? throw new InvalidOperationException("ConnectionStrings:minio not set");
        builder.Services.AddSingleton(Options.Create(MinioOptions.Parse(minioConn)));

        builder.Services.AddScoped<IAsyncDocumentSession>(sp =>
            sp.GetRequiredService<IDocumentStore>().OpenAsyncSession());

        builder.Services.AddSingleton<IConnection>(_ =>
        {
            var conn = builder.Configuration.GetConnectionString("rabbit")
                       ?? throw new InvalidOperationException("ConnectionStrings:rabbit not set");
            return new ConnectionFactory { Uri = new Uri(conn) }
                .CreateConnectionAsync().GetAwaiter().GetResult();
        });

        builder.Services.AddControllers();

        builder.Services.AddHostedService<MinioInitializer>();
        builder.Services.AddSingleton<RavenInitializer>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<RavenInitializer>());

        builder.Services.AddSingleton<GlobalApiUsageLimiter>();
        builder.Services.AddSingleton<SessionApiUsageLimiter>();
        builder.Services.AddSingleton<GlobalApiUsageTracker>();
        builder.Services.AddSingleton<SessionApiUsageTracker>();
        builder.Services.AddSingleton<FoodEntryService>();
        builder.Services.AddSingleton<ExerciseLogService>();
        builder.Services.AddSingleton<SimulationService>();
        builder.Services.AddSingleton<PipelineStatsAggregator>();
        builder.Services.AddSingleton<TrendsQueryService>();
        builder.Services.AddSingleton<PipelineActivityBuffer>();

        builder.Services.AddSingleton<LiveWorkoutsStream>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<LiveWorkoutsStream>());
        builder.Services.AddHostedService<AutoFulfillGoalsFromActivity>();
        builder.Services.AddHostedService<FanOutFulfilledGoals>();

        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.AllowAnyOrigin()
                    .AllowAnyMethod()
                    .AllowAnyHeader();
            });
        });

        return builder;
    }

    public static WebApplication UseFitAssistantBackend(this WebApplication app)
    {
        app.UseDeveloperExceptionPage();
        app.MapDefaultEndpoints();
        app.UseCors();
        app.UseMiddleware<SessionMiddleware>();
        app.UseFitAssistantErrors();
        app.UseWhen(
            ctx => ctx.Request.Path.StartsWithSegments("/api/chat"),
            branch => branch.UseMiddleware<AiUsageLimiterMiddleware>());
        app.MapControllers();
        return app;
    }

    private static void UseFitAssistantErrors(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            try
            {
                await next();
            }
            catch (GlobalRateLimitExceededException ex)
            {
                context.Response.StatusCode = 429;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { error = ex.Message, scope = "global" });
            }
            catch (SessionRateLimitExceededException ex)
            {
                context.Response.StatusCode = 429;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { error = ex.Message, scope = "session" });
            }
        });
    }
}
