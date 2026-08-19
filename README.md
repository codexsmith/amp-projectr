# Projectr / YouTube Knowledge Explorer

Projectr turns long-form video into searchable, navigable, structured knowledge while preserving a path back to the source.

The repository began as an AWS Amplify Gen2 + Next.js starter. The Projectr core is intentionally independent of that starter infrastructure.

## Architecture rule

> The product model must not be owned by its implementation language, UI framework, cloud provider, database, or AI provider.

Portable JSON contracts live in `contracts/projectr`. Executable domain logic lives in `core/projectr` and has no dependency on Next.js, React, Amplify, AWS, browser storage, a database client, an AI SDK, or a transcript library.

## Current vertical slice

Implemented behavior includes YouTube URL parsing, portable source metadata, transcript normalization/search, deterministic outline generation, timestamp navigation, official authorized-caption acquisition, VTT/SRT import, browser-local save/load/remove, and a thin Next.js UI.

## Source metadata

Metadata is enrichment, not a prerequisite. The core defines:

```text
SourceMetadataProvider.getMetadata(SourceVideo) -> SourceMetadata | null
```

The first adapter uses the official YouTube Data API `videos.list` endpoint with `snippet,contentDetails`, translating the provider response into portable fields:

- title
- creator name
- duration in seconds
- thumbnail reference
- publication time

Configure either:

```bash
PROJECTR_YOUTUBE_API_KEY=...
```

or reuse an authorized OAuth token:

```bash
PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN=...
```

An API key is sufficient for ordinary public-video metadata. If metadata is unavailable or unconfigured, transcript import/demo processing continues with the parsed source ID and canonical URL.

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

The first implementation uses browser local storage. SQLite, filesystem, IndexedDB, Postgres, DynamoDB, or a remote service can replace it without changing the domain contract. Existing snapshots remain readable because metadata fields are optional additions to `SourceVideo`.

## Run

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test:core
```

The test command uses the repository's existing TypeScript dependency and Node and covers the portable core plus transcript, metadata, and persistence adapters.
