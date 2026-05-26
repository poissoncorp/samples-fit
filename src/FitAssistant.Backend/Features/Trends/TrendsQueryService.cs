using DuckDB.NET.Data;
using FitAssistant.Backend.Configuration;
using Microsoft.Extensions.Options;

namespace FitAssistant.Backend.Features.Trends;

public class TrendsQueryService : IAsyncDisposable
{
    private readonly ILogger<TrendsQueryService> _logger;
    private readonly DuckDBConnection _conn;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly bool _ready;
    private readonly string _bucket = Constants.Etl.TrendsBucketName;

    // Query-count telemetry for the pipeline HUD's "DuckDB N q" readout.
    private long _queryCount;
    public long QueryCount => Interlocked.Read(ref _queryCount);
    public bool IsReady => _ready;

    public TrendsQueryService(IOptions<MinioOptions> minio, ILogger<TrendsQueryService> logger)
    {
        _logger = logger;

        // In-memory DuckDB instance. The "database" itself is empty — the data
        // lives in MinIO. DuckDB is just the query engine.
        _conn = new DuckDBConnection("Data Source=:memory:");

        try
        {
            _conn.Open();
            ConfigureHttpfs(minio.Value);
            _ready = true;
            _logger.LogInformation("DuckDB ready — queries will read 's3://{Bucket}/**/*.parquet'.", _bucket);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "DuckDB / httpfs bootstrap failed. /api/trends will return empty payloads.");
        }
    }

    private void ConfigureHttpfs(MinioOptions minio)
    {
        var hostPort = minio.Endpoint.Replace("http://", "").Replace("https://", "").TrimEnd('/');

        Exec("INSTALL httpfs;");
        Exec("LOAD httpfs;");
        // Path-style + no SSL is the standard MinIO contract.
        Exec($"SET s3_endpoint='{hostPort}';");
        Exec("SET s3_use_ssl=false;");
        Exec("SET s3_url_style='path';");
        Exec($"SET s3_access_key_id='{minio.AccessKey}';");
        Exec($"SET s3_secret_access_key='{minio.SecretKey}';");
        Exec("SET s3_region='us-east-1';");
    }

    private void Exec(string sql)
    {
        using var cmd = _conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    // ---- Public query surface ------------------------------------------------

    /// <summary>Top exercise types over the last <paramref name="days"/> days, ordered by session count.</summary>
    public List<TrendingType> GetTrendingExerciseTypes(int days)
        => Query(days, TrendsSql.TrendingTypes, reader => new TrendingType(
            ExerciseType:        reader.GetString(0),
            SessionCount:        reader.GetInt64(1),
            TotalCaloriesBurned: reader.IsDBNull(2) ? 0 : reader.GetInt64(2),
            AvgKcalPerSession:   reader.IsDBNull(3) ? 0 : reader.GetDouble(3),
            AvgDurationMinutes:  reader.IsDBNull(4) ? 0 : reader.GetDouble(4)));

    /// <summary>Daily total volume (sessions + kcal) across all users.</summary>
    public List<DailyVolumePoint> GetDailyVolumeSeries(int days)
        => Query(days, TrendsSql.DailyVolume, reader => new DailyVolumePoint(
            Day:      DateOnly.FromDateTime(reader.GetDateTime(0)),
            Sessions: reader.GetInt64(1),
            TotalKcal: reader.IsDBNull(2) ? 0 : reader.GetInt64(2)));

    /// <summary>
    /// Peer-rank rollup for the "Your standing" headline. PERCENT_RANK is
    /// 0..1 in SQL — multiplied by 100 to match the 0..100 gauge contract.
    /// The kcal-per-session delta excludes the caller so a small-N demo
    /// doesn't bias toward zero.
    /// </summary>
    public UserPeerStanding? GetUserPeerStanding(string userId, int days)
    {
        if (!_ready) return null;
        var since = DateTime.UtcNow.AddDays(-days);

        var sql = TrendsSql.PeerStanding.Replace("{BUCKET}", _bucket);

        _lock.Wait();
        try
        {
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.Add(new DuckDBParameter(since));    // per_user.WHERE
            cmd.Parameters.Add(new DuckDBParameter(since));    // others.WHERE startTime
            cmd.Parameters.Add(new DuckDBParameter(userId));   // others.WHERE userId !=
            cmd.Parameters.Add(new DuckDBParameter(userId));   // final WHERE r.userId =
            using var reader = (DuckDBDataReader)cmd.ExecuteReader();
            if (!reader.Read()) return null;

            var yourAvg  = reader.IsDBNull(3) ? 0 : reader.GetDouble(3);
            var otherAvg = reader.IsDBNull(4) ? 0 : reader.GetDouble(4);
            double? deltaPct = otherAvg > 0
                ? ((yourAvg - otherAvg) / otherAvg) * 100
                : null;

            Interlocked.Increment(ref _queryCount);
            return new UserPeerStanding(
                KcalPercentile:         reader.IsDBNull(0) ? 0 : reader.GetDouble(0),
                SessionsPercentile:     reader.IsDBNull(1) ? 0 : reader.GetDouble(1),
                TotalMembers:           reader.IsDBNull(2) ? 0 : reader.GetInt64(2),
                KcalPerSessionDeltaPct: deltaPct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "DuckDB peer standing query failed.");
            return null;
        }
        finally { _lock.Release(); }
    }

    /// <summary>
    /// Per-exercise-type averages for one user vs. platform-wide averages.
    /// Useful for "your cycling is in the top 25% by kcal burned" framing on
    /// the Trends tab.
    /// </summary>
    public List<UserVsPlatformRow> GetUserVsPlatformAverages(string userId, int days)
    {
        if (!_ready) return new();
        var since = DateTime.UtcNow.AddDays(-days);
        var sql = TrendsSql.UserVsPlatform.Replace("{BUCKET}", _bucket);

        _lock.Wait();
        try
        {
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.Add(new DuckDBParameter(since));
            cmd.Parameters.Add(new DuckDBParameter(since));
            cmd.Parameters.Add(new DuckDBParameter(userId));
            Interlocked.Increment(ref _queryCount);
            return Read(cmd, reader => new UserVsPlatformRow(
                ExerciseType:       reader.GetString(0),
                YourSessions:       reader.GetInt64(1),
                YourAvgKcal:        reader.IsDBNull(2) ? 0 : reader.GetDouble(2),
                PlatformAvgKcal:    reader.IsDBNull(3) ? 0 : reader.GetDouble(3),
                YourAvgMinutes:     reader.IsDBNull(4) ? 0 : reader.GetDouble(4),
                PlatformAvgMinutes: reader.IsDBNull(5) ? 0 : reader.GetDouble(5)));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "DuckDB user-vs-platform query failed.");
            return new();
        }
        finally { _lock.Release(); }
    }

    // ---- Internals -----------------------------------------------------------

    private List<T> Query<T>(int days, string sqlTemplate, Func<DuckDBDataReader, T> map)
    {
        if (!_ready) return new();
        var since = DateTime.UtcNow.AddDays(-days);

        _lock.Wait();
        try
        {
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = sqlTemplate.Replace("{BUCKET}", _bucket);
            cmd.Parameters.Add(new DuckDBParameter(since));
            Interlocked.Increment(ref _queryCount);
            return Read(cmd, map);
        }
        catch (Exception ex)
        {
            // "No files found" / "IO Error" can happen on a fresh stack
            // before OLAP ETL has flushed anything. Log + return empty so the
            // UI just renders "no data yet".
            _logger.LogDebug(ex, "DuckDB query returned no rows (likely empty bucket).");
            return new();
        }
        finally { _lock.Release(); }
    }

    /// <summary>
    /// Total Parquet row count across the entire <c>fit-trends</c> bucket. Drives
    /// the pipeline HUD's "DuckDB sees N rows" readout. Returns 0 (and logs at
    /// debug) when the bucket is empty.
    /// </summary>
    public long GetTotalRowCount()
    {
        if (!_ready) return 0;
        _lock.Wait();
        try
        {
            using var cmd = _conn.CreateCommand();
            cmd.CommandText = TrendsSql.TotalRowCount.Replace("{BUCKET}", _bucket);
            var result = cmd.ExecuteScalar();
            var total = result is null ? 0L : Convert.ToInt64(result);
            Interlocked.Increment(ref _queryCount);
            return total;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "DuckDB row-count query failed (likely empty bucket).");
            return 0;
        }
        finally { _lock.Release(); }
    }

    private static List<T> Read<T>(DuckDBCommand cmd, Func<DuckDBDataReader, T> map)
    {
        var rows = new List<T>();
        using var reader = (DuckDBDataReader)cmd.ExecuteReader();
        while (reader.Read())
        {
            rows.Add(map(reader));
        }
        return rows;
    }

    public ValueTask DisposeAsync()
    {
        _lock.Dispose();
        return _conn.DisposeAsync();
    }
}

public record TrendingType(
    string ExerciseType,
    long   SessionCount,
    long   TotalCaloriesBurned,
    double AvgKcalPerSession,
    double AvgDurationMinutes);

public record DailyVolumePoint(
    DateOnly Day,
    long     Sessions,
    long     TotalKcal);

public record UserVsPlatformRow(
    string ExerciseType,
    long   YourSessions,
    double YourAvgKcal,
    double PlatformAvgKcal,
    double YourAvgMinutes,
    double PlatformAvgMinutes);

public record UserPeerStanding(
    double  KcalPercentile,         // 0..100 — your rank by total kcal in the period
    double  SessionsPercentile,     // 0..100 — your rank by session count in the period
    long    TotalMembers,           // total members with any activity in the window
    double? KcalPerSessionDeltaPct); // your avg kcal/session vs the rest of the platform, null when no peers
