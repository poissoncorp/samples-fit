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

Prerequisites:

1. [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)
1. [Node.js 22.x](https://nodejs.org/en/download)
1. [Docker](https://www.docker.com/) (Aspire orchestrates RavenDB, MinIO, RabbitMQ, and the backend image)

Optional configuration:

- **OpenAI key** — enables the AI chat coach, GenAI daily goals, and per-workout coach notes. On first run Aspire's dashboard will prompt for it (stored as a user secret thereafter). You can also pre-set the value as the `OPENAI_API_KEY` env var or via `Parameters__openai-api-key`. Without a key the AI features degrade gracefully (chat returns a "not configured" frame; the goals task runs but produces no output).
- `RAVEN_FIT_RAVEN_LICENSE` — RavenDB enterprise license. Community mode works too.

First-time setup — install frontend dependencies once so Aspire's `AddNpmApp` can launch the dev server:

```bash
cd src/FitAssistant.Frontend && npm install
```

Run the full stack from repo root:

```bash
dotnet run --project src/FitAssistant.AppHost --launch-profile http
```

- Aspire dashboard: <http://localhost:15178>
- Frontend: <http://localhost:3000>
- RavenDB Studio: <http://localhost:8081>
- MinIO console: <http://localhost:9001> (creds `fitadmin` / `fitadmin123`)
- Backend: containerized — see the dashboard for the host-mapped port.

## Community & Support

If you spot a bug, have an idea, or a question, please open an issue or a pull request.

We also use a [Discord server](https://discord.gg/ravendb). If you have any doubts, don't hesitate to reach out!

## Contributing

We encourage you to contribute! Please read our [CONTRIBUTING](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed with the [MIT license](LICENSE).
