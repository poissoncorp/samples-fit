// Pure metadata: every RavenDB primitive the app demonstrates, with the copy
// that powers FeatureBadge popovers. Edits here are content edits — the
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
      "Heart-rate samples are written to a Time Series called `HeartRates` directly on each `UserProfile` document — one entry every five minutes, value = bpm. RavenDB stores TS compressed inline on the parent doc; the dashboard reads the most recent slice for the Resting HR tile with a single range query.",
    challenges: [
      {
        icon: '📍',
        tone: 'blue',
        title: 'On the document',
        detail: 'No separate sensors collection. Each UserProfile owns its own `HeartRates` series — query the user, get the points.',
      },
      {
        icon: '⚡',
        tone: 'red',
        title: 'Range queries on millions of points',
        detail: 'Server returns the slice in milliseconds; the client never folds a raw stream.',
      },
      {
        icon: '🪶',
        tone: 'purple',
        title: 'Native primitive',
        detail: 'TS lives next to the doc, indexed for time-bounded reads — no plug-in store, no sidecar.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/timeseries/overview',
  },

  'retention-policy': {
    label: 'Retention',
    title: 'Time Series Retention Policy',
    description:
      "Each tier of the HR pyramid carries its own retention: raw `HeartRates` 30 days, `HeartRates@ByHour` 30 days, `HeartRates@ByDay` 6 months, `HeartRates@ByMonth` forever. RavenDB prunes the lower tiers automatically once the higher tier has absorbed them — old detail evaporates, long-term aggregates stay.",
    challenges: [
      {
        icon: '🧹',
        tone: 'green',
        title: 'Auto-pruning',
        detail: 'Raw 5-min HR points are deleted after 30d. By then the ByHour tier holds the same window at 1/12th the volume.',
      },
      {
        icon: '📦',
        tone: 'yellow',
        title: 'Tier-aware storage',
        detail: 'Hot tier = high-resolution short window. Cold tier = low-resolution long window. Read cost scales with the chart, not the history.',
      },
      {
        icon: '🛡️',
        tone: 'blue',
        title: 'No batch jobs',
        detail: 'Retention rules are declarative on the collection — RavenDB sweeps; you don\'t write a cron.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/timeseries/rollup-and-retention',
  },

  rollups: {
    label: 'Rollups',
    title: 'Time Series Rollups',
    description:
      "HR samples land in a Time Series on each UserProfile — `HeartRates`, one entry every five minutes. The rollup pyramid configured on the UserProfiles collection auto-aggregates that raw stream into three derived tiers — `HeartRates@ByHour`, `HeartRates@ByDay`, `HeartRates@ByMonth` — each with its own retention. The Heart Rate tab queries the right tier per range; no client-side aggregation, no batch jobs.",
    challenges: [
      {
        icon: '🚀',
        tone: 'red',
        title: 'Right tier for the range',
        detail: '24h → raw `HeartRates` (288 five-min points). 7d → `HeartRates@ByHour` (168 hourly avgs). 30d → `HeartRates@ByDay` (30 daily avgs). Same endpoint, payload differs by three orders of magnitude.',
      },
      {
        icon: '💰',
        tone: 'yellow',
        title: 'Six values per rolled entry',
        detail: 'RavenDB stores `[first, last, min, max, sum, count]` per timestamp. The endpoint projects avg = sum / count — chart-ready in one read.',
      },
      {
        icon: '🧹',
        tone: 'green',
        title: 'Tiered retention',
        detail: 'Raw 30d → ByHour 30d → ByDay 6mo → ByMonth forever. The server prunes older raw points once the next tier has absorbed them.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/timeseries/rollup-and-retention',
  },
  'genai-simple': {
    label: 'GenAI · simple',
    title: 'RavenDB GenAI Task — minimal shape',
    description:
      "The `auto-coach` task fires when an ExerciseSession completes. A small JS script hands the model the session doc, the model returns one sentence of structured JSON, and an UpdateScript patches `CoachNote` back onto the same doc. No tool queries, no dedup, no downstream fan-out — the bare GenAI Task shape.",
    challenges: [
      {
        icon: '📡',
        tone: 'blue',
        title: 'Doc-driven trigger',
        detail: 'Watches ExerciseSessions; fires when EndTime transitions from null → set. Ultra-only — Free users stay $null at zero AI cost.',
      },
      {
        icon: '✍️',
        tone: 'green',
        title: 'One script, one write',
        detail: 'Transformation script → model → UpdateScript. All server-side, all next to the data.',
      },
      {
        icon: '🪶',
        tone: 'purple',
        title: 'No orchestration',
        detail: 'Nothing else to wire. Compare this with GenAI · advanced (Daily Goals) for the layered version.',
      },
    ],
    docsUrl: 'https://docs.ravendb.net/7.2/ai-integration/gen-ai-integration/gen-ai-overview/',
  },

  'genai-advanced': {
    label: 'GenAI · advanced',
    title: 'RavenDB GenAI Task — composed with the rest of the platform',
    description:
      "The `daily-goals` task takes the same primitive as the auto-coach and layers four more RavenDB features onto it: Document Refresh drives the cadence, registered RQL tool queries shape the model's context, `@ai-hashes` elides duplicate runs, JSON-Schema-strict structured output lands as a typed DailyGoals doc, and downstream Subscriptions watch for fulfillment. One model, five interlocking primitives.",
    challenges: [
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Multi-tool context build',
        detail: 'Three RQL tool queries (recent exercises, today\'s kcal-intake-by-day, kcal-burned series) shape the JSON context — the model never invents data.',
      },
      {
        icon: '🧮',
        tone: 'blue',
        title: 'Cost-aware dedup',
        detail: '`@ai-hashes` over the context object elides the model call when nothing meaningful changed — same-day re-arms cost zero tokens.',
      },
      {
        icon: '✍️',
        tone: 'green',
        title: 'Strict structured output',
        detail: 'Goals come back as a typed JSON shape with machine-evaluable predicates, written into a DailyGoals doc — Subscriptions then auto-fulfill against accumulating activity.',
      },
    ],
    docsUrl: 'https://docs.ravendb.net/7.2/ai-integration/gen-ai-integration/gen-ai-overview/',
  },

  'document-refresh': {
    label: 'Document Refresh',
    title: 'RavenDB Document Refresh',
    description:
      "The daily-goals GenAI Task writes @metadata.@refresh on each UserProfile to schedule its next run. When the timestamp passes, RavenDB touches the document — that touch is itself a mutation, which re-fires the task. The cadence is enforced by the database, not by app code.",
    challenges: [
      {
        icon: '⏰',
        tone: 'blue',
        title: 'No timer process',
        detail: 'Auto-wake lives in document metadata. No background scheduler, no cron, no app-side timer to keep alive.',
      },
      {
        icon: '🔁',
        tone: 'purple',
        title: 'Composes with mutations',
        detail: 'The wake-up is just another doc mutation — subscriptions, indexes, and ongoing tasks all see it the same as any other write.',
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Pairs with @ai-hashes',
        detail: "If nothing meaningful in the context changed since the previous run, the built-in @ai-hashes dedup elides the AI call on the wake — no wasted tokens.",
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/document-extensions/document-refresh',
  },
  attachments: {
    label: 'Attachments',
    title: 'AI Agent Attachments',
    description:
      'Attach a food photo to Coach and the bytes ride inside the AI Agent conversation as a vision input. The parent agent delegates to the food-photo sub-agent, which sees the image as part of its context and calls LogFoodEntry. One round-trip, no separate upload step.',
    challenges: [
      {
        icon: '📎',
        tone: 'purple',
        title: 'Native multimodal',
        detail: 'Photo bytes flow inside the conversation — the vision sub-agent reads the image as part of its context.',
      },
      {
        icon: '🎯',
        tone: 'red',
        title: 'Inherited by sub-agents',
        detail: "Parent attaches once; the food-photo sub-agent sees the same attachment when it's delegated to.",
      },
      {
        icon: '🔁',
        tone: 'blue',
        title: 'Composes with actions',
        detail: 'After analysis, the sub-agent calls LogFoodEntry — bytes also land as a Remote Attachment on the new FoodEntry.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },
  include: {
    label: 'Include',
    title: 'Include — no N+1',
    description:
      'The activity list loads each exercise alongside its owning user document via a single Include() — one round trip, zero N+1 queries.',
    challenges: [
      {
        icon: '⚡',
        tone: 'blue',
        title: 'Single round-trip',
        detail: 'List query + parent docs come back together.',
      },
      {
        icon: '🧠',
        tone: 'purple',
        title: 'Already-warm cache',
        detail: 'Included docs land in your session — subsequent loads are free.',
      },
      {
        icon: '💰',
        tone: 'yellow',
        title: 'No JOIN engine',
        detail: 'Resolved on read — the database does no extra work.',
      },
    ],
    docsUrl:
      'https://ravendb.net/docs/article-page/latest/csharp/client-api/how-to/handle-document-relationships#includes',
  },

  'multi-agent': {
    label: 'Multi-Agent',
    title: 'RavenDB Multi-Agent',
    description:
      "The parent fit-assistant agent (gpt-5-mini) orchestrates and writes prose. Three sub-agents, each with a real reason to exist — different schema, different security context, or different modality: fit-motivate (mini, premium data-digester with pattern detection), explain-workout (nano, premium data-digester), food-photo-analyzer (nano, vision). None is just a system-prompt variant of the parent.",
    challenges: [
      {
        icon: '🧩',
        tone: 'purple',
        title: 'Specialised brains',
        detail: 'Each sub-agent has its own system prompt, output schema, and tool set — no kitchen-sink prompt.',
      },
      {
        icon: '💸',
        tone: 'yellow',
        title: 'Cost-tiered',
        detail: 'Vision and per-session explanation on gpt-5-nano; conversation and motivation synthesis on gpt-5-mini. One sample, two tiers.',
      },
      {
        icon: '🔗',
        tone: 'blue',
        title: 'Native delegation',
        detail: 'The parent declares SubAgents; RavenDB routes the delegation automatically and threads parameters through — no app-side orchestration.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents/multi-agents',
  },

  'ai-agent': {
    label: 'AI Agent',
    title: 'RavenDB AI Agent',
    description:
      "The Coach is a RavenDB AI Agent — defined in code, persisted in the database, and invoked with `aiOps.Conversation(agentId, conversationId, options).StreamAsync<AgentReply>()`. Conversations live in the `@conversations` collection, so the next turn resumes with full history. Tools, parameters, streaming, attachments — all wire up through the same agent primitive.",
    challenges: [
      {
        icon: '🧠',
        tone: 'purple',
        title: 'Grounded in your data',
        detail: 'Bounded RQL tool queries scope every answer to the calling user — no general-purpose hallucination surface.',
      },
      {
        icon: '🗂️',
        tone: 'blue',
        title: 'Conversation = a document',
        detail: 'Stored in `@conversations`, resumable, inspectable in Studio, expirable via `@expires`.',
      },
      {
        icon: '⚡',
        tone: 'green',
        title: 'One primitive, many capabilities',
        detail: 'Tools, sub-agents, structured output, streaming, attachments — all on the same `Conversation`.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'changes-api': {
    label: 'Changes API',
    title: 'RavenDB Changes API',
    description:
      "The Live Workouts strip is push-driven by the RavenDB Changes API. The backend's LiveWorkoutsStream service opens a single client-SDK subscription to changes on the ExerciseSessions collection, classifies each notification into a typed `started` / `completed` lifecycle event (by comparing the doc's EndTime-null marker against the last-seen state), and SSE-fans the result to every browser. No polling, no in-memory buffer, no time-window math.",
    challenges: [
      {
        icon: '📡',
        tone: 'blue',
        title: 'Real push, not poll',
        detail: 'Browser sees deltas within milliseconds of the commit — no 6-second poll, no spin-up of a Data Subscription with replay state.',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Right tool for live UI',
        detail: "Data Subscriptions replay from a saved cursor; Changes API drops stale state on reconnect. For 'who's training right now', a fresh REST snapshot + a live SSE stream is the honest shape.",
      },
      {
        icon: '🪶',
        tone: 'green',
        title: 'Tiny backend surface',
        detail: '~150 lines: one IObserver, one ChannelReader-per-client, one SSE controller. The classifier (null = live, set = completed) is a one-liner.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/client-api/changes/what-are-changes',
  },

  subscriptions: {
    label: 'Subscriptions',
    title: 'RavenDB Data Subscriptions',
    description:
      "Four subscriptions across the app: the auto-fulfillment workers for Exercise- and Nutrition-shaped daily goals, the goal-fulfilled fan-out to friends via the activity_feed queue, and the auto-coach note on each workout. Workers consume from RavenDB on commit — no polling, no message bus needed.",
    challenges: [
      {
        icon: '📡',
        tone: 'blue',
        title: 'Push, not poll',
        detail: 'Subscriptions emit on commit — sub-second latency to the worker.',
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Resumable',
        detail: 'Workers can crash and resume — RavenDB tracks acknowledged events.',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Server-side filter',
        detail: 'Only the events you care about — no full-table scans.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/client-api/data-subscriptions/what-are-data-subscriptions',
  },

  'map-reduce-index': {
    label: 'Map-Reduce',
    title: 'RavenDB Map-Reduce Index',
    description:
      "Today's intake and burned totals come from two parallel map-reduce indexes: `KcalIntakeByUserDay` groups every `FoodEntry` by (user, day); `KcalBurnedByUserDay` does the same over completed `ExerciseSession` docs. One row per (user, day) — no fold at read time. Kcal lives on the document graph, not on a time series.",
    challenges: [
      {
        icon: '⚡',
        tone: 'blue',
        title: 'Pre-computed at write',
        detail: 'Each new meal / completed workout re-folds the matching day row incrementally — the index is the work, the API just reads.',
      },
      {
        icon: '📊',
        tone: 'purple',
        title: 'One row per (user, day)',
        detail: 'Dashboard tiles fetch a single row each, not N FoodEntries / N ExerciseSessions.',
      },
      {
        icon: '🔁',
        tone: 'red',
        title: 'Always live',
        detail: 'Refreshes incrementally as events stream in — zero batch jobs.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/indexes/map-reduce-indexes',
  },

  'queue-etl': {
    label: 'Queue ETL',
    title: 'RavenDB Queue ETL — activity fan-out',
    description:
      "Every new ExerciseSession flows into RabbitMQ via Queue ETL. The transform script does the real work: it load()s the actor's UserProfile, walks the Follows list embedded on that doc, and emits ONE message per follower with the recipient baked into the payload. The standalone FitAssistant.FitFeed worker consumes the queue and projects each event onto the recipient's feed. Per ADR-0004.",
    challenges: [
      {
        icon: '🪄',
        tone: 'purple',
        title: 'Server-side fan-out',
        detail: "The JS transform walks UserProfile.Follows and emits per-follower messages — no app-level routing layer.",
      },
      {
        icon: '🧱',
        tone: 'blue',
        title: 'Genuine decoupling',
        detail: "FitFeed runs in its own process, with its own HTTP surface and event-driven read model. Aspire dashboard shows the seam clearly.",
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'No audience → no publish',
        detail: "Empty Follows list means the loop emits zero messages. Privacy modeled by the graph, not a flag.",
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/server/ongoing-tasks/etl/queue-etl/queue-etl-overview',
  },

  'olap-etl': {
    label: 'OLAP ETL',
    title: 'RavenDB OLAP ETL — Parquet data lake',
    description:
      "The Trends tab is powered by a second outbound ETL: RavenDB projects each ExerciseSession into daily-partitioned Parquet files on MinIO. Embedded DuckDB in the main backend reads those files via httpfs — analytical SQL with no warehouse, no ingest job. Same source as the activity feed; different workload, different primitive.",
    challenges: [
      {
        icon: '📦',
        tone: 'blue',
        title: 'Columnar data lake, no warehouse',
        detail: "Parquet on S3-compatible storage. DuckDB embedded in-process queries it directly via httpfs — zero infrastructure beyond the existing MinIO container.",
      },
      {
        icon: '✂️',
        tone: 'purple',
        title: 'Partition + column pruning',
        detail: "Hive-style year=/month=/day= partitions plus columnar storage mean a 'this week' query touches only 7 small files and reads only the columns it needs.",
      },
      {
        icon: '🎯',
        tone: 'green',
        title: 'Right primitive per workload',
        detail: "RavenDB owns the operational path. DuckDB owns cross-user analytical aggregations. The split is honest about which engine is best at what.",
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/server/ongoing-tasks/etl/olap-etl/olap-etl-overview',
  },

  'tool-actions': {
    label: 'Tool Actions',
    title: 'AI Agent Tool Actions',
    description:
      "LogFoodEntry and LogExercise are the model's write surface. The LLM produces structured output that matches the action's schema; RavenDB routes the call to a C# handler that persists the entry. The contract is the tool schema, not freeform text — there's no parser between the model and the database.",
    challenges: [
      {
        icon: '✍️',
        tone: 'purple',
        title: 'Typed write surface',
        detail: 'Action arguments are a typed schema. The C# handler receives a parsed object, not a string.',
      },
      {
        icon: '🔁',
        tone: 'blue',
        title: 'Sub-agent passthrough',
        detail: "The food-photo sub-agent's LogFoodEntry is routed under {subagent}/{action} — same handler, same write path.",
      },
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Server-enforced contract',
        detail: 'If the model returns malformed args, RavenDB rejects the call before the handler runs.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'tool-queries': {
    label: 'Tool Queries',
    title: 'Bounded RQL Tool Queries (AI Agents + GenAI Tasks)',
    description:
      "Tool queries are fixed RQL registered alongside an AI Agent OR a GenAI Task. The LLM calls them like functions; $userId is system-bound from context (ForbidModelGeneration) and overrides anything the model tries to inject. The daily-goals GenAI Task uses three: GetRecentExercises, GetKcalBurnedRollup, GetKcalIntakeRollup — including 'select timeseries(...)' projections, which are the documented workaround for GenAI scripts not being able to load time series directly. The chat agent uses six.",
    challenges: [
      {
        icon: '🔒',
        tone: 'green',
        title: 'Tenant-bounded',
        detail: '$userId is system-provided. The model never reaches another user, no matter what it tries.',
      },
      {
        icon: '📊',
        tone: 'purple',
        title: 'Time-series via tools',
        detail: "include timeseries(...) projections work because the runtime executes tool queries as a standard IndexQuery — the model pulls rollups on demand without the script knowing how.",
      },
      {
        icon: '⚡',
        tone: 'blue',
        title: 'No app glue',
        detail: "RQL strings are registered with the agent/task. No app-side proxy, no per-request validation code. The model decides when to call which.",
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'ai-agent-parameters': {
    label: 'AI Agent Parameters',
    title: 'RavenDB AI Agent Parameters',
    description:
      "The parent agent and every sub-agent receive a single userId parameter — a string, never sent to the model, substituted into every tool query's RQL via $userId. It carries ForbidModelGeneration, so the LLM cannot fabricate or override it; the SDK refuses calls that try. The agent physically cannot reach another user's data. Sub-agents inherit the parameter from the parent's conversation, so the boundary is enforced once.",
    challenges: [
      {
        icon: '🛡️',
        tone: 'green',
        title: 'Forbid model generation',
        detail: 'The LLM cannot invent userId — the SDK enforces it at every turn. Tenant scoping is not a prompt instruction.',
      },
      {
        icon: '🔁',
        tone: 'blue',
        title: 'Inherited by sub-agents',
        detail: 'When the parent delegates to fit-motivate / explain-workout / food-photo, the same userId parameter flows through automatically.',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Tenant boundary, server-side',
        detail: 'RQL substitution happens at registration time. The query string the model triggers is fixed; only the bound value changes.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },

  'ai-context-hashes': {
    label: '@ai-hashes',
    title: 'Built-in GenAI Dedup (@ai-hashes)',
    description:
      "When a GenAI Task script calls ai.genContext({...}), RavenDB hashes the context object and stores it under @metadata.@ai-hashes[<TaskIdentifier>]. On the next run, if the hash matches the previous one, the AI call is elided — no tokens, no UpdateScript, no waste. The context IS the declarative list of 'inputs that matter'; irrelevant mutations produce an identical hash and never reach the model.",
    challenges: [
      {
        icon: '⚡',
        tone: 'green',
        title: 'Zero-waste retriggers',
        detail: "The daily-goals task watches UserProfile. Edit Name, Theme, or IsPremium → context unchanged → AI elided, zero tokens. Edit Weight, FitnessGoal, or DailyCalorieGoal → context differs → AI runs. The user sees the difference, not the dev.",
      },
      {
        icon: '🔁',
        tone: 'purple',
        title: 'Loaded docs count too',
        detail: "The script load()s yesterday's DailyGoals doc and folds it into the context. If yesterday's fulfillment changes (e.g. user retroactively checks one off), today's hash differs at the next trigger and the AI regenerates with that knowledge. Cross-doc state participates in dedup for free.",
      },
      {
        icon: '🛡️',
        tone: 'blue',
        title: 'Server-enforced',
        detail: "Hash check lives in GenAiScriptTransformer.ProcessScriptResults — userland can't bypass it. Every GenAI Task in the database gets it for free; auto-coach benefits even though we wrote it before knowing the mechanism existed.",
      },
    ],
    docsUrl: 'https://docs.ravendb.net/7.2/ai-integration/gen-ai-integration/gen-ai-overview/',
  },

  streaming: {
    label: 'Streaming',
    title: 'AI Conversation Streaming',
    description:
      "The parent's reply streams to the chat panel token-by-token via RunAsync<T>'s field selector — RavenDB pipes the model's structured Answer field through Server-Sent Events as it generates. Sub-agent runs complete before the parent starts streaming, so the three-phase 'thinking' indicator covers the pre-stream pause.",
    challenges: [
      {
        icon: '⚡',
        tone: 'blue',
        title: 'First-word latency',
        detail: 'Tokens flow as the model generates — perceived latency drops from "full reply" to "first word".',
      },
      {
        icon: '🎯',
        tone: 'purple',
        title: 'Structured + streamed',
        detail: 'StreamAsync<T>("Answer", ...) streams ONE field of the structured output, not raw JSON.',
      },
      {
        icon: '🧵',
        tone: 'green',
        title: 'Same conversation, same stream',
        detail: 'Tool calls and sub-agent delegations resolve server-side; only the final prose tokens come down the wire.',
      },
    ],
    docsUrl: 'https://ravendb.net/docs/article-page/latest/csharp/ai-integration/ai-agents',
  },
};
