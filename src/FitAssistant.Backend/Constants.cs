namespace FitAssistant.Backend;

public static class Constants
{
    public const string DatabaseName = "FitAssistant";

    public static class EnvVars
    {
        public const string OpenAiApiKey = "OPENAI_API_KEY";
        public const string RavenLicense = "RAVEN_FIT_RAVEN_LICENSE";

        /// <summary>Global cap on AI requests in a rolling 15-minute window. Default 100.</summary>
        public const string MaxGlobalRequestsPer15Minutes = "FIT_ASSISTANT_MAX_GLOBAL_REQUESTS_PER_15_MINUTES";

        /// <summary>Per-session cap on AI requests in a rolling 30-second window. Default 5.</summary>
        public const string MaxSessionRequestsPer30Seconds = "FIT_ASSISTANT_MAX_SESSION_REQUESTS_PER_30_SECONDS";
    }

    public static class TimeSeries
    {
        public const string HeartRates = "HeartRates";
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

        public const string MiniConnectionStringName = "Fit Assistant AI Mini";

        public const string NanoConnectionStringName = "Fit Assistant AI Nano";

        public const string FullConnectionStringName = "Fit Assistant AI Full";

        public const string FoodPhotoSubAgentId = "food-photo-analyzer";

        public const string MotivateSubAgentId = "fit-motivate";

        public const string ExplainWorkoutSubAgentId = "explain-workout";

        public const string CalorieEstimatorSubAgentId = "calorie-estimator";

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
