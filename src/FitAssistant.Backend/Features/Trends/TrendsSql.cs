namespace FitAssistant.Backend.Features.Trends;

/// <summary>
/// DuckDB SQL queries that the Trends tab fires against the OLAP ETL Parquet
/// output on MinIO. Pulled out of <see cref="TrendsQueryService"/> so the
/// engine plumbing (connection, locking, mapping) reads separately from the
/// queries themselves. Every string uses the literal placeholder
/// <c>{BUCKET}</c> for the MinIO bucket name; the service substitutes it on
/// each command.
/// </summary>
internal static class TrendsSql
{
    /// <summary>Top exercise types over the lookback window, ordered by
    /// session count. One <c>?</c> parameter: lookback start timestamp.</summary>
    public const string TrendingTypes = """
        SELECT exerciseType,
               COUNT(*)              AS sessionCount,
               SUM(caloriesBurned)   AS totalKcal,
               AVG(caloriesBurned)   AS avgKcalPerSession,
               AVG(durationMinutes)  AS avgMinutes
        FROM   read_parquet('s3://{BUCKET}/**/*.parquet', hive_partitioning=true)
        WHERE  startTime >= ?
        GROUP  BY exerciseType
        ORDER  BY sessionCount DESC, totalKcal DESC
        LIMIT  8
    """;

    /// <summary>Daily total volume (sessions + kcal) across all users. One
    /// <c>?</c> parameter: lookback start timestamp.
    /// <para>Alias is deliberately <c>bucket_day</c> not <c>day</c> —
    /// <c>hive_partitioning=true</c> surfaces <c>day</c> as a virtual partition
    /// column (the OLAP ETL writes <c>year/month/day=…</c> layout), and the
    /// original <c>AS day</c> alias produced a silent empty result set.</para>
    /// </summary>
    public const string DailyVolume = """
        SELECT date_trunc('day', startTime) AS bucket_day,
               COUNT(*)                     AS sessions,
               SUM(caloriesBurned)          AS totalKcal
        FROM   read_parquet('s3://{BUCKET}/**/*.parquet', hive_partitioning=true)
        WHERE  startTime >= ?
        GROUP  BY bucket_day
        ORDER  BY bucket_day
    """;

    /// <summary>Cross-user percentile + kcal-per-session delta for one user.
    /// Four <c>?</c> parameters in order: per_user.WHERE, others.WHERE startTime,
    /// others.WHERE userId !=, final WHERE r.userId =.
    /// <para><c>CUME_DIST</c> instead of <c>PERCENT_RANK</c>: small N + likely
    /// ties (seed gives every user the same session count) collapse a tie
    /// group to 0% with <c>PERCENT_RANK</c>. <c>CUME_DIST</c> lands tied
    /// users at the top of their band.</para>
    /// </summary>
    public const string PeerStanding = """
        WITH per_user AS (
            SELECT userId,
                   SUM(caloriesBurned) AS totalKcal,
                   COUNT(*)            AS sessions,
                   AVG(caloriesBurned) AS avgKcal
            FROM   read_parquet('s3://{BUCKET}/**/*.parquet', hive_partitioning=true)
            WHERE  startTime >= ?
            GROUP  BY userId
        ),
        ranked AS (
            SELECT userId,
                   avgKcal,
                   CUME_DIST() OVER (ORDER BY totalKcal) * 100 AS kcalPct,
                   CUME_DIST() OVER (ORDER BY sessions)  * 100 AS sessionsPct,
                   CAST(COUNT(*) OVER () AS BIGINT)            AS totalMembers
            FROM   per_user
        ),
        others AS (
            SELECT AVG(caloriesBurned) AS otherAvgKcal
            FROM   read_parquet('s3://{BUCKET}/**/*.parquet', hive_partitioning=true)
            WHERE  startTime >= ? AND userId != ?
        )
        SELECT r.kcalPct,
               r.sessionsPct,
               r.totalMembers,
               r.avgKcal,
               o.otherAvgKcal
        FROM   ranked r, others o
        WHERE  r.userId = ?
    """;

    /// <summary>Per-exercise-type averages for one user vs the platform.
    /// Three <c>?</c> parameters: platform.WHERE, yours.WHERE startTime, yours.WHERE userId.</summary>
    public const string UserVsPlatform = """
        WITH platform AS (
            SELECT exerciseType,
                   AVG(caloriesBurned)  AS platformAvgKcal,
                   AVG(durationMinutes) AS platformAvgMinutes
            FROM   read_parquet('s3://{BUCKET}/**/*.parquet', hive_partitioning=true)
            WHERE  startTime >= ?
            GROUP  BY exerciseType
        ),
        yours AS (
            SELECT exerciseType,
                   AVG(caloriesBurned)  AS yourAvgKcal,
                   AVG(durationMinutes) AS yourAvgMinutes,
                   COUNT(*) AS yourSessions
            FROM   read_parquet('s3://{BUCKET}/**/*.parquet', hive_partitioning=true)
            WHERE  startTime >= ?
              AND  userId = ?
            GROUP  BY exerciseType
        )
        SELECT y.exerciseType,
               y.yourSessions,
               y.yourAvgKcal,
               p.platformAvgKcal,
               y.yourAvgMinutes,
               p.platformAvgMinutes
        FROM   yours y
        JOIN   platform p USING (exerciseType)
        ORDER  BY y.yourSessions DESC
    """;

    /// <summary>Total Parquet row count across the bucket — feeds the
    /// pipeline HUD's "DuckDB sees N rows" readout.</summary>
    public const string TotalRowCount = """
        SELECT COUNT(*)
        FROM   read_parquet('s3://{BUCKET}/**/*.parquet', hive_partitioning=true)
    """;
}
