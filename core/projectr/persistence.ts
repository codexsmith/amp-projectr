import { isKnowledgeEnrichment } from "./knowledge";
import type {
  KnowledgeEnrichment,
  KnowledgeMap,
  SourceVideo,
  TopicNode,
  TranscriptSegment,
} from "./types";

export const SAVED_EXPLORATION_SCHEMA_VERSION = 1 as const;

export interface SavedExploration {
  schemaVersion: typeof SAVED_EXPLORATION_SCHEMA_VERSION;
  id: string;
  savedAt: string;
  source: SourceVideo;
  transcriptSegments: TranscriptSegment[];
  knowledgeMap: KnowledgeMap;
  enrichment?: KnowledgeEnrichment;
  providerLabel?: string;
}

export interface ExplorationSummary {
  id: string;
  savedAt: string;
  source: SourceVideo;
  segmentCount: number;
  topicCount: number;
  conceptCount: number;
  providerLabel?: string;
}

export interface ExplorationRepository {
  save(exploration: SavedExploration): Promise<void>;
  get(id: string): Promise<SavedExploration | null>;
  list(): Promise<ExplorationSummary[]>;
  remove(id: string): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSourceVideo(value: unknown): value is SourceVideo {
  if (!isRecord(value)) return false;
  return value.kind === "youtube"
    && typeof value.sourceId === "string"
    && value.sourceId.length > 0
    && typeof value.canonicalUrl === "string"
    && value.canonicalUrl.length > 0
    && (value.title === undefined || typeof value.title === "string")
    && (value.creatorName === undefined || typeof value.creatorName === "string")
    && (value.durationSeconds === undefined
      || (isFiniteNumber(value.durationSeconds) && value.durationSeconds >= 0))
    && (value.thumbnailUrl === undefined || typeof value.thumbnailUrl === "string")
    && (value.publishedAt === undefined || typeof value.publishedAt === "string");
}

function isTranscriptSegment(value: unknown, sourceId: string): value is TranscriptSegment {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && value.sourceId === sourceId
    && isFiniteNumber(value.startSeconds)
    && value.startSeconds >= 0
    && isFiniteNumber(value.endSeconds)
    && value.endSeconds >= value.startSeconds
    && typeof value.text === "string";
}

function isTopicNode(value: unknown, segmentIds: Set<string>): value is TopicNode {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.title === "string"
    && isFiniteNumber(value.startSeconds)
    && value.startSeconds >= 0
    && isFiniteNumber(value.endSeconds)
    && value.endSeconds >= value.startSeconds
    && isStringArray(value.segmentIds)
    && value.segmentIds.every((id) => segmentIds.has(id))
    && isStringArray(value.keywords);
}

function copyEnrichment(enrichment: KnowledgeEnrichment): KnowledgeEnrichment {
  return {
    sourceId: enrichment.sourceId,
    generatedBy: { ...enrichment.generatedBy },
    concepts: enrichment.concepts.map((concept) => ({
      ...concept,
      terms: [...concept.terms],
      segmentIds: [...concept.segmentIds],
      topicIds: [...concept.topicIds],
    })),
  };
}

export function explorationIdFor(source: SourceVideo): string {
  return `${source.kind}:${source.sourceId}`;
}

export function isSavedExploration(value: unknown): value is SavedExploration {
  if (!isRecord(value) || value.schemaVersion !== SAVED_EXPLORATION_SCHEMA_VERSION) return false;
  if (typeof value.id !== "string" || typeof value.savedAt !== "string") return false;
  if (Number.isNaN(Date.parse(value.savedAt))) return false;

  const source = value.source;
  if (!isSourceVideo(source)) return false;
  if (value.id !== explorationIdFor(source)) return false;
  if (!Array.isArray(value.transcriptSegments)) return false;
  if (!value.transcriptSegments.every((segment) => isTranscriptSegment(segment, source.sourceId))) {
    return false;
  }

  if (!isRecord(value.knowledgeMap) || value.knowledgeMap.sourceId !== source.sourceId) return false;
  if (!Array.isArray(value.knowledgeMap.topics)) return false;
  const segmentIds = new Set(value.transcriptSegments.map((segment) => segment.id));
  if (!value.knowledgeMap.topics.every((topic) => isTopicNode(topic, segmentIds))) return false;

  const topicIds = new Set(value.knowledgeMap.topics.map((topic) => topic.id));
  if (value.enrichment !== undefined) {
    if (!isKnowledgeEnrichment(value.enrichment)
      || value.enrichment.sourceId !== source.sourceId
      || value.enrichment.concepts.some((concept) =>
        concept.segmentIds.some((id) => !segmentIds.has(id))
        || concept.topicIds.some((id) => !topicIds.has(id)))) {
      return false;
    }
  }

  return value.providerLabel === undefined || typeof value.providerLabel === "string";
}

export function createSavedExploration(input: {
  source: SourceVideo;
  transcriptSegments: TranscriptSegment[];
  knowledgeMap: KnowledgeMap;
  enrichment?: KnowledgeEnrichment;
  savedAt: string;
  providerLabel?: string;
}): SavedExploration {
  const exploration: SavedExploration = {
    schemaVersion: SAVED_EXPLORATION_SCHEMA_VERSION,
    id: explorationIdFor(input.source),
    savedAt: input.savedAt,
    source: { ...input.source },
    transcriptSegments: input.transcriptSegments.map((segment) => ({ ...segment })),
    knowledgeMap: {
      sourceId: input.knowledgeMap.sourceId,
      topics: input.knowledgeMap.topics.map((topic) => ({
        ...topic,
        segmentIds: [...topic.segmentIds],
        keywords: [...topic.keywords],
      })),
    },
    enrichment: input.enrichment ? copyEnrichment(input.enrichment) : undefined,
    providerLabel: input.providerLabel,
  };

  if (!isSavedExploration(exploration)) {
    throw new Error("Saved exploration is internally inconsistent or invalid.");
  }
  return exploration;
}

export function summarizeExploration(exploration: SavedExploration): ExplorationSummary {
  return {
    id: exploration.id,
    savedAt: exploration.savedAt,
    source: { ...exploration.source },
    segmentCount: exploration.transcriptSegments.length,
    topicCount: exploration.knowledgeMap.topics.length,
    conceptCount: exploration.enrichment?.concepts.length ?? 0,
    providerLabel: exploration.providerLabel,
  };
}
