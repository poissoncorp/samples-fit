using FitAssistant.Backend.Features.SocialFeed;
using FitAssistant.Backend.Features.Trends;
using Raven.Client.Documents.Operations.ConnectionStrings;
using Raven.Client.Documents.Operations.ETL;
using Raven.Client.Documents.Operations.ETL.OLAP;
using Raven.Client.Documents.Operations.ETL.Queue;
using Raven.Client.Documents.Operations.OngoingTasks;

namespace FitAssistant.Backend.RavenSetup;

public partial class RavenInitializer
{
    private async Task ConfigureQueueEtl()
    {
        var rabbitConn = _config.GetConnectionString("rabbit")
                         ?? throw new InvalidOperationException("ConnectionStrings:rabbit not set");

        var queueConn = new QueueConnectionString
        {
            Name                       = Constants.Etl.RabbitConnectionStringName,
            BrokerType                 = QueueBrokerType.RabbitMq,
            RabbitMqConnectionSettings = new RabbitMqConnectionSettings
            {
                ConnectionString = rabbitConn
            }
        };
        await _store.Maintenance.SendAsync(new PutConnectionStringOperation<QueueConnectionString>(queueConn));

        var etl = new QueueEtlConfiguration
        {
            Name                 = Constants.Etl.ActivityFeedEtlName,
            ConnectionStringName = Constants.Etl.RabbitConnectionStringName,
            BrokerType           = QueueBrokerType.RabbitMq,
            Transforms =
            [
                new Transformation
                {
                    Name        = "ActivityFanOut",
                    Collections = ["ExerciseSessions"],
                    Script      = ActivityFeedEtlDefinition.TransformScript
                }
            ],
            Queues =
            [
                new EtlQueue
                {
                    Name                     = Constants.Etl.ActivityFeedQueueName,
                    DeleteProcessedDocuments = false
                }
            ]
        };

        await UpsertOngoingTaskAsync(
            Constants.Etl.ActivityFeedEtlName, OngoingTaskType.QueueEtl,
            () => _store.Maintenance.SendAsync(new AddEtlOperation<QueueConnectionString>(etl)));

        _logger.LogInformation(
            "Queue ETL '{Name}' configured → RabbitMQ queue '{Queue}' (per-follower fan-out via UserProfile.Follows).",
            Constants.Etl.ActivityFeedEtlName,
            Constants.Etl.ActivityFeedQueueName);
    }

    private async Task ConfigureTrendsOlapEtl()
    {
        var olapConn = new OlapConnectionString
        {
            Name = Constants.Etl.TrendsS3ConnectionStringName,
            S3Settings = new Raven.Client.Documents.Operations.Backups.S3Settings
            {
                BucketName      = Constants.Etl.TrendsBucketName,
                AwsAccessKey    = _minio.AccessKey,
                AwsSecretKey    = _minio.SecretKey,
                AwsRegionName   = "us-east-1",
                CustomServerUrl = _minio.Endpoint,
                ForcePathStyle  = true,
            }
        };
        await _store.Maintenance.SendAsync(new PutConnectionStringOperation<OlapConnectionString>(olapConn));

        var etl = new OlapEtlConfiguration
        {
            Name                 = Constants.Etl.TrendsOlapEtlName,
            ConnectionStringName = Constants.Etl.TrendsS3ConnectionStringName,
            RunFrequency = "* * * * *",
            Format       = OlapEtlFileFormat.Parquet,
            Transforms =
            [
                new Transformation
                {
                    Name        = "ExerciseToParquet",
                    Collections = ["ExerciseSessions"],
                    Script      = TrendsOlapEtlDefinition.TransformScript
                }
            ]
        };

        await UpsertOngoingTaskAsync(
            Constants.Etl.TrendsOlapEtlName, OngoingTaskType.OlapEtl,
            () => _store.Maintenance.SendAsync(new AddEtlOperation<OlapConnectionString>(etl)));

        _logger.LogInformation(
            "OLAP ETL '{Name}' configured → MinIO bucket '{Bucket}' (daily Hive partitions, Parquet).",
            Constants.Etl.TrendsOlapEtlName,
            Constants.Etl.TrendsBucketName);
    }
}
