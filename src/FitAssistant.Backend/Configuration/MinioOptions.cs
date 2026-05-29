namespace FitAssistant.Backend.Configuration;

/// <summary>MinIO connection settings — parsed once at startup from Aspire's
/// <c>ConnectionStrings:minio</c> (<c>Endpoint=&lt;url&gt;;AccessKey=...;SecretKey=...</c>,
/// the shape the Aspire Minio integration emits). The same <see cref="Endpoint"/>
/// is cargo-forwarded into RavenDB's S3 destinations and the OLAP ETL.</summary>
public sealed record MinioOptions(string Endpoint, string AccessKey, string SecretKey)
{
    public static MinioOptions Parse(string connectionString)
    {
        var kv = connectionString
            .Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0].Trim(), p => p[1].Trim(), StringComparer.OrdinalIgnoreCase);

        return new MinioOptions(
            Endpoint:  kv["Endpoint"],
            AccessKey: kv["AccessKey"],
            SecretKey: kv["SecretKey"]);
    }
}
