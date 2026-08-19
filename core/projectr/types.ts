export type SourceKind = "youtube";

export interface SourceVideo {
  kind: SourceKind;
  sourceId: string;
  canonicalUrl: string;
  title?: string;
  durationSeconds?: number;
}

export interface TranscriptCue {
  startSeconds: number;
  durationSeconds?: number;
  text: string;
}

export interface TranscriptSegment {
  id: string;
  sourceId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface TopicNode {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  segmentIds: string[];
  keywords: string[];
}

export interface KnowledgeMap {
  sourceId: string;
  topics: TopicNode[];
}

export interface SearchHit {
  segmentId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  score: number;
  matchedTerms: string[];
}
