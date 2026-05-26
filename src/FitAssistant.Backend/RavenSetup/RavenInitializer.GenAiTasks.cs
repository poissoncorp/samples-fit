using FitAssistant.Backend.Features.Coach;
using FitAssistant.Backend.Features.DailyGoals;
using Raven.Client.Documents.Operations.AI;
using Raven.Client.Documents.Operations.OngoingTasks;

namespace FitAssistant.Backend.RavenSetup;

public partial class RavenInitializer
{
    private async Task ConfigureDailyGoalsGenAiTask()
    {
        var cadenceSeconds = _config.GetValue(
            "FitAssistant:DailyGoalsCadenceSeconds",
            Constants.GenAi.DefaultDailyGoalsCadenceSeconds);
        var cadenceMs      = cadenceSeconds * 1000L;

        var config = new GenAiConfiguration
        {
            Name                 = Constants.GenAi.DailyGoalsTaskName,
            Identifier           = Constants.GenAi.DailyGoalsTaskName,
            ConnectionStringName = Constants.Agent.FullConnectionStringName,
            Disabled             = false,
            Collection           = "UserProfiles",
            GenAiTransformation  = new GenAiTransformation { Script = DailyGoalsGenAiDefinition.TransformScript },
            Prompt               = Prompts.DailyGoals,
            JsonSchema           = DailyGoalsGenAiDefinition.JsonSchema,
            UpdateScript         = DailyGoalsGenAiDefinition.UpdateScript((int)cadenceMs),
            Queries              = DailyGoalsGenAiDefinition.Queries(),
            EnableTracing        = true,
            MaxConcurrency       = 4,
        };

        await UpsertOngoingTaskAsync(
            Constants.GenAi.DailyGoalsTaskName, OngoingTaskType.GenAi,
            () => _store.Maintenance.SendAsync(new AddGenAiOperation(config)));
        _logger.LogInformation(
            "GenAI Task '{Name}' registered (cadence {CadenceSec}s, source: UserProfiles, model: gpt-5-mini, @ai-hashes dedup on context).",
            Constants.GenAi.DailyGoalsTaskName, cadenceSeconds);
    }

    private async Task ConfigureAutoCoachGenAiTask()
    {
        var config = new GenAiConfiguration
        {
            Name                 = Constants.GenAi.AutoCoachTaskName,
            Identifier           = Constants.GenAi.AutoCoachTaskName,
            ConnectionStringName = Constants.Agent.MiniConnectionStringName,
            Disabled             = false,
            Collection           = "ExerciseSessions",
            GenAiTransformation  = new GenAiTransformation { Script = AutoCoachGenAiDefinition.TransformScript },
            Prompt               = Prompts.AutoCoach,
            SampleObject         = AutoCoachGenAiDefinition.SampleOutput(),
            UpdateScript         = AutoCoachGenAiDefinition.UpdateScript,
            MaxConcurrency       = 4,
            EnableTracing        = true,
        };

        await UpsertOngoingTaskAsync(
            Constants.GenAi.AutoCoachTaskName, OngoingTaskType.GenAi,
            () => _store.Maintenance.SendAsync(new AddGenAiOperation(config)));
        _logger.LogInformation(
            "GenAI Task '{Name}' registered (source: ExerciseSessions, model: gpt-5-mini, tier-gated, no cooldown).",
            Constants.GenAi.AutoCoachTaskName);
    }
}
