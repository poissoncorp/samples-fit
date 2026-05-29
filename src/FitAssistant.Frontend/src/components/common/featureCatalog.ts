// Pure metadata: every RavenDB primitive the app demonstrates, with the copy
// that powers FeatureBadge popovers. Edits here are content edits; the
// component renders whatever the catalog provides.

export type FeatureKey =
  | 'time-series'
  | 'rollups'
  | 'retention-policy'
  | 'genai-simple'
  | 'genai-advanced'
  | 'document-refresh'
  | 'attachments'
  | 'include'
  | 'ai-agent'
  | 'multi-agent'
  | 'subscriptions'
  | 'changes-api'
  | 'map-reduce-index'
  | 'queue-etl'
  | 'olap-etl'
  | 'tool-actions'
  | 'tool-queries'
  | 'ai-agent-parameters'
  | 'streaming'
  | 'ai-context-hashes';

export type ChallengeTone = 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'orange';

export interface Challenge {
  icon: string;
  tone: ChallengeTone;
  title: string;
  detail: string;
}

export interface FeatureMeta {
  label: string;
  title: string;
  description: string;
  challenges: Challenge[];
  docsUrl: string;
}

export const FEATURES: Record<FeatureKey, FeatureMeta> = {
  'time-series': {
    label: 'Time Series',
    title: 'RavenDB Time Series',
    description:
      'Native time-series primitive that lives directly on the parent document. No separate sensors collection, no sidecar store. Range queries return slices in milliseconds, even against millions of points.',
    challenges: [
      {
        icon: '📍',
        tone: 'blue',
        title: 'On the document',
        detail: 'Each document owns its own series. Query the parent, get the points.',
      },
      {
        icon: '⚡',
        tone: 'red',
        title: 'Range queries on millions of points',
        detail: 'Server returns the slice in milliseconds. Client never folds a raw stream.',
      },
      {
        icon: '🪶',
        tone: 'purple',
        title: 'Native primitive',
        detail: 'Time-series lives next to the document, indexed for time-bounded reads.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/timeseries/overview',
  },

  'retention-policy': {
    label: 'Retention',
    title: 'Time Series Retention Policy',
    description:
      'Each rollup tier carries its own retention window. Raw points expire fast, aggregates stay forever. The server prunes on its own. No cron, no batch job.',
    challenges: [
      {
        icon: '🧹',
        tone: 'green',
        title: 'Auto-pruning',
        detail: 'Raw points expire after their retention window. The next tier already holds the same range at a fraction of the volume.',
      },
      {
        icon: '📦',
        tone: 'yellow',
        title: 'Tier-aware storage',
        detail: 'Hot tier is a high-resolution short window. Cold tier is a low-resolution long window. Read cost scales with the chart, not the history.',
      },
      {
        icon: '🛡️',
        tone: 'blue',
        title: 'No batch jobs',
        detail: 'Retention rules are declarative on the collection. RavenDB sweeps automatically.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/timeseries/rollup-and-retention',
  },

  rollups: {
    label: 'Rollups',
    title: 'Time Series Rollups',
    description:
      'Raw time-series auto-aggregates into derived tiers on a schedule you configure (e.g. hourly, daily, monthly). Query the tier that matches your range. No client-side aggregation, no batch jobs.',
    challenges: [
      {
        icon: '🚀',
        tone: 'red',
        title: 'Right tier for the range',
        detail: 'Short range hits raw. Wider range hits the higher tier. Same query, payload size scales with the chart, not the history.',
      },
      {
        icon: '💰',
        tone: 'yellow',
        title: 'min/max/avg in one read',
        detail: 'Each rolled timestamp carries first, last, min, max, sum, count. Chart-ready aggregates with no extra query.',
      },
      {
        icon: '🧹',
        tone: 'green',
        title: 'Tiered retention',
        detail: 'Each tier has its own retention. Old detail expires; long-term aggregates remain.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/timeseries/rollup-and-retention',
  },
  'genai-simple': {
    label: 'GenAI · simple',
    title: 'RavenDB GenAI Tasks (minimal)',
    description:
      'Document-triggered GenAI in its simplest shape. A JS transform builds context from the document, the model returns structured JSON, an update script writes the result back. All server-side, next to the data.',
    challenges: [
      {
        icon: '📡',
        tone: 'blue',
        title: 'Doc-driven trigger',
        detail: 'Fires on document mutations. The transform decides what counts as a trigger; the rest never reaches the model.',
      },
      {
        icon: '✍️',
        tone: 'green',
        title: 'One script, one write',
        detail: 'Transformation script, model call, update script. Three short pieces, all server-side.',
      },
      {
        icon: '🪶',
        tone: 'purple',
        title: 'No orchestration',
        detail: 'Nothing else to wire. Define the task, RavenDB runs it.',
      },
    ],
    docsUrl: 'https://docs.ravendb.net/7.2/ai-integration/gen-ai-integration/gen-ai-overview/',
  },

  'genai-advanced': {
    label: 'GenAI · advanced',
    title: 'RavenDB GenAI Tasks (composed)',
    description:
      'The same GenAI Task primitive, composed with the rest of RavenDB. Document Refresh schedules it. Tool queries shape the context. `@ai-hashes` skips redundant runs. Subscriptions react to the output. One model, five primitives, one declarative task.',
    challenges: [
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Multi-tool context build',
        detail: 'Multiple RQL tool queries shape the context. The model reads from the database, never invents.',
      },
      {
        icon: '🧮',
        tone: 'blue',
        title: 'Cost-aware dedup',
        detail: "Built-in dedup. If the context hasn't meaningfully changed, the model call is skipped. Zero tokens for unchanged inputs.",
      },
      {
        icon: '✍️',
        tone: 'green',
        title: 'Strict structured output',
        detail: 'Output lands as typed JSON. Subscriptions can react to it like any other document write.',
      },
    ],
    docsUrl: 'https://docs.ravendb.net/7.2/ai-integration/gen-ai-integration/gen-ai-overview/',
  },

  'document-refresh': {
    label: 'Document Refresh',
    title: 'RavenDB Document Refresh',
    description:
      'Schedule a document to be touched at a future time via `@refresh` metadata. The touch is a real document "mutation", so subscriptions, indexes, and ongoing tasks all react to it. No app-side timer, no cron.',
    challenges: [
      {
        icon: '⏰',
        tone: 'blue',
        title: 'No timer process',
        detail: "The schedule lives in document metadata, indexed as a tree. RavenDB's built-in background task sweeps the tree. No separate background scheduler, no cron, no app-side timer.",
      },
      {
        icon: '🔁',
        tone: 'purple',
        title: 'Composes with mutations',
        detail: 'The wake-up is a normal mutation. Subscriptions, indexes, and ongoing tasks see it like any other write.',
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Self-rearming',
        detail: 'After firing, a task can rewrite `@refresh` to schedule its next run. Cadence enforcement stays in the database.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/document-refresh',
  },
  attachments: {
    label: 'AI Agent Attachments',
    title: 'AI Agent Attachments',
    description:
      'Attach an image (or any bytes) directly to an AI Agent turn. The model sees it as part of its context. No separate upload endpoint, no out-of-band storage hand-off.',
    challenges: [
      {
        icon: '📎',
        tone: 'purple',
        title: 'Native multimodal',
        detail: 'Bytes flow inside the conversation. The model reads them as part of its context, just like text.',
      },
      {
        icon: '🎯',
        tone: 'red',
        title: 'Inherited by sub-agents',
        detail: 'A parent attaches once. Sub-agents see the same attachment when delegated to.',
      },
      {
        icon: '🔁',
        tone: 'blue',
        title: 'Composes with tool actions',
        detail: 'The model can analyse an attachment and immediately call a tool action on it. One round-trip from upload to write.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },
  include: {
    label: 'Include',
    title: 'Include (no N+1)',
    description:
      'Load related documents inline with the query. One round trip, no N+1.',
    challenges: [
      {
        icon: '⚡',
        tone: 'blue',
        title: 'Single round-trip',
        detail: 'List query and related docs come back together.',
      },
      {
        icon: '🧠',
        tone: 'purple',
        title: 'Already-warm cache',
        detail: 'Included docs land in your session. Subsequent loads are free.',
      },
      {
        icon: '💰',
        tone: 'yellow',
        title: 'No JOIN engine',
        detail: 'Resolved on read. No join planner, no extra round trip.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/client-api/how-to/handle-document-relationships#includes',
  },

  'multi-agent': {
    label: 'Multi-Agent',
    title: 'RavenDB Multi-Agent',
    description:
      'A parent agent can delegate to specialised sub-agents. Each has its own system prompt, output schema, and tool set. The runtime threads parameters and attachments through the delegation. No app-side orchestration.',
    challenges: [
      {
        icon: '🧩',
        tone: 'purple',
        title: 'Specialised brains',
        detail: 'Each sub-agent has its own prompt, schema, and tools. Specialised, not a system-prompt variant.',
      },
      {
        icon: '💸',
        tone: 'yellow',
        title: 'Different model per role',
        detail: 'Each sub-agent picks its own LLM. Use cheap models for vision and digests, the heavier model for synthesis.',
      },
      {
        icon: '🔗',
        tone: 'blue',
        title: 'Native delegation',
        detail: 'The parent declares its sub-agents. RavenDB routes the delegation and threads parameters automatically.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents/multi-agents',
  },

  'ai-agent': {
    label: 'AI Agent',
    title: 'RavenDB AI Agent',
    description:
      'An AI Agent is a first-class database primitive. Defined once, persisted in the database, invoked as a typed conversation. Tools, parameters, streaming, sub-agents, attachments all wire up through the same agent.',
    challenges: [
      {
        icon: '🧠',
        tone: 'purple',
        title: 'Grounded in your data',
        detail: "Bounded RQL tool queries scope every answer to the calling tenant. The model can't reach outside its registered surface.",
      },
      {
        icon: '🗂️',
        tone: 'blue',
        title: 'Conversation is a document',
        detail: 'Conversations are documents. Resumable, inspectable, expirable like any other doc.',
      },
      {
        icon: '⚡',
        tone: 'green',
        title: 'One primitive, many capabilities',
        detail: 'Tools, sub-agents, structured output, streaming, attachments. All on the same primitive.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'changes-api': {
    label: 'Changes API',
    title: 'RavenDB Changes API',
    description:
      'Live stream of document changes. Subscribe in code, get notifications within milliseconds of each commit. Ideal for "right now" UIs where stale-on-reconnect is acceptable.',
    challenges: [
      {
        icon: '📡',
        tone: 'blue',
        title: 'Push, not poll',
        detail: 'Deltas land within milliseconds of the commit. No poll interval, no replay-state setup.',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Right tool for live UI',
        detail: 'Use it when the answer is "right now", not "since I last looked". Data Subscriptions cover the durable case; Changes API covers the ephemeral one.',
      },
      {
        icon: '🪶',
        tone: 'green',
        title: 'Minimal wiring',
        detail: 'One subscription, one fan-out to clients. No buffer, no replay state to manage.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/client-api/changes/what-are-changes',
  },

  subscriptions: {
    label: 'Subscriptions',
    title: 'RavenDB Data Subscriptions',
    description:
      'Push-based change feed. Workers consume document changes as RavenDB commits them. Server-side filter, resumable cursor, sub-second latency.',
    challenges: [
      {
        icon: '📡',
        tone: 'blue',
        title: 'Push, not poll',
        detail: 'Workers receive document changes as they commit. Sub-second latency, no poll interval to tune.',
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Resumable',
        detail: 'Workers can crash and resume. RavenDB tracks acknowledged events.',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Server-side filter',
        detail: 'Filter at the database. Workers only see the events they asked for.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/client-api/data-subscriptions/what-are-data-subscriptions',
  },

  'map-reduce-index': {
    label: 'Map-Reduce',
    title: 'RavenDB Map-Reduce Index',
    description:
      'Aggregations declared as indexes. RavenDB folds new documents into the matching group row incrementally at write time. Reads return the rolled-up row directly. No batch job, no fold at query time.',
    challenges: [
      {
        icon: '⚡',
        tone: 'blue',
        title: 'Pre-computed at write',
        detail: 'Each new document folds into the matching group row. The index does the work; the query just reads.',
      },
      {
        icon: '📊',
        tone: 'purple',
        title: 'One row per group',
        detail: 'Reads fetch the aggregated row, not the N underlying documents.',
      },
      {
        icon: '🔁',
        tone: 'red',
        title: 'Always live',
        detail: 'Updates incrementally as documents change. No batch job, no staleness window to plan for.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/indexes/map-reduce-indexes',
  },

  'queue-etl': {
    label: 'Queue ETL',
    title: 'RavenDB Queue ETL',
    description:
      'Outbound ETL that publishes document changes to a message queue. A JS transform on the server shapes each message; one source document can fan out to many recipients. RabbitMQ, Kafka, and Azure Service Bus all supported.',
    challenges: [
      {
        icon: '🪄',
        tone: 'purple',
        title: 'Server-side fan-out',
        detail: 'The JS transform can load related documents and emit one message per recipient. Routing lives in the database, not in app code.',
      },
      {
        icon: '🧱',
        tone: 'blue',
        title: 'Genuine decoupling',
        detail: "Consumers run as separate services at their own pace. The producer doesn't know who's listening.",
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Audience-aware',
        detail: 'If the transform finds no recipients, nothing is published. Privacy modelled in the data, not a feature flag.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/server/ongoing-tasks/etl/queue-etl/queue-etl-overview',
  },

  'olap-etl': {
    label: 'OLAP ETL',
    title: 'RavenDB OLAP ETL',
    description:
      'Outbound ETL that writes documents to columnar Parquet files in object storage. Any SQL engine that reads Parquet (DuckDB, Spark, Athena, BigQuery) can analyse the operational data without touching the OLTP store.',
    challenges: [
      {
        icon: '📦',
        tone: 'blue',
        title: 'Columnar data lake, no warehouse',
        detail: 'Writes Parquet on S3-compatible storage. Any Parquet-capable SQL engine reads it. No warehouse to provision.',
      },
      {
        icon: '✂️',
        tone: 'purple',
        title: 'Partition + column pruning',
        detail: 'Hive-style partitions plus columnar storage. Analytical queries touch only the partitions and columns they need.',
      },
      {
        icon: '🎯',
        tone: 'green',
        title: 'Right primitive per workload',
        detail: "OLTP stays on RavenDB. OLAP runs on the engine of your choice. Each engine does what it's good at.",
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/server/ongoing-tasks/etl/olap-etl/olap-etl-overview',
  },

  'tool-actions': {
    label: 'Tool Actions',
    title: 'AI Agent Tool Actions',
    description:
      "Give the model a typed write surface. The LLM emits structured output that matches the action's schema, and the runtime routes the call to your handler. No regex, no JSON parser between model and code.",
    challenges: [
      {
        icon: '✍️',
        tone: 'purple',
        title: 'Typed write surface',
        detail: 'Action arguments are a typed schema. Your handler receives a parsed object, not a string.',
      },
      {
        icon: '🔁',
        tone: 'blue',
        title: 'Sub-agent passthrough',
        detail: 'Sub-agent tool calls route through the same handler under `{subagent}/{action}`. One implementation, many call sites.',
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Server-enforced contract',
        detail: 'If the model returns malformed args, the runtime rejects the call before your handler runs.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'tool-queries': {
    label: 'Tool Queries',
    title: 'Bounded RQL Tool Queries',
    description:
      "Pre-registered RQL queries the model calls like functions. Parameters are bound by the runtime, not by the model, so the model can't fabricate tenant identifiers or reach data outside its scope.",
    challenges: [
      {
        icon: '🔒',
        tone: 'green',
        title: 'Tenant-bounded',
        detail: "System-bound parameters are enforced by the runtime. The model can't override them.",
      },
      {
        icon: '📊',
        tone: 'purple',
        title: 'Full RQL surface',
        detail: 'Tool queries are full RQL. Time-series projections, includes, indexes, all available to the model on demand.',
      },
      {
        icon: '⚡',
        tone: 'blue',
        title: 'No app glue',
        detail: 'Queries are registered with the agent or task. No app-side proxy, no per-request validation. The model decides which to call.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'ai-agent-parameters': {
    label: 'AI Agent Parameters',
    title: 'RavenDB AI Agent Parameters',
    description:
      "Parameters bind values into agent and sub-agent context. Marked as forbidden-to-generate, the model can't invent or override them. Sub-agents inherit the parent's parameters, so the boundary holds across delegations.",
    challenges: [
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Forbid model generation',
        detail: 'The model cannot invent forbidden parameters. Tenant scoping is enforced by the runtime, not by a prompt instruction.',
      },
      {
        icon: '🔁',
        tone: 'blue',
        title: 'Inherited by sub-agents',
        detail: 'When the parent delegates, the same parameters flow to the sub-agent. The boundary is set once.',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Tenant boundary, server-side',
        detail: 'Parameter substitution happens at the runtime. The query the model fires is fixed; only the bound value varies.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'ai-context-hashes': {
    label: '@ai-hashes',
    title: 'Built-in GenAI Dedup',
    description:
      'GenAI Tasks declare the inputs that matter via the context they build. RavenDB hashes that context on every trigger; if the hash matches the previous run, the model call is skipped automatically. Zero tokens for unchanged inputs.',
    challenges: [
      {
        icon: '⚡',
        tone: 'green',
        title: 'Zero-waste retriggers',
        detail: "Mutations that don't change the declared context produce the same hash. The task fires, finds no work to do, costs no tokens.",
      },
      {
        icon: '🔁',
        tone: 'purple',
        title: 'Loaded docs count too',
        detail: 'Cross-document state in the context counts too. If a document the script loads changes, the hash differs and the model runs with the new state.',
      },
      {
        icon: '🛡️',
        tone: 'blue',
        title: 'Server-enforced',
        detail: 'The hash check is part of the runtime, not opt-in. Every GenAI Task gets dedup for free.',
      },
    ],
    docsUrl: 'https://docs.ravendb.net/7.2/ai-integration/gen-ai-integration/gen-ai-overview/',
  },

  streaming: {
    label: 'Streaming',
    title: 'AI Conversation Streaming',
    description:
      'Token-by-token streaming of structured output. The runtime streams one field of the typed reply while the rest of the structure builds in the background. Perceived latency drops from full-reply to first-word.',
    challenges: [
      {
        icon: '⚡',
        tone: 'blue',
        title: 'First-word latency',
        detail: 'Tokens flow as the model generates. Perceived latency is first-word, not full-reply.',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Structured + streamed',
        detail: 'Stream a chosen field of the typed reply. The rest of the structure resolves alongside, server-side.',
      },
      {
        icon: '🧵',
        tone: 'green',
        title: 'Same conversation, same stream',
        detail: 'Tool calls and sub-agent runs resolve server-side. Only the final user-visible tokens come down the wire.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },
};
