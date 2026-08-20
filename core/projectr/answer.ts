import type { KnowledgeAnswer, KnowledgeEnrichment, KnowledgeMap, TranscriptSegment } from "./types";

export interface KnowledgeAnswerInput {
  sourceId: string;
  question: string;
  transcriptSegments: TranscriptSegment[];
  knowledgeMap: KnowledgeMap;
  enrichment?: KnowledgeEnrichment;
  maxEvidence?: number;
}

export interface KnowledgeAnswerer {
  answer(input: KnowledgeAnswerInput): Promise<KnowledgeAnswer>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sameNumber(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.000001;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isKnowledgeAnswer(value: unknown): value is KnowledgeAnswer {
  if (!isRecord(value)
    || typeof value.sourceId !== "string"
    || typeof value.question !== "string"
    || (value.status !== "answered" && value.status !== "insufficient_evidence")
    || !Array.isArray(value.claims)
    || !Array.isArray(value.evidence)
    || !isRecord(value.generatedBy)
    || typeof value.generatedBy.generator !== "string"
    || value.generatedBy.generator.length === 0
    || (value.generatedBy.version !== undefined && typeof value.generatedBy.version !== "string")) {
    return false;
  }

  const claimIds = new Set<string>();
  for (const claim of value.claims) {
    if (!isRecord(claim)
      || typeof claim.id !== "string"
      || claim.id.length === 0
      || claimIds.has(claim.id)
      || typeof claim.text !== "string"
      || claim.text.trim().length === 0
      || !isStringArray(claim.evidenceSegmentIds)
      || claim.evidenceSegmentIds.length === 0) {
      return false;
    }
    claimIds.add(claim.id);
  }

  const evidenceIds = new Set<string>();
  for (const evidence of value.evidence) {
    if (!isRecord(evidence)
      || typeof evidence.segmentId !== "string"
      || evidenceIds.has(evidence.segmentId)
      || typeof evidence.startSeconds !== "number"
      || !Number.isFinite(evidence.startSeconds)
      || typeof evidence.endSeconds !== "number"
      || !Number.isFinite(evidence.endSeconds)
      || evidence.endSeconds < evidence.startSeconds
      || typeof evidence.excerpt !== "string"
      || evidence.excerpt.length === 0
      || typeof evidence.score !== "number"
      || !Number.isFinite(evidence.score)
      || evidence.score < 0
      || !isStringArray(evidence.matchedTerms)
      || !isStringArray(evidence.matchedConceptIds)
      || !isStringArray(evidence.topicIds)) {
      return false;
    }
    evidenceIds.add(evidence.segmentId);
  }

  return value.status === "answered"
    ? value.claims.length > 0 && value.evidence.length > 0
    : value.claims.length === 0 && value.evidence.length === 0;
}

export function isKnowledgeAnswerAdmissible(
  answer: unknown,
  input: KnowledgeAnswerInput,
): answer is KnowledgeAnswer {
  if (!isKnowledgeAnswer(answer)
    || answer.sourceId !== input.sourceId
    || compactWhitespace(answer.question) !== compactWhitespace(input.question)) {
    return false;
  }

  const segmentsById = new Map(input.transcriptSegments.map((segment) => [segment.id, segment]));
  const topicIds = new Set(input.knowledgeMap.topics.map((topic) => topic.id));
  const conceptIds = new Set(input.enrichment?.concepts.map((concept) => concept.id) ?? []);
  const evidenceIds = new Set<string>();

  for (const evidence of answer.evidence) {
    const segment = segmentsById.get(evidence.segmentId);
    if (!segment
      || segment.sourceId !== input.sourceId
      || evidence.excerpt !== segment.text
      || !sameNumber(evidence.startSeconds, segment.startSeconds)
      || !sameNumber(evidence.endSeconds, segment.endSeconds)
      || evidence.topicIds.some((id) => !topicIds.has(id))
      || evidence.matchedConceptIds.some((id) => !conceptIds.has(id))) {
      return false;
    }
    evidenceIds.add(evidence.segmentId);
  }

  return answer.claims.every((claim) =>
    claim.evidenceSegmentIds.every((segmentId) => evidenceIds.has(segmentId))
  );
}

export async function answerWithEvidence(
  answerer: KnowledgeAnswerer,
  input: KnowledgeAnswerInput,
): Promise<KnowledgeAnswer> {
  if (!compactWhitespace(input.question)) {
    throw new Error("A question is required.");
  }
  if (input.knowledgeMap.sourceId !== input.sourceId
    || input.transcriptSegments.some((segment) => segment.sourceId !== input.sourceId)
    || (input.enrichment && input.enrichment.sourceId !== input.sourceId)) {
    throw new Error("Knowledge answer input crosses source boundaries.");
  }

  const answer = await answerer.answer(input);
  if (!isKnowledgeAnswerAdmissible(answer, input)) {
    throw new Error("Knowledge answer escaped the loaded exploration evidence boundary.");
  }
  return answer;
}
