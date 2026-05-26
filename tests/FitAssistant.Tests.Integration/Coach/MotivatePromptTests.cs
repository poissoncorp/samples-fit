using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Coach;

/// <summary>
/// A motivate-style chat prompt reaches the <c>fit-motivate</c> sub-agent
/// through the parent agent's own routing — no API-side intent gate (a Free
/// user can ask too; the cost gate moved to the auto-coach GenAI task
/// script, see ADR-0002). The Phase A "no-key fallback" path is covered
/// generically by <c>TextChatTests</c>; this file only tests the Phase B
/// path where the agent actually runs.
/// </summary>
[Collection(AppHostCollection.Name)]
public sealed class MotivatePromptTests(AppHostFixture app)
{
    [SkippableFact]
    [Trait("phase", "B")]
    public async Task Motivate_prompt_streams_agent_reply()
    {
        Skip.IfNot(app.HasOpenAiKey, "Requires OPENAI_API_KEY.");

        var userId = await TestData.CreateUser(app.BackendClient, isPremium: true);

        // Motivate flow: parent → fit-motivate sub-agent → 6 RQL queries →
        // digest → parent prose. Many round-trips per ADR-0002. The shared
        // BackendClient's 2-minute timeout is too tight; fresh client with
        // longer ceiling.
        using var client = new HttpClient
        {
            BaseAddress = app.BackendClient.BaseAddress,
            Timeout     = TimeSpan.FromMinutes(4),
        };
        using var form = new MultipartFormDataContent
        {
            { new StringContent("Motivate me — pep talk based on my last week."), "Message" },
            { new StringContent(userId),                                          "UserId"  },
        };
        var resp = await client.PostAsync("/api/chat", form);
        resp.EnsureSuccessStatusCode();

        var body = await resp.Content.ReadAsStringAsync();
        body.Should().Contain("event: final");
    }
}
