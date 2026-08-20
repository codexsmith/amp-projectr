import type {
  KnowledgeEnricher,
  KnowledgeEnrichmentInput,
  KnowledgeSearcher,
  KnowledgeSearchInput,
} from "../../core/projectr/knowledge";
import type {
  KnowledgeConcept,
  KnowledgeEnrichment,
  KnowledgeSearchHit,
  TopicNode,
  TranscriptSegment,
} from "../../core/projectr/types";

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "being", "between",
  "could", "from", "have", "into", "just", "like", "more", "most", "other",
  "over", "really", "some", "such", "than", "that", "their", "there", "these",
  "they", "this", "those", "through", "very", "want", "what", "when", "where",
  "which", "while", "with", "would", "your", "youre", "were", "will", "then",
]);

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tokenize(value: string, minimumLength = 3): string[] {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9_-]+/)
    .filter((term) => term.length >= minimumLength && !STOP_WORDS.has(term));
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (needle && offset < haystack.length) {
    const index = haystack.indexOf(needle, offset);
    if (index === -1) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function assertCoherentInput(input: KnowledgeEnrichmentInput): void {
  if (input.knowledgeMap.sourceId !== input.sourceId) {
    throw new Error("Knowledge map source does not match enrichment source.");
  }
  if (input.transcriptSegments.some((segment) => segment.sourceId !== input.sourceId)) {
    throw new Error("Transcript segment source does not match enrichment source.");
  }
}

function topicIdsBySegment(topics: TopicNode[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const topic of topics) {
    for (const segmentId of topic.segmentIds) {
      const existing = result.get(segmentId) ?? [];
      if (!existing.includes(topic.id)) existing.push(topic.id);
      result.set(segmentId, existing);
    }
  }
  return result;
}

export interface DeterministicKnowledgeOptions {
  maxTermConcepts?: number;
  minTermSegments?: number;
}

export class DeterministicKnowledgeEnricher implements KnowledgeEnricher {
  constructor(private readonly options: DeterministicKnowledgeOptions = {}) {}

  async enrich(input: KnowledgeEnrichmentInput): Promise<KnowledgeEnrichment> {
    assertCoherentInput(input);
    const maxTermConcepts = Math.max(1, this.options.maxTermConcepts ?? 24);
    const minTermSegments = Math.max(1, this.options.minTermSegments ?? 2);
    const topicsBySegment = topicIdsBySegment(input.knowledgeMap.topics);

    const topicConcepts: KnowledgeConcept[] = input.knowledgeMap.topics.map((topic) => ({
      id: `${input.sourceId}:concept:topic:${topic.id}`,
      sourceId: input.sourceId,
      kind: "topic",
      label: topic.title,
      terms: [...topic.keywords],
      segmentIds: [...topic.segmentIds],
      topicIds: [topic.id],
      score: 1 + topic.segmentIds.length * 0.1 + topic.keywords.length * 0.05,
    }));

    const stats = new Map<string, {
      occurrences: number;
      segmentIds: Set<string>;
      topicIds: Set<string>;
    }>();

    for (const segment of input.transcriptSegments) {
      for (const term of tokenize(segment.text, 4)) {
        const current = stats.get(term) ?? {
          occurrences: 0,
          segmentIds: new Set<string>(),
          topicIds: new Set<string>(),
        };
        current.occurrences += 1;
        current.segmentIds.add(segment.id);
        for (const topicId of topicsBySegment.get(segment.id) ?? []) current.topicIds.add(topicId);
        stats.set(term, current);
      }
    }

    const termConcepts: KnowledgeConcept[] = [...stats.entries()]
      .filter(([, stat]) => stat.segmentIds.size >= minTermSegments)
      .map(([term, stat]) => ({
        id: `${input.sourceId}:concept:term:${encodeURIComponent(term)}`,
        sourceId: input.sourceId,
        kind: "term" as const,
        label: titleCase(term),
        terms: [term],
        segmentIds: [...stat.segmentIds],
        topicIds: [...stat.topicIds],
        score: stat.occurrences + stat.segmentIds.size * 0.5 + stat.topicIds.size,
      }))
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
      .slice(0, maxTermConcepts);

    return {
      sourceId: input.sourceId,
      generatedBy: { generator: "deterministic-keyword", version: "1" },
      concepts: [...topicConcepts, ...termConcepts],
    };
  }
}

function conceptMatchesQuery(concept: KnowledgeConcept, normalizedQuery: string, queryTerms: string[]): boolean {
  const label = concept.label.toLowerCase();
  if (normalizedQuery.length > 1 && label.includes(normalizedQuery)) return true;
  const conceptTerms = new Set([
    ...concept.terms.map((term) => term.toLowerCase()),
    ...tokenize(concept.label, 2),
  ]);
  return queryTerms.some((term) => conceptTerms.has(term));
}

function topicsForSegment(segment: TranscriptSegment, input: KnowledgeSearchInput): string[] {
  return input.knowledgeMap.topics
    .filter((topic) => topic.segmentIds.includes(segment.id))
    .map((topic) => topic.id);
}

export class DeterministicKnowledgeSearcher implements KnowledgeSearcher {
  async search(input: KnowledgeSearchInput): Promise<KnowledgeSearchHit[]> {
    assertCoherentInput(input);
    const normalizedQuery = compactWhitespace(input.query).toLowerCase();
    if (!normalizedQuery) return [];
    const queryTerms = [...new Set(tokenize(normalizedQuery, 2))];
    if (queryTerms.length === 0) return [];

    const matchedConcepts = (input.enrichment?.concepts ?? [])
      .filter((concept) => conceptMatchesQuery(concept, normalizedQuery, queryTerms));
    const conceptsBySegment = new Map<string, KnowledgeConcept[]>();
    for (const concept of matchedConcepts) {
      for (const segmentId of concept.segmentIds) {
        const existing = conceptsBySegment.get(segmentId) ?? [];
        existing.push(concept);
        conceptsBySegment.set(segmentId, existing);
      }
    }

    const hits: KnowledgeSearchHit[] = [];
    for (const segment of input.transcriptSegments) {
      const text = segment.text.toLowerCase();
      const directTerms = queryTerms.filter((term) => text.includes(term));
      const relatedConcepts = conceptsBySegment.get(segment.id) ?? [];
      if (directTerms.length === 0 && relatedConcepts.length === 0) continue;

      const directScore = directTerms.reduce(
        (total, term) => total + countOccurrences(text, term),
        text.includes(normalizedQuery) ? 3 : 0,
      );
      const conceptScore = relatedConcepts.reduce(
        (total, concept) => total + (concept.kind === "topic" ? 1.25 : 0.75) + Math.min(concept.score, 10) * 0.05,
        0,
      );
      const matchedTerms = [...new Set([
        ...directTerms,
        ...relatedConcepts.flatMap((concept) => concept.terms.filter((term) => queryTerms.includes(term.toLowerCase()))),
      ])];
      const topicIds = [...new Set([
        ...topicsForSegment(segment, input),
        ...relatedConcepts.flatMap((concept) => concept.topicIds),
      ])];

      hits.push({
        segmentId: segment.id,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        text: segment.text,
        score: directScore + conceptScore + (directTerms.length > 0 && relatedConcepts.length > 0 ? 0.5 : 0),
        matchedTerms,
        matchedConceptIds: relatedConcepts.map((concept) => concept.id),
        topicIds,
      });
    }

    return hits
      .sort((left, right) => right.score - left.score || left.startSeconds - right.startSeconds)
      .slice(0, Math.max(1, input.maxResults ?? 20));
  }
}
