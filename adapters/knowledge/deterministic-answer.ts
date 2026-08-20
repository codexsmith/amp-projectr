import type { KnowledgeAnswerer, KnowledgeAnswerInput } from "../../core/projectr/answer";
import type { KnowledgeSearcher } from "../../core/projectr/knowledge";
import type { KnowledgeAnswer, KnowledgeAnswerEvidence } from "../../core/projectr/types";

export class DeterministicKnowledgeAnswerer implements KnowledgeAnswerer {
  constructor(private readonly searcher: KnowledgeSearcher) {}

  async answer(input: KnowledgeAnswerInput): Promise<KnowledgeAnswer> {
    const question = input.question.replace(/\s+/g, " ").trim();
    const hits = await this.searcher.search({
      sourceId: input.sourceId,
      transcriptSegments: input.transcriptSegments,
      knowledgeMap: input.knowledgeMap,
      enrichment: input.enrichment,
      query: question,
      maxResults: Math.max(1, input.maxEvidence ?? 3),
    });

    if (hits.length === 0) {
      return {
        sourceId: input.sourceId,
        question,
        status: "insufficient_evidence",
        claims: [],
        evidence: [],
        generatedBy: { generator: "deterministic-extractive", version: "1" },
      };
    }

    const evidence: KnowledgeAnswerEvidence[] = hits.map((hit) => ({
      segmentId: hit.segmentId,
      startSeconds: hit.startSeconds,
      endSeconds: hit.endSeconds,
      excerpt: hit.text,
      score: hit.score,
      matchedTerms: [...hit.matchedTerms],
      matchedConceptIds: [...hit.matchedConceptIds],
      topicIds: [...hit.topicIds],
    }));

    return {
      sourceId: input.sourceId,
      question,
      status: "answered",
      claims: evidence.map((item, index) => ({
        id: `${input.sourceId}:answer:claim:${index + 1}`,
        text: item.excerpt,
        evidenceSegmentIds: [item.segmentId],
      })),
      evidence,
      generatedBy: { generator: "deterministic-extractive", version: "1" },
    };
  }
}
