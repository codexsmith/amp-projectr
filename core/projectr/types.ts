export type SourceKind = "youtube";

export interface SourceMetadata {
  title?: string;
  creatorName?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  publishedAt?: string;
}

export interface SourceVideo extends SourceMetadata {
  kind: SourceKind;
  sourceId: string;
  canonicalUrl: string;
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
