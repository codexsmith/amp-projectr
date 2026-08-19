# Projectr / YouTube Knowledge Explorer

Projectr turns long-form video into searchable, navigable, structured knowledge while preserving a path back to the source.

The repository began as an AWS Amplify Gen2 + Next.js starter. The Projectr core is intentionally independent of that starter infrastructure.

## Architecture rule

> The product model must not be owned by its implementation language, UI framework, cloud provider, database, or AI provider.

Portable JSON contracts live in `contracts/projectr`. Executable domain logic lives in `core/projectr` and has no dependency on Next.js, React, Amplify, AWS, browser storage, a database client, an AI SDK, or a transcript library.

## Current vertical slice

Implemented behavior includes YouTube URL parsing, portable source metadata, transcript normalization/search, deterministic outline generation, timestamp navigation, official authorized-caption acquisition, VTT/SRT import, browser-local persistence, and versioned Projectr package import/export.

## Source metadata

Metadata is enrichment, not a prerequisite. The core defines:

```text
SourceMetadataProvider.getMetadata(SourceVideo) -> SourceMetadata | null
```

The first adapter uses the official YouTube Data API `videos.list` endpoint with `snippet,contentDetails`, translating provider responses into portable title, creator, duration, thumbnail-reference, and publication-time fields.

Configure either `PROJECTR_YOUTUBE_API_KEY` or `PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN`. If metadata is unavailable, transcript import/demo processing continues with source identity alone.

## Transcript acquisition

Projectr deliberately does not scrape the YouTube watch page. The official captions API requires OAuth and sufficient permission for the target video's caption tracks. For other lawful transcript sources, pair the YouTube URL with a `.vtt` or `.srt` file.

## Persistence

`SavedExploration` is the portable persisted artifact. It contains the enriched `SourceVideo`, normalized transcript segments, knowledge map, provider provenance, schema version, and save timestamp.

```text
ExplorationRepository
  save(exploration)
  get(id)
  list()
  remove(id)
```

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

`core/projectr/export.ts` creates, serializes, parses, and validates this package. Import uses the same `isSavedExploration` admissibility check as persistence, including source coherence and knowledge-map references back to known transcript segments.

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

The test command uses the repository's existing TypeScript dependency and Node and covers the portable core plus transcript, metadata, persistence, and package-interchange behavior.
