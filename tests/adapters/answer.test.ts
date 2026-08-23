import { DeterministicKnowledgeAnswerer } from "../../adapters/knowledge/deterministic-answer";
import { answerWithEvidence, isKnowledgeAnswerAdmissible } from "../../core/projectr/answer";
import type { KnowledgeSearchInput, KnowledgeSearcher } from "../../core/projectr/knowledge";
import type { KnowledgeAnswer, KnowledgeMap, KnowledgeSearchHit, TranscriptSegment } from "../../core/projectr/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

class StubSearcher implements KnowledgeSearcher {
  constructor(private readonly hits: KnowledgeSearchHit[]) {}
  async search(_input: KnowledgeSearchInput): Promise<KnowledgeSearchHit[]> {
    return this.hits;
  }
}

async function run(): Promise<void> {
  const segments: TranscriptSegment[] = [
    { id: "video:1", sourceId: "video", startSeconds: 10, endSeconds: 20, text: "Normalization preserves invariants and prevents update anomalies." },
    { id: "video:2", sourceId: "video", startSeconds: 20, endSeconds: 30, text: "Adapters keep provider choices outside the product model." },
  ];
  const knowledgeMap: KnowledgeMap = {
    sourceId: "video",
    topics: [
      { id: "topic:1", title: "Normalization", startSeconds: 10, endSeconds: 20, segmentIds: ["video:1"], keywords: ["normalization", "invariants"] },
      { id: "topic:2", title: "Adapters", startSeconds: 20, endSeconds: 30, segmentIds: ["video:2"], keywords: ["adapters", "provider"] },
    ],
  };
  const enrichment = {
    sourceId: "video",
    generatedBy: { generator: "test" },
    concepts: [
      { id: "concept:1", sourceId: "video", kind: "topic" as const, label: "Normalization", terms: ["normalization"], segmentIds: ["video:1"], topicIds: ["topic:1"], score: 1 },
    ],
  };
  const hits: KnowledgeSearchHit[] = [
    { segmentId: "video:1", startSeconds: 10, endSeconds: 20, text: segments[0].text, score: 4, matchedTerms: ["normalization"], matchedConceptIds: ["concept:1"], topicIds: ["topic:1"] },
  ];

  const answer = await answerWithEvidence(new DeterministicKnowledgeAnswerer(new StubSearcher(hits)), {
    sourceId: "video",
    question: "What does normalization preserve?",
    transcriptSegments: segments,
    knowledgeMap,
    enrichment,
  });
  equal(answer.status, "answered", "evidence hit should answer");
  equal(answer.claims.length, 1, "answer should create one evidence-bound claim");
  equal(answer.claims[0].text, segments[0].text, "baseline claim should be extractive");
  equal(answer.claims[0].evidenceSegmentIds[0], "video:1", "claim should cite its segment");
  assert(isKnowledgeAnswerAdmissible(answer, {
    sourceId: "video",
    question: answer.question,
    transcriptSegments: segments,
    knowledgeMap,
    enrichment,
  }), "valid answer should be admissible");

  const none = await answerWithEvidence(new DeterministicKnowledgeAnswerer(new StubSearcher([])), {
    sourceId: "video",
    question: "What is not discussed?",
    transcriptSegments: segments,
    knowledgeMap,
    enrichment,
  });
  equal(none.status, "insufficient_evidence", "no evidence should not fabricate an answer");
  equal(none.claims.length, 0, "insufficient answer should contain no claims");

  const forged: KnowledgeAnswer = {
    ...answer,
    evidence: [{ ...answer.evidence[0], segmentId: "missing" }],
  };
  assert(!isKnowledgeAnswerAdmissible(forged, {
    sourceId: "video",
    question: answer.question,
    transcriptSegments: segments,
    knowledgeMap,
    enrichment,
  }), "dangling evidence should fail");

  const inventedExcerpt: KnowledgeAnswer = {
    ...answer,
    evidence: [{ ...answer.evidence[0], excerpt: "Invented support." }],
  };
  assert(!isKnowledgeAnswerAdmissible(inventedExcerpt, {
    sourceId: "video",
    question: answer.question,
    transcriptSegments: segments,
    knowledgeMap,
    enrichment,
  }), "evidence excerpt must equal source text");

  let crossed = false;
  try {
    await answerWithEvidence(new DeterministicKnowledgeAnswerer(new StubSearcher(hits)), {
      sourceId: "wrong",
      question: "test",
      transcriptSegments: segments,
      knowledgeMap,
      enrichment,
    });
  } catch {
    crossed = true;
  }
  assert(crossed, "cross-source answer input should fail before provider output is accepted");

  console.log("Knowledge answer tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
