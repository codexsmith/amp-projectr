import { strict as assert } from "node:assert";
import { parseCaptionText } from "../../adapters/transcripts/caption-file";
import { YouTubeDataApiError, YouTubeDataApiTranscriptProvider, type FetchLike } from "../../adapters/transcripts/youtube-data-api";
import { parseYouTubeUrl } from "../../core/projectr/youtube";

const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.500
Hello <b>world</b>.

00:00:04.000 --> 00:00:06.000
Second cue.
`;

const parsed = parseCaptionText(vtt, "vtt");
assert.equal(parsed.length, 2);
assert.equal(parsed[0].startSeconds, 1);
assert.equal(parsed[0].durationSeconds, 2.5);
assert.equal(parsed[0].text, "Hello world.");

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
assert.equal(requestCount, 2);
assert.equal(cues.length, 2);

const forbiddenFetch: FetchLike = async () => ({
  ok: false,
  status: 403,
  text: async () => "",
  json: async () => ({ error: { message: "Forbidden" } }),
});

await assert.rejects(
  () => new YouTubeDataApiTranscriptProvider({ accessToken: "test-token", fetchImpl: forbiddenFetch }).getTranscript(source),
  (error: unknown) => error instanceof YouTubeDataApiError && error.code === "caption_list_failed" && error.status === 403,
);

console.log("Transcript adapter tests passed.");
