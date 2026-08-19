import { parseCaptionText } from "../../adapters/transcripts/caption-file";
import { YouTubeDataApiError, YouTubeDataApiTranscriptProvider, type FetchLike } from "../../adapters/transcripts/youtube-data-api";
import { parseYouTubeUrl } from "../../core/projectr/youtube";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.500
Hello <b>world</b>.

00:00:04.000 --> 00:00:06.000
Second cue.
`;

async function run(): Promise<void> {
  const parsed = parseCaptionText(vtt, "vtt");
  equal(parsed.length, 2, "VTT should produce two cues");
  equal(parsed[0].startSeconds, 1, "VTT start time");
  equal(parsed[0].durationSeconds, 2.5, "VTT duration");
  equal(parsed[0].text, "Hello world.", "VTT markup stripping");

  const source = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  let requestCount = 0;
  const fetchImpl: FetchLike = async (url) => {
    requestCount += 1;
    if (url.includes("/captions?")) {
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ items: [{ id: "track-1", snippet: { language: "en", trackKind: "standard" } }] }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => vtt,
      json: async () => ({}),
    };
  };

  const provider = new YouTubeDataApiTranscriptProvider({ accessToken: "test-token", fetchImpl });
  const cues = await provider.getTranscript(source);
  equal(requestCount, 2, "official provider should list then download captions");
  equal(cues.length, 2, "official provider should parse downloaded VTT");

  const forbiddenFetch: FetchLike = async () => ({
    ok: false,
    status: 403,
    text: async () => "",
    json: async () => ({ error: { message: "Forbidden" } }),
  });

  let forbiddenError: unknown;
  try {
    await new YouTubeDataApiTranscriptProvider({ accessToken: "test-token", fetchImpl: forbiddenFetch }).getTranscript(source);
  } catch (error) {
    forbiddenError = error;
  }

  assert(forbiddenError instanceof YouTubeDataApiError, "403 should become a typed provider error");
  equal(forbiddenError.code, "caption_list_failed", "403 provider error code");
  equal(forbiddenError.status, 403, "403 provider error status");

  console.log("Transcript adapter tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
