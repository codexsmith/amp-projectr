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

`core/projectr` contains plain TypeScript with no imports from Next.js, React, Amplify, AWS, a database client, or an AI SDK.

The canonical cross-language shapes live under `contracts/projectr` as JSON Schema. TypeScript is the first executable implementation of those contracts, not the definition of the product.

Current core capabilities:

- YouTube URL parsing and canonicalization
- transcript normalization
- transcript search
- deterministic time-window outline generation
- transcript-provider port
- fixture provider for the first UI slice

## Dependency direction

Framework and infrastructure code may depend on the core. The core must not depend on framework or infrastructure code.

```text
app/ -----------------------> core/projectr/
Amplify adapter -----------> core/projectr/
YouTube transcript adapter -> core/projectr/
AI enrichment adapter -----> core/projectr/

core/projectr/ -X-> Next.js / Amplify / database / AI SDK
```

## Portable contracts

- `SourceVideo`
- `TranscriptSegment`
- `KnowledgeMap` / `TopicNode`
- `SearchHit`

A later C#, Python, Rust, or other implementation should be able to consume or generate the same contract shapes without changing Projectr's product semantics.

## Adapter policy

External capabilities belong behind small interfaces. Current example:

```text
TranscriptProvider.getTranscript(SourceVideo) -> TranscriptCue[]
```

Future ports should follow the same pattern for persistence, metadata resolution, AI enrichment, and search indexing.

## First-slice limitation

The initial UI uses a fixture transcript provider deliberately. This validates URL parsing, normalization, search, timestamp navigation, and deterministic outline generation without prematurely selecting a YouTube transcript library or remote service.

A live transcript adapter is the next infrastructure task and must replace the fixture through `TranscriptProvider`, not by leaking provider-specific objects into the core.
