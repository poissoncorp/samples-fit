using FitAssistant.Backend.Startup;

var builder = WebApplication.CreateBuilder(args);

builder.AddFitAssistantBackend();

var app = builder.Build();

app.UseFitAssistantBackend();

app.Run();
