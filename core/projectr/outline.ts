import type { KnowledgeMap, TopicNode, TranscriptSegment } from "./types";

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "being", "between",
  "could", "from", "have", "into", "just", "like", "more", "most", "other",
  "over", "really", "some", "such", "than", "that", "their", "there", "these",
  "they", "this", "those", "through", "very", "want", "what", "when", "where",
  "which", "while", "with", "would", "your", "youre", "were", "will", "then",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9_-]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function keywordsFor(segments: TranscriptSegment[], limit: number): string[] {
  const counts = new Map<string, number>();

  for (const segment of segments) {
    for (const word of tokenize(segment.text)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function titleFromKeywords(keywords: string[], index: number): string {
  if (keywords.length === 0) return `Section ${index + 1}`;
  return keywords
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" / ");
}

export interface OutlineOptions {
  targetSectionSeconds?: number;
  maxKeywords?: number;
}

export function deriveOutline(
  sourceId: string,
  segments: TranscriptSegment[],
  options: OutlineOptions = {},
): KnowledgeMap {
  const targetSectionSeconds = Math.max(30, options.targetSectionSeconds ?? 90);
  const maxKeywords = Math.max(1, options.maxKeywords ?? 5);

  if (segments.length === 0) {
    return { sourceId, topics: [] };
  }

  const groups: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let sectionStart = segments[0].startSeconds;

  for (const segment of segments) {
    const elapsed = segment.endSeconds - sectionStart;
    if (current.length > 0 && elapsed > targetSectionSeconds) {
      groups.push(current);
      current = [];
      sectionStart = segment.startSeconds;
    }
    current.push(segment);
  }
  if (current.length > 0) groups.push(current);

  const topics: TopicNode[] = groups.map((group, index) => {
    const keywords = keywordsFor(group, maxKeywords);
    return {
      id: `${sourceId}:topic:${index + 1}`,
      title: titleFromKeywords(keywords, index),
      startSeconds: group[0].startSeconds,
      endSeconds: group[group.length - 1].endSeconds,
      segmentIds: group.map((segment) => segment.id),
      keywords,
    };
  });

  return { sourceId, topics };
}
