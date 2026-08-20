# Projectr / YouTube Knowledge Explorer

Projectr turns long-form video into searchable, navigable, structured knowledge while preserving a path back to the source.

The repository began as an AWS Amplify Gen2 + Next.js starter. The Projectr core is intentionally independent of that starter infrastructure.

## Architecture rule

> The product model must not be owned by its implementation language, UI framework, cloud provider, database, or AI provider.

Portable JSON contracts live in `contracts/projectr`. Executable domain logic lives in `core/projectr` and has no dependency on Next.js, React, Amplify, AWS, browser storage, a database client, an AI SDK, or a transcript library.

## Current vertical slice

Implemented behavior includes YouTube URL parsing, portable source metadata, transcript normalization/exact search, deterministic outline generation, portable concept enrichment, concept-linked evidence retrieval, evidence-bound question answering, timestamp navigation, official authorized-caption acquisition, VTT/SRT import, browser-local persistence, and versioned Projectr package import/export.

## Source metadata

Metadata is enrichment, not a prerequisite. The core defines:

```text
SourceMetadataProvider.getMetadata(SourceVideo) -> SourceMetadata | null
```

The first adapter uses the official YouTube Data API `videos.list` endpoint with `snippet,contentDetails`, translating provider responses into portable title, creator, duration, thumbnail-reference, and publication-time fields.

Configure either `PROJECTR_YOUTUBE_API_KEY` or `PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN`. If metadata is unavailable or unconfigured, transcript import/demo processing continues with source identity alone.

## Transcript acquisition

Projectr deliberately does not scrape the YouTube watch page. The official captions API requires OAuth and sufficient permission for the target video's caption tracks. For other lawful transcript sources, pair the YouTube URL with a `.vtt` or `.srt` file.

## Knowledge enrichment and retrieval

AI is an adapter choice, not a Projectr primitive. The core defines:

```text
KnowledgeEnricher.enrich(source + transcript + knowledge map) -> KnowledgeEnrichment
KnowledgeSearcher.search(query + evidence + optional enrichment) -> KnowledgeSearchHit[]
```

`KnowledgeEnrichment` contains portable concepts linked back to the transcript segments and outline topics that support them. The first adapter is deterministic: it turns outline topics and repeated transcript terms into concepts, then ranks direct transcript matches together with concept-linked evidence.

That means the product has an executable enrichment/search path without an embeddings service or LLM. A later embeddings, vector-index, local-model, or hosted-LLM adapter can implement the same ports without changing persisted Projectr artifacts or UI use cases.

## Evidence-bound answers

Question answering is a separate use case from retrieval:

```text
KnowledgeAnswerer.answer(question + source evidence) -> KnowledgeAnswer
answerWithEvidence(KnowledgeAnswerer, input) -> validated KnowledgeAnswer
```

`KnowledgeAnswer` is claim-oriented rather than a free-floating chat string. Every answered claim must name one or more evidence segment IDs. The core admissibility check also requires evidence IDs, exact excerpts, timestamps, topic references, and concept references to resolve inside the currently loaded exploration.

The first answer adapter is deterministic and extractive. It asks the existing `KnowledgeSearcher` for ranked evidence and returns source text as claims. If no evidence is found, it returns `insufficient_evidence` instead of fabricating an answer.

A future LLM adapter may synthesize claim text, but it must pass the same evidence-boundary validation. Model choice therefore does not own provenance or retrieval.

Answers are currently ephemeral derived results; they are not added to `SavedExploration` v1. The persisted artifact remains the source, transcript, map, enrichment, and provider provenance from which answers can be recomputed.

## Persistence

`SavedExploration` is the portable persisted artifact. It contains the enriched `SourceVideo`, normalized transcript segments, knowledge map, optional portable knowledge enrichment, provider provenance, schema version, and save timestamp.

```text
ExplorationRepository
  save(exploration)
  get(id)
  list()
  remove(id)
```

The shared admissibility check rejects enrichment whose source, segment references, or topic references escape the exploration evidence graph. Older v1 snapshots without enrichment remain valid; the field is optional.

The first implementation uses browser local storage. SQLite, filesystem, IndexedDB, Postgres, DynamoDB, or a remote service can replace it without changing the domain contract.

## Portable interchange

Projectr exports a versioned JSON envelope around `SavedExploration`:

```text
ProjectrPackage
  mediaType = application/vnd.boundaryfirst.projectr.exploration+json
  schemaVersion = 1
  exportedAt
  exploration: SavedExploration
```

`core/projectr/export.ts` creates, serializes, parses, and validates this package. Import uses the same `isSavedExploration` admissibility check as persistence, including source coherence, topic references to known transcript segments, and enrichment references to known evidence.

The browser UI can export the loaded exploration or any locally saved exploration and can import a package without automatically persisting it.

CorpusForge is an external consumer of this boundary, not part of the Projectr model:

```text
Projectr -> ProjectrPackage -> CorpusForge ingest adapter -> CorpusForge
```

A CorpusForge adapter may translate the package into corpus/source/provenance structures, but Projectr does not import CorpusForge types or storage concepts.

## Run

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test:core
```

The test command uses the repository's existing TypeScript dependency and Node and covers the portable core plus transcript, metadata, deterministic knowledge enrichment/search, evidence-bound answering, persistence, and package-interchange behavior.
