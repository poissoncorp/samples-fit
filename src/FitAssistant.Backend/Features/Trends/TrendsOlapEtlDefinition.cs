namespace FitAssistant.Backend.Features.Trends;

internal static class TrendsOlapEtlDefinition
{
    public const string TransformScript = """
if (!this.EndTime) return;

var t = new Date(this.StartTime);
var year  = t.getUTCFullYear();
var month = t.getUTCMonth() + 1;
var day   = t.getUTCDate();

var durationMinutes = Math.round((new Date(this.EndTime).getTime() - t.getTime()) / 60000);

loadToexercises(partitionBy(['year', year], ['month', month], ['day', day]), {
    userId:          this.UserProfileId,
    exerciseType:    this.Type,
    durationMinutes: durationMinutes,
    caloriesBurned:  this.CaloriesBurned,
    startTime:       this.StartTime
});
""";
}
