# Projectr Architecture

## Rule: product contracts precede implementation frameworks

Projectr is not Next.js, Amplify, DynamoDB, Python, a particular AI model, or a particular transcript library.

The product model must remain portable across language, UI framework, cloud provider, database, and AI provider changes.

```text
Portable contracts
      |
Domain model and pure transformations
      |
Application use cases
      |
Ports / provider interfaces
      |
Adapters: Next.js, transcript source, persistence, AI, search index, etc.
```

## Current core

`core/projectr` contains plain TypeScript with no imports from Next.js, React, Amplify, AWS, a database client, browser storage, or an AI SDK.

The canonical cross-language shapes live under `contracts/projectr` as JSON Schema. TypeScript is the first executable implementation of those contracts, not the definition of the product.

Current core capabilities:

- YouTube URL parsing and canonicalization
- transcript normalization
- transcript search
- deterministic time-window outline generation
- transcript-provider port
- persistence repository port
- portable saved-exploration contract
- fixture provider for deterministic development

## Dependency direction

Framework and infrastructure code may depend on the core. The core must not depend on framework or infrastructure code.

```text
app/ ---------------------------------> core/projectr/
YouTube transcript adapter ----------> core/projectr/
Browser local-storage adapter --------> core/projectr/
Future SQL / Dynamo / file adapter ---> core/projectr/
AI enrichment adapter ---------------> core/projectr/

core/projectr/ -X-> Next.js / Amplify / browser APIs / database / AI SDK
```

## Portable contracts

- `SourceVideo`
- `TranscriptSegment`
- `KnowledgeMap` / `TopicNode`
- `SearchHit`
- `SavedExploration`

A later C#, Python, Rust, or other implementation should be able to consume or generate the same contract shapes without changing Projectr's product semantics.

## Transcript adapter policy

Transcript acquisition terminates at a small port:

```text
TranscriptProvider.getTranscript(SourceVideo) -> TranscriptCue[]
```

The current adapters are the official YouTube captions API for authorized videos, local VTT/SRT import, and a deterministic fixture.

## Persistence boundary

A persisted Projectr exploration is a portable artifact, not a database row shape:

```text
SavedExploration
  = SourceVideo
  + TranscriptSegment[]
  + KnowledgeMap
  + provider provenance
  + schema version / saved timestamp
```

Persistence mechanisms implement:

```text
ExplorationRepository
  save(SavedExploration)
  get(id)
  list()
  remove(id)
```

The first adapter uses browser local storage because it is dependency-free and makes the vertical slice executable. It is not the long-term storage ontology. IndexedDB, SQLite, filesystem, Postgres, DynamoDB, or a remote service can replace it without changing `SavedExploration` or the application-facing repository contract.

## Adapter policy

Future external capabilities should follow the same pattern for metadata resolution, AI enrichment, search indexing, export, and Corpus Forge integration. Provider-specific objects terminate at their adapter boundaries.
