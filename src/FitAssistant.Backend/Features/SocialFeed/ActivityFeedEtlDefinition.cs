namespace FitAssistant.Backend.Features.SocialFeed;

internal static class ActivityFeedEtlDefinition
{
    public static string TransformScript => $$"""
if (!this.EndTime) return;

var actor = load(this.UserProfileId);
if (!actor || !actor.Follows || actor.Follows.length === 0) return;

var durationMinutes = Math.round((new Date(this.EndTime).getTime() - new Date(this.StartTime).getTime()) / 60000);

for (var i = 0; i < actor.Follows.length; i++) {
    loadTo{{Constants.Etl.ActivityFeedQueueName}}({
        recipientUserId: actor.Follows[i],
        actorUserId:     this.UserProfileId,
        sessionId:       id(this),
        type:            this.Type,
        durationMinutes: durationMinutes,
        caloriesBurned:  this.CaloriesBurned,
        startTime:       this.StartTime
    });
}
""";
}
