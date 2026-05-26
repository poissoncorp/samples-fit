namespace FitAssistant.Backend.Configuration;

/// <summary>MinIO connection settings — parsed once at startup from Aspire's
/// <c>ConnectionStrings:minio</c> (semicolon-delimited
/// <c>Host=...;Port=...;Username=...;Password=...</c>). Backend talks to MinIO
/// via the container-network <see cref="Endpoint"/>; the Endpoint is also
/// cargo-forwarded into RavenDB's S3 destinations and the OLAP ETL.</summary>
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
            Endpoint:  $"http://{kv["Host"]}:{kv["Port"]}",
            AccessKey: kv["Username"],
            SecretKey: kv["Password"]);
    }
}
