using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents;
using Raven.Client.Documents.Operations.OngoingTasks;
using Raven.Client.ServerWide.Operations.OngoingTasks;

namespace FitAssistant.Backend.Features.Diagnostics;


[ApiController]
[Route("api/admin/genai-traces")]
public class GenAiDiagnosticsController : ControllerBase
{
    private readonly IDocumentStore _store;

    public GenAiDiagnosticsController(IDocumentStore store) => _store = store;

    [HttpGet("{taskName}")]
    public async Task<IActionResult> GetTraces(string taskName, int limit = 10)
    {
        using var session = _store.OpenAsyncSession();

        var take = Math.Clamp(limit, 1, 100);
        var atConversations = await session.Advanced
            .AsyncRawQuery<object>(@"from ""@conversations"" order by ""@metadata.@last-modified"" desc")
            .Take(take).ToListAsync();
        var conversations = await session.Advanced
            .AsyncRawQuery<object>(@"from Conversations order by ""@metadata.@last-modified"" desc")
            .Take(take).ToListAsync();

        var taskInfo = await _store.Maintenance.SendAsync(
            new GetOngoingTaskInfoOperation(taskName, OngoingTaskType.GenAi));

        return Ok(new
        {
            taskName,
            taskInfo,
            atConversationsCount = atConversations.Count,
            atConversations,
            conversationsCount   = conversations.Count,
            conversations,
        });
    }
}
