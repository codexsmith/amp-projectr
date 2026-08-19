import type { KnowledgeMap, SourceVideo, TranscriptSegment } from "./types";

export const SAVED_EXPLORATION_SCHEMA_VERSION = 1 as const;

export interface SavedExploration {
  schemaVersion: typeof SAVED_EXPLORATION_SCHEMA_VERSION;
  id: string;
  savedAt: string;
  source: SourceVideo;
  transcriptSegments: TranscriptSegment[];
  knowledgeMap: KnowledgeMap;
  providerLabel?: string;
}

export interface ExplorationSummary {
  id: string;
  savedAt: string;
  source: SourceVideo;
  segmentCount: number;
  topicCount: number;
  providerLabel?: string;
}

export interface ExplorationRepository {
  save(exploration: SavedExploration): Promise<void>;
  get(id: string): Promise<SavedExploration | null>;
  list(): Promise<ExplorationSummary[]>;
  remove(id: string): Promise<void>;
}

export function explorationIdFor(source: SourceVideo): string {
  return `${source.kind}:${source.sourceId}`;
}

export function createSavedExploration(input: {
  source: SourceVideo;
  transcriptSegments: TranscriptSegment[];
  knowledgeMap: KnowledgeMap;
  savedAt: string;
  providerLabel?: string;
}): SavedExploration {
  if (input.knowledgeMap.sourceId !== input.source.sourceId) {
    throw new Error("Knowledge map source does not match the saved source.");
  }
  if (input.transcriptSegments.some((segment) => segment.sourceId !== input.source.sourceId)) {
    throw new Error("Transcript segment source does not match the saved source.");
  }

  return {
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
    providerLabel: input.providerLabel,
  };
}

export function summarizeExploration(exploration: SavedExploration): ExplorationSummary {
  return {
    id: exploration.id,
    savedAt: exploration.savedAt,
    source: { ...exploration.source },
    segmentCount: exploration.transcriptSegments.length,
    topicCount: exploration.knowledgeMap.topics.length,
    providerLabel: exploration.providerLabel,
  };
}
