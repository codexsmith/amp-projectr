import {
  deriveOutline,
  normalizeTranscript,
  parseYouTubeUrl,
  searchTranscript,
  youtubeTimestampUrl,
} from "../../core/projectr";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function throws(fn: () => unknown, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function testYouTubeParsing(): void {
  const ids = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://youtube.com/embed/dQw4w9WgXcQ",
  ].map((url) => parseYouTubeUrl(url).sourceId);

  assert(ids.every((id) => id === "dQw4w9WgXcQ"), "supported YouTube URLs should resolve the same ID");
  throws(() => parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ"), "non-YouTube URL should fail");

  const source = parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ");
  equal(youtubeTimestampUrl(source, 61.9), "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=61s", "timestamp URL");
}

function testTranscriptNormalizationAndSearch(): void {
  const segments = normalizeTranscript("video-1", [
    { startSeconds: 10, text: "  second   segment " },
    { startSeconds: 0, durationSeconds: 5, text: "Knowledge maps preserve source context." },
    { startSeconds: 5, text: "Search returns knowledge with a timestamp." },
    { startSeconds: 20, text: "   " },
  ]);

  equal(segments.length, 3, "empty transcript cues should be removed");
  equal(segments[0].startSeconds, 0, "segments should be sorted");
  equal(segments[1].endSeconds, 10, "end time should infer from next cue");
  equal(segments[2].text, "second segment", "whitespace should be normalized");

  const hits = searchTranscript(segments, "knowledge timestamp");
  equal(hits.length, 2, "term search should find matching segments");
  assert(hits[0].score >= hits[1].score, "search results should be score ordered");
}

function testDeterministicOutline(): void {
  const segments = normalizeTranscript("video-2", [
    { startSeconds: 0, durationSeconds: 20, text: "Source ingestion preserves transcript provenance and timestamps." },
    { startSeconds: 20, durationSeconds: 20, text: "Transcript search preserves source evidence and navigation." },
    { startSeconds: 40, durationSeconds: 20, text: "Deterministic outline generation builds topic navigation." },
    { startSeconds: 100, durationSeconds: 20, text: "Provider interfaces keep infrastructure replaceable and portable." },
    { startSeconds: 120, durationSeconds: 20, text: "Portable contracts keep the domain independent from frameworks." },
  ]);

  const map = deriveOutline("video-2", segments, { targetSectionSeconds: 70 });
  equal(map.topics.length, 2, "outline should partition transcript by time window");
  assert(map.topics[0].keywords.length > 0, "outline should include deterministic keywords");
  equal(map.topics[0].segmentIds[0], "video-2:1", "outline should preserve segment references");
}

function run(): void {
  testYouTubeParsing();
  testTranscriptNormalizationAndSearch();
  testDeterministicOutline();
  console.log("Projectr core tests passed.");
}

run();
