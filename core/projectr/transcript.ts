import type { SearchHit, TranscriptCue, TranscriptSegment } from "./types";

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTranscript(
  sourceId: string,
  cues: TranscriptCue[],
): TranscriptSegment[] {
  const valid = cues
    .filter((cue) => Number.isFinite(cue.startSeconds) && cue.startSeconds >= 0)
    .map((cue) => ({ ...cue, text: compactWhitespace(cue.text) }))
    .filter((cue) => cue.text.length > 0)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  return valid.map((cue, index) => {
    const nextStart = valid[index + 1]?.startSeconds;
    const explicitEnd = cue.durationSeconds && cue.durationSeconds > 0
      ? cue.startSeconds + cue.durationSeconds
      : undefined;
    const inferredEnd = nextStart && nextStart > cue.startSeconds
      ? nextStart
      : cue.startSeconds + 4;
    const endSeconds = Math.max(cue.startSeconds + 0.25, explicitEnd ?? inferredEnd);

    return {
      id: `${sourceId}:${index + 1}`,
      sourceId,
      startSeconds: cue.startSeconds,
      endSeconds,
      text: cue.text,
    };
  });
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;

  while (true) {
    const index = haystack.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + needle.length;
  }
}

export function searchTranscript(
  segments: TranscriptSegment[],
  query: string,
  maxResults = 20,
): SearchHit[] {
  const normalizedQuery = compactWhitespace(query).toLowerCase();
  if (!normalizedQuery) return [];

  const terms = Array.from(
    new Set(normalizedQuery.split(/[^a-z0-9_-]+/i).filter((term) => term.length > 1)),
  );

  return segments
    .map((segment): SearchHit | null => {
      const text = segment.text.toLowerCase();
      const matchedTerms = terms.filter((term) => text.includes(term));
      if (matchedTerms.length === 0) return null;

      const termScore = matchedTerms.reduce(
        (score, term) => score + countOccurrences(text, term),
        0,
      );
      const phraseScore = text.includes(normalizedQuery) ? 3 : 0;

      return {
        segmentId: segment.id,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        text: segment.text,
        score: termScore + phraseScore,
        matchedTerms,
      };
    })
    .filter((hit): hit is SearchHit => hit !== null)
    .sort((a, b) => b.score - a.score || a.startSeconds - b.startSeconds)
    .slice(0, Math.max(1, maxResults));
}
