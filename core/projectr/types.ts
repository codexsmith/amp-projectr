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

export type KnowledgeConceptKind = "topic" | "term";

export interface KnowledgeConcept {
  id: string;
  sourceId: string;
  kind: KnowledgeConceptKind;
  label: string;
  terms: string[];
  segmentIds: string[];
  topicIds: string[];
  score: number;
}

export interface KnowledgeEnrichment {
  sourceId: string;
  generatedBy: {
    generator: string;
    version?: string;
  };
  concepts: KnowledgeConcept[];
}

export interface KnowledgeSearchHit {
  segmentId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  score: number;
  matchedTerms: string[];
  matchedConceptIds: string[];
  topicIds: string[];
}
