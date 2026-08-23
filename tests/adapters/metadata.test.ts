import {
  YouTubeDataApiMetadataProvider,
  YouTubeMetadataError,
  parseIso8601DurationSeconds,
  type FetchLike,
} from "../../adapters/metadata/youtube-data-api";
import { withSourceMetadata } from "../../core/projectr/metadata";
import type { SourceVideo } from "../../core/projectr/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

async function run(): Promise<void> {
  equal(parseIso8601DurationSeconds("PT1H2M3S"), 3723, "duration parser");
  equal(parseIso8601DurationSeconds("P1DT2H"), 93600, "day duration parser");
  equal(parseIso8601DurationSeconds("not-a-duration"), undefined, "invalid duration parser");

  const source: SourceVideo = {
    kind: "youtube",
    sourceId: "abc123def45",
    canonicalUrl: "https://www.youtube.com/watch?v=abc123def45",
  };

  let requestedUrl = "";
  const fetchImpl: FetchLike = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [{
          snippet: {
            title: "Test Video",
            channelTitle: "Test Channel",
            publishedAt: "2026-08-19T12:00:00Z",
            thumbnails: {
              high: { url: "https://example.test/high.jpg" },
              maxres: { url: "https://example.test/max.jpg" },
            },
          },
          contentDetails: { duration: "PT1H2M3S" },
        }],
      }),
    };
  };

  const provider = new YouTubeDataApiMetadataProvider({
    apiKey: "test-key",
    fetchImpl,
  });
  const metadata = await provider.getMetadata(source);
  assert(metadata, "metadata should resolve");
  equal(metadata.title, "Test Video", "title mapping");
  equal(metadata.creatorName, "Test Channel", "creator mapping");
  equal(metadata.durationSeconds, 3723, "duration mapping");
  equal(metadata.thumbnailUrl, "https://example.test/max.jpg", "thumbnail selection");
  assert(requestedUrl.includes("part=snippet%2CcontentDetails"), "request should ask only for required parts");
  assert(requestedUrl.includes("key=test-key"), "API key should stay in adapter request");

  const enriched = withSourceMetadata(source, metadata);
  equal(enriched.title, "Test Video", "metadata should enrich portable source");
  equal(source.title, undefined, "metadata enrichment should not mutate source");

  let authHeader = "";
  const oauthFetch: FetchLike = async (_url, init) => {
    authHeader = init?.headers?.Authorization ?? "";
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [{ snippet: { title: "OAuth Video" } }] }),
    };
  };
  await new YouTubeDataApiMetadataProvider({
    accessToken: "token",
    fetchImpl: oauthFetch,
  }).getMetadata(source);
  equal(authHeader, "Bearer token", "OAuth token should use Authorization header");

  const missingFetch: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ items: [] }),
  });

  let missingError: unknown;
  try {
    await new YouTubeDataApiMetadataProvider({
      apiKey: "test-key",
      fetchImpl: missingFetch,
    }).getMetadata(source);
  } catch (error) {
    missingError = error;
  }

  assert(missingError instanceof YouTubeMetadataError, "missing video should be typed error");
  equal(missingError.code, "video_not_found", "missing video error code");

  console.log("Metadata adapter tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
