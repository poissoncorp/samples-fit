using Raven.Client.Documents;
using Raven.Client.Documents.Operations.OngoingTasks;
using Raven.Client.ServerWide.Operations.OngoingTasks;

namespace FitAssistant.Backend.Features.PipelineTelemetry;

public static class OlapEtlFlush
{
    public static async Task<bool> FlushAsync(IDocumentStore store, CancellationToken ct = default)
    {
        var taskInfo = await store.Maintenance.SendAsync(
            new GetOngoingTaskInfoOperation(Constants.Etl.TrendsOlapEtlName, OngoingTaskType.OlapEtl), ct);
        if (taskInfo == null) return false;

        await store.Maintenance.SendAsync(
            new ToggleOngoingTaskStateOperation(taskInfo.TaskId, OngoingTaskType.OlapEtl, disable: true), ct);
        await Task.Delay(300, ct);
        await store.Maintenance.SendAsync(
            new ToggleOngoingTaskStateOperation(taskInfo.TaskId, OngoingTaskType.OlapEtl, disable: false), ct);
        return true;
    }
}
