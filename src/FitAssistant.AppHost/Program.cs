using CommunityToolkit.Aspire.Hosting.RavenDB;

var builder = DistributedApplication.CreateBuilder(args);

var openAiApiKey = builder.AddParameter("openAiApiKey",
    builder.Configuration["OPENAI_API_KEY"] ?? throw new InvalidOperationException("OPENAI_API_KEY is required."),
    secret: true);

var ravenLicense = builder.Configuration["RAVEN_FIT_RAVEN_LICENSE"];

// MinIO — credentials are fixed demo values (see CLAUDE.md). Parameter
// wrapping is API ceremony, not a knob.
var minio = builder.AddMinioContainer("minio",
    rootUser:     builder.AddParameter("minio-user", "fitadmin"),
    rootPassword: builder.AddParameter("minio-pwd",  "fitadmin123", secret: true),
    port: 9000);

// RavenDB
var serverSettings = RavenDBServerSettings.Unsecured();
serverSettings.Port = 8081;
serverSettings.TcpPort = 38889;

if (!string.IsNullOrEmpty(ravenLicense))
    serverSettings.WithLicense(ravenLicense);

var ravenServer = builder.AddRavenDB("ravendb", serverSettings)
    .WithImage("ravendb/ravendb-nightly", "7.2-latest")
    .WaitFor(minio);

var ravendb = ravenServer.AddDatabase("FitAssistant");

// RabbitMQ
var rabbit = builder.AddRabbitMQ("rabbit").WithManagementPlugin();

// Feed microservice
var fitFeed = builder.AddProject<Projects.FitAssistant_FitFeed>("fit-feed")
    .WithReference(rabbit)
    .WaitFor(rabbit);

// FitAssistant backend — containerized so the URL it sees for MinIO / RabbitMQ
// matches the URL RavenDB sees (cargo-forwarded for the S3 destinations + Queue
// ETL connection string). Build context is the experiment root so
// Directory.Packages.props + nuget.config are reachable.
var backend = builder.AddDockerfile("backend", "../..", "src/FitAssistant.Backend/Dockerfile")
    .WithReference(ravenServer)
    .WithReference(ravendb)
    .WithReference(rabbit)
    .WithReference(fitFeed)
    .WithReference(minio)
    .WithEnvironment("OPENAI_API_KEY", openAiApiKey)
    .WithHttpEndpoint(targetPort: 8080)
    .WithExternalHttpEndpoints()
    .WaitFor(ravendb)
    .WaitFor(rabbit)
    .WaitFor(minio);

// FitAssistant frontend — backend is now a container, so the explicit URL
// env var below replaces the project-style WithReference(backend) wiring.
builder.AddNpmApp("frontend", "../FitAssistant.Frontend", "start")
    .WithReference(fitFeed)
    .WaitFor(backend)
    .WaitFor(fitFeed)
    .WithEnvironment("BROWSER", "none")
    .WithEnvironment("PORT", "3000")
    .WithEnvironment("REACT_APP_BACKEND_URL", ReferenceExpression.Create($"{backend.GetEndpoint("http")}"))
    .WithEnvironment("REACT_APP_FITFEED_URL", ReferenceExpression.Create($"{fitFeed.GetEndpoint("http")}"))
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WithExternalHttpEndpoints();

builder.Build().Run();
