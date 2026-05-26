using System.Net.Http.Headers;
using System.Text;
using FitAssistant.Tests.Integration.Infrastructure;
using FluentAssertions;
using Xunit;

namespace FitAssistant.Tests.Integration.Coach;

[Collection(AppHostCollection.Name)]
public sealed class TextChatTests(AppHostFixture app)
{
    [SkippableFact]
    [Trait("phase", "A")]
    public async Task Chat_sse_emits_final_terminator_without_key()
    {
        Skip.If(app.HasOpenAiKey, "OPENAI_API_KEY is set — covered by Phase B.");

        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);
        var frames = await ReadSseFrames("Hello", userId);
        frames.Should().Contain(f => f.StartsWith("event: final"));
    }

    [SkippableFact]
    [Trait("phase", "B")]
    public async Task Chat_sse_streams_tokens_and_final_frame_when_key_set()
    {
        Skip.IfNot(app.HasOpenAiKey, "Requires OPENAI_API_KEY.");

        var userId = await TestData.CreateUser(app.BackendClient, isPremium: false);
        var frames = await ReadSseFrames("Give me one sentence of fitness advice.", userId);

        frames.Should().HaveCountGreaterThan(1);
        frames.Should().Contain(f => f.StartsWith("event: final"));
    }

    private async Task<List<string>> ReadSseFrames(string message, string userId, string? intent = null)
    {
        using var form = new MultipartFormDataContent
        {
            { new StringContent(message), "Message" },
            { new StringContent(userId),  "UserId"  },
        };
        if (intent is not null) form.Add(new StringContent(intent), "Intent");

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/chat") { Content = form };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));

        using var response = await app.BackendClient.SendAsync(
            request, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        response.Content.Headers.ContentType?.MediaType.Should().Be("text/event-stream");

        var frames = new List<string>();
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var reader = new StreamReader(stream);

        var buffer = new StringBuilder();
        while (await reader.ReadLineAsync() is { } line)
        {
            if (line.Length == 0)
            {
                if (buffer.Length > 0)
                {
                    frames.Add(buffer.ToString());
                    buffer.Clear();
                }
                continue;
            }
            buffer.AppendLine(line);
        }
        if (buffer.Length > 0) frames.Add(buffer.ToString());

        return frames;
    }
}
