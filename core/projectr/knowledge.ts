import type {
  KnowledgeEnrichment,
  KnowledgeMap,
  KnowledgeSearchHit,
  TranscriptSegment,
} from "./types";

export interface KnowledgeEnrichmentInput {
  sourceId: string;
  transcriptSegments: TranscriptSegment[];
  knowledgeMap: KnowledgeMap;
}

export interface KnowledgeSearchInput extends KnowledgeEnrichmentInput {
  query: string;
  enrichment?: KnowledgeEnrichment;
  maxResults?: number;
}

export interface KnowledgeEnricher {
  enrich(input: KnowledgeEnrichmentInput): Promise<KnowledgeEnrichment>;
}

export interface KnowledgeSearcher {
  search(input: KnowledgeSearchInput): Promise<KnowledgeSearchHit[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isKnowledgeEnrichment(value: unknown): value is KnowledgeEnrichment {
  if (!isRecord(value) || typeof value.sourceId !== "string" || value.sourceId.length === 0) {
    return false;
  }
  if (!isRecord(value.generatedBy) || typeof value.generatedBy.generator !== "string"
    || value.generatedBy.generator.length === 0) {
    return false;
  }
  if (value.generatedBy.version !== undefined && typeof value.generatedBy.version !== "string") {
    return false;
  }
  if (!Array.isArray(value.concepts)) return false;

  const ids = new Set<string>();
  for (const concept of value.concepts) {
    if (!isRecord(concept)
      || typeof concept.id !== "string"
      || concept.id.length === 0
      || ids.has(concept.id)
      || concept.sourceId !== value.sourceId
      || (concept.kind !== "topic" && concept.kind !== "term")
      || typeof concept.label !== "string"
      || concept.label.length === 0
      || !isStringArray(concept.terms)
      || !isStringArray(concept.segmentIds)
      || !isStringArray(concept.topicIds)
      || typeof concept.score !== "number"
      || !Number.isFinite(concept.score)
      || concept.score < 0) {
      return false;
    }
    ids.add(concept.id);
  }
  return true;
}
