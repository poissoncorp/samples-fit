using System.Text.Json;
using FitAssistant.Backend.Features.Coach;
using Raven.Client.Documents.Operations.AI;
using Raven.Client.Documents.Operations.AI.Agents;
using Raven.Client.Documents.Operations.ConnectionStrings;

namespace FitAssistant.Backend.RavenSetup;

public partial class RavenInitializer
{
    private async Task ConfigureAiAgent()
    {
        var apiKey = Environment.GetEnvironmentVariable(Constants.EnvVars.OpenAiApiKey);
        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogWarning(
                "OpenAI API key not set ({EnvVar}). AI Agent features will not be available. " +
                "Set the environment variable and restart to enable AI features.",
                Constants.EnvVars.OpenAiApiKey);
            return;
        }

        var nanoConn = new AiConnectionString
        {
            Name = Constants.Agent.NanoConnectionStringName,
            ModelType = AiModelType.Chat,
            OpenAiSettings = new OpenAiSettings
            {
                ApiKey = apiKey,
                Model = "gpt-5-nano",
                Endpoint = "https://api.openai.com/v1"
            }
        };
        var miniConn = new AiConnectionString
        {
            Name = Constants.Agent.MiniConnectionStringName,
            ModelType = AiModelType.Chat,
            OpenAiSettings = new OpenAiSettings
            {
                ApiKey = apiKey,
                Model = "gpt-5-mini",
                Endpoint = "https://api.openai.com/v1"
            }
        };
        var fullConn = new AiConnectionString
        {
            Name = Constants.Agent.FullConnectionStringName,
            ModelType = AiModelType.Chat,
            OpenAiSettings = new OpenAiSettings
            {
                ApiKey = apiKey,
                Model = "gpt-4.1",
                Endpoint = "https://api.openai.com/v1"
            }
        };
        await _store.Maintenance.SendAsync(new PutConnectionStringOperation<AiConnectionString>(nanoConn));
        await _store.Maintenance.SendAsync(new PutConnectionStringOperation<AiConnectionString>(miniConn));
        await _store.Maintenance.SendAsync(new PutConnectionStringOperation<AiConnectionString>(fullConn));

        _logger.LogInformation("AI connection strings registered (Nano: gpt-5-nano, Mini: gpt-5-mini, Full: gpt-4.1).");

        await UpsertSubAgentAsync(
            id: Constants.Agent.FoodPhotoSubAgentId,
            connection: Constants.Agent.NanoConnectionStringName,
            prompt: Prompts.FoodPhoto,
            sample: CoachAgentDefinition.FoodPhotoSample(),
            actions: CoachAgentDefinition.FoodPhotoActions());

        await UpsertSubAgentAsync(
            id: Constants.Agent.MotivateSubAgentId,
            connection: Constants.Agent.MiniConnectionStringName,
            prompt: Prompts.Motivate,
            sample: CoachAgentDefinition.MotivateSample(),
            queries: CoachAgentDefinition.UserScopedQueries());

        await UpsertSubAgentAsync(
            id: Constants.Agent.ExplainWorkoutSubAgentId,
            connection: Constants.Agent.NanoConnectionStringName,
            prompt: Prompts.ExplainWorkout,
            sample: CoachAgentDefinition.ExplainWorkoutSample(),
            queries: CoachAgentDefinition.UserScopedQueries());

        await UpsertSubAgentAsync(
            id: Constants.Agent.CalorieEstimatorSubAgentId,
            connection: Constants.Agent.NanoConnectionStringName,
            prompt: Prompts.CalorieEstimator,
            sample: CoachAgentDefinition.CalorieEstimatorSample(),
            queries: CoachAgentDefinition.ProfileOnlyQuery());

        var chatAgent = new AiAgentConfiguration(
            Constants.Agent.Id,
            Constants.Agent.MiniConnectionStringName,
            Prompts.CoachParent)
        {
            SampleObject = JsonSerializer.Serialize(CoachAgentDefinition.ParentSample()),
            Parameters = CoachAgentDefinition.Parameters(),
            Queries    = CoachAgentDefinition.UserScopedQueries(),
            Actions    = CoachAgentDefinition.Actions(),
            SubAgents  = CoachAgentDefinition.SubAgents()
        };
        await UpsertAgentAsync(chatAgent);
        _logger.LogInformation("Parent agent '{Id}' configured (gpt-5-mini) with {SubCount} sub-agent(s), {QueryCount} queries, {ActionCount} actions.",
            Constants.Agent.Id, chatAgent.SubAgents?.Count ?? 0, chatAgent.Queries.Count, chatAgent.Actions.Count);

        await ConfigureDailyGoalsGenAiTask();
        await ConfigureAutoCoachGenAiTask();
    }

    private async Task UpsertAgentAsync(AiAgentConfiguration agent)
    {
        try { await _store.AI.DeleteAgentAsync(agent.Identifier); }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "DeleteAgent for '{Id}' returned an error — proceeding with create.", agent.Identifier);
        }
        await _store.AI.CreateAgentAsync(agent);
    }

    private async Task UpsertSubAgentAsync(
        string id, string connection, string prompt, object sample,
        List<AiAgentToolQuery>? queries = null, List<AiAgentToolAction>? actions = null)
    {
        var agent = new AiAgentConfiguration(id, connection, prompt)
        {
            SampleObject = JsonSerializer.Serialize(sample),
            Parameters   = CoachAgentDefinition.Parameters(),
            Queries      = queries ?? [],
            Actions      = actions ?? [],
        };
        await UpsertAgentAsync(agent);
        _logger.LogInformation("Sub-agent '{Id}' configured ({Connection}).", id, connection);
    }
}
