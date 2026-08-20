# Projectr Architecture

## Rule: product contracts precede implementation frameworks

Projectr is not Next.js, Amplify, DynamoDB, Python, a particular AI model, a metadata service, a transcript library, a vector database, or CorpusForge.

The product model must remain portable across language, UI framework, cloud provider, database, search implementation, model provider, and external-provider changes.

```text
Portable contracts
      |
Domain model and pure transformations
      |
Application use cases
      |
Ports / provider interfaces
      |
Adapters: UI, metadata, transcript, enrichment, search, answering, persistence, interchange, etc.
```

## Current core

`core/projectr` contains plain TypeScript with no imports from Next.js, React, Amplify, AWS, browser storage, database clients, vector stores, CorpusForge, or AI SDKs.

Portable contracts include `SourceVideo`, `SourceMetadata`, `TranscriptSegment`, `KnowledgeMap`, `SearchHit`, `KnowledgeEnrichment`, `KnowledgeSearchHit`, `KnowledgeAnswer`, `SavedExploration`, and `ProjectrPackage`.

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

## Knowledge enrichment and search boundary

```text
KnowledgeEnricher
  enrich(sourceId + TranscriptSegment[] + KnowledgeMap) -> KnowledgeEnrichment

KnowledgeSearcher
  search(query + TranscriptSegment[] + KnowledgeMap + optional KnowledgeEnrichment)
    -> KnowledgeSearchHit[]
```

The portable enrichment object does not contain model-specific embeddings, SDK response objects, vector-database rows, or prompt structures. It contains concepts and their evidence links: source ID, segment IDs, topic IDs, terms, label, score, and generator provenance.

The first adapter is deterministic. It derives topic concepts from the outline and repeated term concepts from transcript evidence. Its searcher ranks direct lexical matches together with concept-linked evidence, so selecting a topic concept can surface related segments even when a literal query term is absent from that segment.

Future embeddings, vector-index, local-model, hosted-LLM, or hybrid adapters implement the same ports. Model choice is infrastructure.

## Evidence-bound answer boundary

```text
KnowledgeAnswerer
  answer(question + transcript + map + optional enrichment) -> KnowledgeAnswer

answerWithEvidence
  invoke provider -> validate source/evidence closure -> return KnowledgeAnswer
```

A `KnowledgeAnswer` contains claims and evidence rather than an unstructured chat string. An answered claim must reference at least one evidence segment. The core validation boundary requires every evidence segment to exist in the current transcript, carry the exact source excerpt and timestamps, and reference only known topics and concepts. `insufficient_evidence` contains no claims and no invented evidence.

The first adapter is deterministic and extractive: it delegates retrieval to `KnowledgeSearcher`, converts the highest-ranked source segments into claims, and returns insufficient evidence when retrieval is empty. A future LLM may synthesize claim text behind `KnowledgeAnswerer`, but it cannot bypass `answerWithEvidence` without leaving the supported application boundary.

Answers are derived runtime results, not persisted source artifacts in v1. This avoids turning transient model output into source truth and keeps `SavedExploration` focused on recomputable evidence and enrichment.

## Persistence and admissibility boundary

```text
SavedExploration
  = SourceVideo
  + TranscriptSegment[]
  + KnowledgeMap
  + optional KnowledgeEnrichment
  + provider provenance
  + schema version / saved timestamp

ExplorationRepository
  save(SavedExploration)
  get(id)
  list()
  remove(id)
```

`isSavedExploration` is the shared runtime admissibility boundary used by persistence and interchange. It validates schema version, source identity, transcript/source agreement, knowledge-map/source agreement, topic references to known transcript segments, and enrichment references to known segments/topics. Enrichment cannot escape the exploration evidence graph.

The enrichment property is an optional additive v1 field, so existing v1 snapshots remain readable. The browser local-storage adapter is only the first persistence implementation. Storage technology is not part of the Projectr ontology.

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
Deterministic knowledge adapter -----> core/projectr/
Deterministic answer adapter --------> core/projectr/
Browser persistence adapter ---------> core/projectr/
Future embedding / LLM adapter ------> core/projectr/
Future vector-index adapter ---------> core/projectr/
Future CorpusForge ingest adapter ---> ProjectrPackage
Future SQL / file / remote adapters --> core/projectr/

core/projectr/ -X-> Next.js / YouTube API / Amplify / browser APIs / database / vector DB / CorpusForge / AI SDK
```

Provider- and consumer-specific objects terminate at adapter boundaries. New capabilities should preserve this direction.
