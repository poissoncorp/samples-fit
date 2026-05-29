# Fit Assistant

![Build](https://github.com/poissoncorp/samples-fit/actions/workflows/build.yml/badge.svg)

## Overview

A sample application showing how a fitness / health domain maps onto [RavenDB](https://ravendb.net) — daily AI-generated goals, an AI chat coach with photo-based food logging, real-time activity feed across friends, heart-rate time series with rollups, and a Parquet/DuckDB trends pipeline.

## Features used

The following RavenDB features power this application:

1. [AI Agents](https://docs.ravendb.net/ai-integration/ai-agents/ai-agents_overview) — the parent chat agent, three sub-agents (motivate, explain-workout, food-photo-analyzer) and an estimator, with conversation persistence in `@conversations`.
1. [GenAI Tasks](https://docs.ravendb.net/ai-integration/ai-agents/creating-ai-agents/creating-ai-agents_api) — `daily-goals` (per-user, scheduled via `@refresh`) and `auto-coach` (per-workout) producing structured output deduped via `@ai-hashes`.
1. [Time Series](https://docs.ravendb.net/document-extensions/timeseries/overview) + [Rollups](https://docs.ravendb.net/document-extensions/timeseries/rollup-and-retention) — heart-rate data with raw / hourly / daily / monthly tiers.
1. [Subscriptions](https://docs.ravendb.net/client-api/data-subscriptions/what-are-data-subscriptions) — auto-fulfill goals when activity reaches predicate thresholds; fan-out fulfilled-goal events to friends.
1. [Queue ETL](https://docs.ravendb.net/server/ongoing-tasks/etl/queue-etl/rabbitmq-etl) — RabbitMQ-backed per-follower activity feed delivery.
1. [OLAP ETL](https://docs.ravendb.net/server/ongoing-tasks/etl/olap-etl) — daily Parquet partitions to MinIO, read by embedded DuckDB for the trends tab.
1. [Remote Attachments](https://docs.ravendb.net/guides/using-remote-attachments-to-cut-storage-costs) — chat-uploaded food photos drain transparently to MinIO.
1. [Document Refresh](https://docs.ravendb.net/studio/database/settings/document-refresh) + [Expiration](https://docs.ravendb.net/studio/database/settings/document-expiration) — scheduled heartbeats trigger the daily-goals task; old goal docs self-prune.

## Technologies

1. RavenDB 7.2
1. .NET 10
1. ASP.NET Core 10
1. Node.js 22
1. React 18 + TypeScript
1. .NET Aspire 13
1. DuckDB (embedded)
1. MinIO (S3-compatible object store)
1. RabbitMQ

## Run locally

### Prerequisites

1. [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)
1. [Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/cli/overview)
1. [Node.js 22 or newer](https://nodejs.org/en/download)
1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) — start it before launching the app. Aspire orchestrates RavenDB, MinIO, RabbitMQ, and a containerized backend.

### First-time setup

Install frontend dependencies once so Aspire's `AddNpmApp` can launch the dev server:

```bash
cd src/FitAssistant.Frontend && npm install
```

### Run

From the repo root:

```bash
aspire run
```

The first launch pulls ~1.5 GB of container images (RavenDB, MinIO, RabbitMQ, ASP.NET runtime) and builds the backend image — expect **2–5 minutes**. Subsequent launches take seconds.

### Configure secrets (Aspire dashboard parameters)

On first launch, the Aspire dashboard shows a **Parameters** tab with two secrets to set. Aspire stores your values as user secrets, so subsequent runs reuse them:

| Parameter | Required? | Purpose |
|---|---|---|
| `openai-api-key` | Recommended | Enables the AI chat coach, GenAI daily goals, photo analysis, and the per-workout auto-coach. Without it, AI features degrade gracefully (chat returns a "not configured" frame; the goals task runs but produces no output). |
| `ravendb-license` | Optional | Paste your RavenDB developer/enterprise license JSON to unlock time-series rollups + retention policies. Leave blank for community mode (everything still works; rollup tiers are skipped). |

The two MinIO parameters (`minio-user` / `minio-pwd`) are pre-filled demo values — no need to touch them.

For non-interactive runs (CI, scripts) set the values via env vars instead:
```bash
Parameters__openai-api-key=sk-...
Parameters__ravendb-license="{...}"
```

### Endpoints (after launch)

| Service | URL | Notes |
|---|---|---|
| Frontend | <http://localhost:3000> | Click "Seed sample data" on first visit |
| Aspire dashboard | <http://localhost:15178> | Login token printed in the launching terminal |
| RavenDB Studio | <http://localhost:8081> | Inspect documents, indexes, time series, subscriptions |
| MinIO console | <http://localhost:9001> | Credentials `fitadmin` / `fitadmin123` |
| Backend | Container | Host port is dynamic — see the Aspire dashboard |

### Troubleshooting

- **"Docker daemon not responding"** when launching `aspire run` — start Docker Desktop and wait for "Docker Desktop is running" before retrying.
- **Port already in use** on `:15178` / `:3000` / `:8081` — a previous AppHost is still alive. `taskkill /F /IM FitAssistant.AppHost.exe` (Windows) or kill the orphan `dotnet` process (macOS/Linux), then relaunch.
- **`npm install` failed in `FitAssistant.Frontend`** — delete `node_modules` and `package-lock.json` and rerun on Node 22+.
- **DCP unix-socket warning on AppHost startup (Windows)** — harmless; Aspire continues normally.

### Dev-mode preview without backend

The frontend can render fully against an in-browser mock for design / preview work:

- `http://localhost:3000/?mock=1` — synthetic personas, charts, live feed; no backend required.
- `http://localhost:3000/?empty=1` — boots the welcome flow even when seeded.

## Community & Support

If you spot a bug, have an idea, or a question, please open an issue or a pull request.

We also use a [Discord server](https://discord.gg/ravendb). If you have any doubts, don't hesitate to reach out!

## Contributing

We encourage you to contribute! Please read our [CONTRIBUTING](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed with the [MIT license](LICENSE).
