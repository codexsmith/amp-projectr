# Projectr Architecture

## Rule: product contracts precede implementation frameworks

Projectr is not Next.js, Amplify, DynamoDB, Python, a particular AI model, a metadata service, a transcript library, or CorpusForge.

The product model must remain portable across language, UI framework, cloud provider, database, and external-provider changes.

```text
Portable contracts
      |
Domain model and pure transformations
      |
Application use cases
      |
Ports / provider interfaces
      |
Adapters: UI, metadata, transcript, persistence, interchange, AI, search index, etc.
```

## Current core

`core/projectr` contains plain TypeScript with no imports from Next.js, React, Amplify, AWS, browser storage, database clients, CorpusForge, or AI SDKs.

Portable contracts include `SourceVideo`, `SourceMetadata`, `TranscriptSegment`, `KnowledgeMap`, `SearchHit`, `SavedExploration`, and `ProjectrPackage`.

## Metadata boundary

```text
SourceMetadataProvider
  getMetadata(SourceVideo) -> SourceMetadata | null
```

The first adapter maps YouTube `videos.list` fields into portable metadata. Provider credentials and response shapes terminate inside the adapter. Metadata failure is non-fatal.

## Transcript boundary

```text
TranscriptProvider.getTranscript(SourceVideo) -> TranscriptCue[]
```

Current adapters are official YouTube captions for authorized videos, local VTT/SRT import, and a deterministic fixture.

## Persistence and admissibility boundary

```text
SavedExploration
  = SourceVideo
  + TranscriptSegment[]
  + KnowledgeMap
  + provider provenance
  + schema version / saved timestamp

ExplorationRepository
  save(SavedExploration)
  get(id)
  list()
  remove(id)
```

`isSavedExploration` is the shared runtime admissibility boundary used by persistence and interchange. It validates schema version, source identity, transcript/source agreement, knowledge-map/source agreement, and topic references to known transcript segments.

The browser local-storage adapter is only the first persistence implementation. Storage technology is not part of the Projectr ontology.

## Interchange boundary

External systems receive a versioned Projectr artifact rather than Projectr storage internals:

```text
ProjectrPackage
  mediaType
  schemaVersion
  exportedAt
  exploration: SavedExploration
```

The v1 media type is:

```text
application/vnd.boundaryfirst.projectr.exploration+json
```

The package is deliberately a Projectr contract. CorpusForge may consume it through an adapter, but Projectr does not depend on CorpusForge schemas, provenance stores, workflow concepts, or persistence models.

```text
Projectr core
    |
    v
ProjectrPackage
    |
    v
CorpusForge ingest adapter
    |
    v
CorpusForge
```

This keeps the dependency direction one-way and makes the same package usable by other future consumers.

## Dependency direction

```text
app/ ---------------------------------> core/projectr/
YouTube metadata adapter ------------> core/projectr/
YouTube transcript adapter ----------> core/projectr/
Browser persistence adapter ---------> core/projectr/
Future CorpusForge ingest adapter ---> ProjectrPackage
Future SQL / file / remote adapters --> core/projectr/
AI enrichment adapter ---------------> core/projectr/

core/projectr/ -X-> Next.js / YouTube API / Amplify / browser APIs / database / CorpusForge / AI SDK
```

Provider- and consumer-specific objects terminate at adapter boundaries. New capabilities should preserve this direction.
