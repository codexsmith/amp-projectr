import {
  DeterministicKnowledgeEnricher,
  DeterministicKnowledgeSearcher,
} from "../../adapters/knowledge/deterministic";
import { isKnowledgeEnrichment } from "../../core/projectr/knowledge";
import type { KnowledgeMap, TranscriptSegment } from "../../core/projectr/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

async function run(): Promise<void> {
  const segments: TranscriptSegment[] = [
    { id: "video:1", sourceId: "video", startSeconds: 0, endSeconds: 10, text: "Database schemas preserve invariants and source evidence." },
    { id: "video:2", sourceId: "video", startSeconds: 10, endSeconds: 20, text: "Normalization preserves invariants and prevents update anomalies." },
    { id: "video:3", sourceId: "video", startSeconds: 20, endSeconds: 30, text: "Adapters preserve provider independence at system boundaries." },
  ];
  const knowledgeMap: KnowledgeMap = {
    sourceId: "video",
    topics: [
      { id: "topic:1", title: "Database / Normalization", startSeconds: 0, endSeconds: 20, segmentIds: ["video:1", "video:2"], keywords: ["database", "normalization", "invariants"] },
      { id: "topic:2", title: "Adapters / Boundaries", startSeconds: 20, endSeconds: 30, segmentIds: ["video:3"], keywords: ["adapters", "boundaries", "provider"] },
    ],
  };

  const enricher = new DeterministicKnowledgeEnricher();
  const enrichment = await enricher.enrich({ sourceId: "video", transcriptSegments: segments, knowledgeMap });
  assert(isKnowledgeEnrichment(enrichment), "deterministic enrichment should satisfy portable contract");
  assert(enrichment.concepts.some((concept) => concept.kind === "topic"), "topic concepts should be present");
  assert(enrichment.concepts.some((concept) => concept.kind === "term" && concept.terms.includes("preserve")), "repeated term concepts should be present");

  const searcher = new DeterministicKnowledgeSearcher();
  const hits = await searcher.search({
    sourceId: "video",
    transcriptSegments: segments,
    knowledgeMap,
    enrichment,
    query: "database",
  });

  equal(hits.length, 2, "topic concept should expand search to related evidence");
  assert(hits.some((hit) => hit.segmentId === "video:2"), "semantic topic link should surface a segment without the literal query term");
  assert(hits[0].score >= hits[1].score, "knowledge hits should be score ordered");

  const lexicalOnly = await searcher.search({
    sourceId: "video",
    transcriptSegments: segments,
    knowledgeMap,
    query: "provider",
  });
  equal(lexicalOnly.length, 1, "search should still work without enrichment");
  equal(lexicalOnly[0].segmentId, "video:3", "lexical fallback should preserve evidence location");

  let incoherent = false;
  try {
    await enricher.enrich({ sourceId: "wrong", transcriptSegments: segments, knowledgeMap });
  } catch {
    incoherent = true;
  }
  assert(incoherent, "cross-source enrichment should be rejected");

  console.log("Knowledge adapter tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
