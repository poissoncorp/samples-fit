namespace FitAssistant.Backend.RavenSetup;

internal sealed record RavenSetupStep(string Name, Func<Task> Run, Action<ILogger, Exception>? OnError = null);
