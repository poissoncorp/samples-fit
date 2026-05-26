using System.Text.Json;
using Raven.Client.Documents.Operations.Expiration;
using Raven.Client.Documents.Operations.Refresh;
using Raven.Client.Documents.Operations.TimeSeries;
using Sparrow;

namespace FitAssistant.Backend.RavenSetup;

public partial class RavenInitializer
{
    private async Task ConfigureTimeSeriesRollups()
    {
        // Four-tier rollup pyramid for HR (and any other TS on UserProfiles).
        // Each tier feeds a different range in the Heart Rate tab:
        //   24h → raw HeartRates           (288 five-min points)
        //   7d  → HeartRates@ByHour        (168 hourly avgs)
        //   30d → HeartRates@ByDay         (30 daily avgs)
        //   long-term analytics → ByMonth  (forever)
        // Policies must be declared in ascending aggregation-window order.
        await _store.Maintenance.SendAsync(
            new ConfigureRawTimeSeriesPolicyOperation("UserProfiles",
                new RawTimeSeriesPolicy(TimeValue.FromDays(30))));

        await _store.Maintenance.SendAsync(
            new ConfigureTimeSeriesPolicyOperation("UserProfiles",
                new TimeSeriesPolicy("ByHour", TimeValue.FromHours(1), TimeValue.FromDays(30))));

        await _store.Maintenance.SendAsync(
            new ConfigureTimeSeriesPolicyOperation("UserProfiles",
                new TimeSeriesPolicy("ByDay", TimeValue.FromDays(1), TimeValue.FromDays(180))));

        await _store.Maintenance.SendAsync(
            new ConfigureTimeSeriesPolicyOperation("UserProfiles",
                new TimeSeriesPolicy("ByMonth", TimeValue.FromDays(30), TimeValue.FromYears(100))));

        _logger.LogInformation("Time series rollup policies configured (raw 30d → ByHour 30d → ByDay 6mo → ByMonth forever).");
    }

    /// <summary>
    /// Registers MinIO as the <c>"minio"</c> Remote Attachments destination.
    /// Attachments written with <c>RemoteAttachmentParameters</c> drain there
    /// transparently. See <see href="https://docs.ravendb.net/guides/using-remote-attachments-to-cut-storage-costs"/>.
    /// </summary>
    private async Task ConfigureRemoteAttachments()
    {
        // The Client SDK's ConfigureRemoteAttachmentsOperation sends a
        // request that *currently* (RavenDB.Client 7.2.2-rc) doesn't reach
        // the persisting handler — the database record's RemoteAttachments
        // stays null, attachments get Flags=None, no S3 drain. Direct PUT
        // against the documented admin route reliably persists.
        // Route confirmed via reflection on Raven.Server.dll:
        //   PUT /databases/{db}/admin/attachments/remote/config
        var payload = new
        {
            Destinations = new Dictionary<string, object>
            {
                [Constants.RemoteAttachments.DestinationId] = new
                {
                    S3Settings = new
                    {
                        BucketName       = Constants.RemoteAttachments.BucketName,
                        AwsAccessKey     = _minio.AccessKey,
                        AwsSecretKey     = _minio.SecretKey,
                        AwsRegionName    = "us-east-1",
                        CustomServerUrl  = _minio.Endpoint,
                        ForcePathStyle   = true,
                        RemoteFolderName = "fit-attachments"
                    },
                    Disabled = false
                }
            },
            // Sample-friendly cadence: drain every 5s so dropping a photo
            // shows up in MinIO seconds later without making a presenter wait.
            CheckFrequencyInSec = 5,
            MaxItemsToProcess   = 25,
            ConcurrentUploads   = 4,
            Disabled            = false
        };

        var serverUrl = _store.Urls[0].TrimEnd('/');
        var routeUrl  = $"{serverUrl}/databases/{_store.Database}/admin/attachments/remote/config";

        using var http = new HttpClient();
        using var content = new StringContent(
            JsonSerializer.Serialize(payload),
            System.Text.Encoding.UTF8,
            "application/json");
        var response = await http.PutAsync(routeUrl, content);
        response.EnsureSuccessStatusCode();

        _logger.LogInformation(
            "Remote Attachments destination '{Destination}' configured at {Url} (bucket '{Bucket}', drain {Sec}s).",
            Constants.RemoteAttachments.DestinationId,
            _minio.Endpoint,
            Constants.RemoteAttachments.BucketName,
            payload.CheckFrequencyInSec);
    }

    private async Task ConfigureDocumentLifecycleAsync()
    {
        await _store.Maintenance.SendAsync(new ConfigureRefreshOperation(new RefreshConfiguration
        {
            Disabled = false,
            RefreshFrequencyInSec = 60,
        }));
        _logger.LogInformation("Document Refresh enabled (sweep every 60s).");

        await _store.Maintenance.SendAsync(new ConfigureExpirationOperation(new ExpirationConfiguration
        {
            Disabled = false,
            DeleteFrequencyInSec = 60,
        }));
        _logger.LogInformation("Document Expiration enabled (sweep every 60s).");
    }
}
