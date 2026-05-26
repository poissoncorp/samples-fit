namespace FitAssistant.Backend;

public static class Constants
{
    public const string DatabaseName = "FitAssistant";

    public static class EnvVars
    {
        public const string OpenAiApiKey = "OPENAI_API_KEY";
        public const string RavenLicense = "RAVEN_FIT_RAVEN_LICENSE";

        /// <summary>Global cap on AI requests in a rolling 15-minute window
        /// (samples-hr-style time-series limiter). Default 100.</summary>
        public const string MaxGlobalRequestsPer15Minutes = "FIT_ASSISTANT_MAX_GLOBAL_REQUESTS_PER_15_MINUTES";

        /// <summary>Per-session cap on AI requests in a rolling 30-second window.
        /// Default 5 — "you're typing too fast" friction-only, not a real cost gate.</summary>
        public const string MaxSessionRequestsPer30Seconds = "FIT_ASSISTANT_MAX_SESSION_REQUESTS_PER_30_SECONDS";
    }

    public static class TimeSeries
    {
        public const string HeartRates = "HeartRates";

        /// <summary>One entry per AI request (value=1), appended by the usage
        /// trackers on both <c>GlobalApiUsage</c> and <c>SessionApiUsage</c>
        /// docs. Read by the limiters via <c>GetTimeSeriesOperation</c> over
        /// the relevant rolling window.</summary>
        public const string Requests = "Requests";
    }

    public static class DocumentIds
    {
        public const string GlobalApiUsage = "GlobalApiUsage/global";
        public static string SessionApiUsage(string sessionId) => $"SessionApiUsage/{sessionId}";
    }

    public static class Agent
    {
        public const string Id = "fit-assistant";
        public const string DisplayName = "Fit Assistant";

        /// <summary>Reasoning tier — gpt-5-mini. Used by the parent chat agent and the <c>fit-motivate</c> sub-agent.</summary>
        public const string MiniConnectionStringName = "Fit Assistant AI Mini";

        /// <summary>Cheap tier — gpt-5-nano. Used by the <c>explain-workout</c> and <c>food-photo-analyzer</c> sub-agents.</summary>
        public const string NanoConnectionStringName = "Fit Assistant AI Nano";

        /// <summary>Full tier — gpt-4.1 (non-reasoning). Used by the <c>daily-goals</c>
        /// GenAI Task because gpt-5-mini's reasoning chains push past RavenDB's
        /// agent-runtime timeout when juggling 3 tool queries + structured-Predicate
        /// output. gpt-4.1 has comparable structured-output / tool-calling capability
        /// with one-shot latency — no 1500-2000 reasoning-token internal CoT.</summary>
        public const string FullConnectionStringName = "Fit Assistant AI Full";

        /// <summary>Vision sub-agent (nano). Reads attached image, calls <c>LogFoodEntry</c>. Available to both tiers.</summary>
        public const string FoodPhotoSubAgentId = "food-photo-analyzer";

        /// <summary>Data-digester sub-agent (mini). Returns a <c>MotivateDigest</c>; the parent writes the prose. Reached from the Motivate Me chip and from any "motivate me / pep talk" prompt — the parent agent decides whether to delegate based on the prompt.</summary>
        public const string MotivateSubAgentId = "fit-motivate";

        /// <summary>Per-session data-digester sub-agent (nano). Returns a <c>WorkoutExplanationDigest</c>; the parent narrates.</summary>
        public const string ExplainWorkoutSubAgentId = "explain-workout";

        /// <summary>Calorie-estimator sub-agent (nano). Approximates kcal-burned from {Type, DurationMinutes} + the current user's profile (weight, age). The parent delegates whenever the user logs an exercise without specifying calories. Available to both tiers — estimation is a free feature.</summary>
        public const string CalorieEstimatorSubAgentId = "calorie-estimator";

    }

    public static class RemoteAttachments
    {
        /// <summary>Destination identifier — referenced by RemoteAttachmentParameters.Identifier.</summary>
        public const string DestinationId = "minio";

        /// <summary>Bucket name — created on startup by MinioInitializer if it doesn't exist.</summary>
        public const string BucketName = "fit-attachments";

        public const string AccessKey = "fitadmin";
        public const string SecretKey = "fitadmin123";
    }

    public static class GenAi
    {
        
        public const string DailyGoalsTaskName = "daily-goals";
        public const int DefaultDailyGoalsCadenceSeconds = 86_400;
        public const string AutoCoachTaskName = "auto-coach";
    }

    public static class Subscriptions
    {

        public const string GoalFulfilled = "goal-fulfilled";
        public const string GoalAutoFulfillFromExercise = "goal-auto-fulfill-from-exercise";
        public const string GoalAutoFulfillFromFood = "goal-auto-fulfill-from-food";
    }

    public static class Etl
    {
        public const string RabbitConnectionStringName = "rabbit-fit";

        public const string ActivityFeedEtlName = "activity-feed-etl";

        public const string ActivityFeedQueueName = "activity_feed";

       
        public const string TrendsOlapEtlName = "trends-olap-etl";

        /// <summary>S3-style connection string name (uses the same MinIO instance as Remote Attachments).</summary>
        public const string TrendsS3ConnectionStringName = "trends-s3";

        /// <summary>MinIO bucket holding the daily Parquet partitions for the OLAP ETL.</summary>
        public const string TrendsBucketName = "fit-trends";
    }


    public static string StripCollectionPrefix(string? documentId)
        => documentId?.Contains('/') == true ? documentId[(documentId.IndexOf('/') + 1)..] : documentId ?? "";

    public static string UserProfileId(string id)
    {
        id = Uri.UnescapeDataString(id);
        return id.Contains('/') ? id : $"UserProfiles/{id}";
    }

    public static readonly string[] FitnessGoals =
    [
        "Lose weight",
        "Build muscle",
        "Improve cardio endurance",
        "Maintain fitness",
        "Train for marathon",
        "General health"
    ];
}
