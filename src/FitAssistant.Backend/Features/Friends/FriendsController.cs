using Microsoft.AspNetCore.Mvc;
using Raven.Client.Documents.Session;
using FitAssistant.Backend.Features.Users;

namespace FitAssistant.Backend.Features.Friends;

[ApiController]
[Route("api/friends")]
public class FriendsController(IAsyncDocumentSession session) : ControllerBase
{
    [HttpGet("{userId}")]
    public async Task<IActionResult> Get(string userId)
    {
        userId = Constants.UserProfileId(userId);
        var me = await session
            .Include<UserProfile>(u => u.Follows)
            .LoadAsync<UserProfile>(userId);
        if (me is null) return NotFound(new { error = "User not found." });

        var profiles = await session.LoadAsync<UserProfile>(me.Follows);
        var friends = me.Follows
            .Select(id => profiles.TryGetValue(id, out var p) ? p : null)
            .Where(p => p is not null)
            .Select(p => new { id = p!.Id, name = p.Name, isPremium = p.IsPremium, goal = p.FitnessGoal });

        return Ok(new { userId, friends });
    }

    [HttpPost("{userId}/follow/{otherUserId}")]
    public async Task<IActionResult> Follow(string userId, string otherUserId)
    {
        userId = Constants.UserProfileId(userId);
        otherUserId = Constants.UserProfileId(otherUserId);
        if (userId == otherUserId) return BadRequest(new { error = "Cannot follow yourself." });

        var me = await session.LoadAsync<UserProfile>(userId);
        if (me is null) return NotFound(new { error = "User not found." });

        if (!me.Follows.Contains(otherUserId)) me.Follows.Add(otherUserId);
        await session.SaveChangesAsync();

        return Ok(new { userId, follows = me.Follows });
    }

    [HttpDelete("{userId}/follow/{otherUserId}")]
    public async Task<IActionResult> Unfollow(string userId, string otherUserId)
    {
        userId = Constants.UserProfileId(userId);
        otherUserId = Constants.UserProfileId(otherUserId);
        var me = await session.LoadAsync<UserProfile>(userId);
        if (me is null) return NotFound(new { error = "User not found." });

        me.Follows.RemoveAll(id => id == otherUserId);
        await session.SaveChangesAsync();

        return Ok(new { userId, follows = me.Follows });
    }
}
