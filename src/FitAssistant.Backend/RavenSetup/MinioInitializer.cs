using Amazon.S3;
using Amazon.S3.Model;
using FitAssistant.Backend.Configuration;
using Microsoft.Extensions.Options;

namespace FitAssistant.Backend.RavenSetup;

public class MinioInitializer : IHostedService
{
    private readonly ILogger<MinioInitializer> _logger;
    private readonly MinioOptions _minio;

    public MinioInitializer(ILogger<MinioInitializer> logger, IOptions<MinioOptions> minio)
    {
        _logger = logger;
        _minio = minio.Value;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var s3 = new AmazonS3Client(
                _minio.AccessKey,
                _minio.SecretKey,
                new AmazonS3Config
                {
                    ServiceURL     = _minio.Endpoint,
                    ForcePathStyle = true,
                    AuthenticationRegion = "us-east-1"
                });

            foreach (var bucket in new[]
            {
                Constants.RemoteAttachments.BucketName, // photo storage
                Constants.Etl.TrendsBucketName,         // Parquet for OLAP ETL → DuckDB trends queries
            })
            {
                try
                {
                    await s3.PutBucketAsync(new PutBucketRequest { BucketName = bucket }, cancellationToken);
                    _logger.LogInformation("MinIO bucket '{Bucket}' ensured at {Url}.", bucket, _minio.Endpoint);
                }
                catch (AmazonS3Exception ex) when (
                    ex.ErrorCode == "BucketAlreadyOwnedByYou" ||
                    ex.ErrorCode == "BucketAlreadyExists")
                {
                    _logger.LogInformation("MinIO bucket '{Bucket}' already exists.", bucket);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Could not ensure MinIO bucket at {Url}. Remote Attachments may not work — " +
                "verify the 'minio' container is running and reachable.", _minio.Endpoint);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
