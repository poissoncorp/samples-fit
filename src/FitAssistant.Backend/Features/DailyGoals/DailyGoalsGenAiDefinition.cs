using System.Text.Json;
using Raven.Client.Documents.Operations.AI.Agents;
using FitAssistant.Backend.Features.HealthData;

namespace FitAssistant.Backend.Features.DailyGoals;

internal static class DailyGoalsGenAiDefinition
{
    public static string TransformScript => """
function roundToNearest(n, step) { return n == null ? null : Math.round(n / step) * step; }

var stripped     = id(this).split('/').pop();
var today        = new Date();
var todayKey     = today.toISOString().slice(0, 10);
var yesterdayKey = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
var yesterday    = load('DailyGoals/' + stripped + '/' + yesterdayKey);

var yesterdaySummary = null;
if (yesterday && yesterday.Goals) {
    yesterdaySummary = yesterday.Goals.map(function (g) {
        return { Text: g.Text, Fulfilled: g.Fulfilled };
    });
}

ai.genContext({
    userId:           id(this),
    FitnessGoal:      this.FitnessGoal,
    DailyCalorieGoal: this.DailyCalorieGoal,
    Birthday:         this.Birthday,
    WeightKg:         roundToNearest(this.WeightKg, 1),
    HeightCm:         roundToNearest(this.HeightCm, 5),
    ForDate:          todayKey,
    Yesterday:        yesterdaySummary ? JSON.stringify(yesterdaySummary) : null
});
""";

    public static string UpdateScript(int cadenceMs) => $$"""
var uid      = id(this);
var stripped = uid.indexOf('/') >= 0 ? uid.substring(uid.indexOf('/') + 1) : uid;
var today    = new Date().toISOString().slice(0, 10);
var nowMs    = Date.now();

var goals = $output.Goals.map(function (g) {
    return {
        Text:      g.Text,
        Fulfilled: false,
        Predicate: g.Predicate
    };
});

var goalsDocId = 'DailyGoals/' + stripped + '/' + today;
var expiresAt  = new Date(nowMs + 7 * 24 * 3600 * 1000).toISOString();

put(goalsDocId, {
    UserProfileId: uid,
    ForDate:       today,
    Motivation:    $output.Motivation || null,
    Goals:         goals,
    GeneratedAt:   new Date(nowMs).toISOString(),
    '@metadata': {
        '@collection': 'DailyGoals',
        '@expires':    expiresAt
    }
});

this['@metadata']['@refresh'] = new Date(nowMs + {{cadenceMs}}).toISOString();
""";

    public static List<AiAgentToolQuery> Queries()
    {
        var sinceSampleDate = DateTime.UtcNow.AddDays(-14).ToString("yyyy-MM-ddTHH:mm:ss.fffffff");
        return
        [
            new AiAgentToolQuery(
                "GetRecentExercises",
                "Recent exercise sessions for goal grounding.",
                "from ExerciseSessions where UserProfileId == $userId and StartTime >= $since order by StartTime desc")
            {
                ParametersSampleObject = JsonSerializer.Serialize(new { since = sinceSampleDate }),
            },
            new AiAgentToolQuery(
                "GetKcalBurnedByDay",
                "Per-day kcal-burned totals from the KcalBurnedByUserDay map-reduce index.",
                "from index 'KcalBurnedByUserDay' where UserProfileId == $userId and Day >= $since order by Day desc")
            {
                ParametersSampleObject = JsonSerializer.Serialize(new { since = sinceSampleDate }),
            },
            new AiAgentToolQuery(
                "GetTodayKcalIntake",
                "Today's kcal-intake total from the KcalIntakeByUserDay map-reduce index.",
                "from index 'KcalIntakeByUserDay' where UserProfileId == $userId and Day == $today")
            {
                ParametersSampleObject = JsonSerializer.Serialize(new
                {
                    today = DateTime.UtcNow.Date.ToString("yyyy-MM-ddTHH:mm:ss.fffffff")
                }),
            },
        ];
    }

    public const string JsonSchema = """
    {
      "name": "DailyGoalsOutput",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "Motivation": { "type": "string" },
          "Goals": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "Text": { "type": "string" },
                "Predicate": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "Type":   { "type": "string", "enum": ["BURN", "INTAKE"] },
                        "Amount": { "type": "integer" }
                      },
                      "required": ["Type", "Amount"],
                      "additionalProperties": false
                    },
                    { "type": "null" }
                  ]
                }
              },
              "required": ["Text", "Predicate"],
              "additionalProperties": false
            }
          }
        },
        "required": ["Motivation", "Goals"],
        "additionalProperties": false
      }
    }
    """;
}
