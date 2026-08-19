import { YouTubeDataApiError, YouTubeDataApiTranscriptProvider } from "../../../adapters/transcripts/youtube-data-api";
import { parseYouTubeUrl } from "../../../core/projectr/youtube";

export const runtime = "nodejs";

interface TranscriptRequestBody {
  url?: unknown;
  preferredLanguages?: unknown;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: TranscriptRequestBody;

  try {
    body = await request.json() as TranscriptRequestBody;
  } catch {
    return json({ error: { code: "invalid_json", message: "Request body must be JSON." } }, 400);
  }

  if (typeof body.url !== "string") {
    return json({ error: { code: "missing_url", message: "A YouTube URL is required." } }, 400);
  }

  let source;
  try {
    source = parseYouTubeUrl(body.url);
  } catch (error) {
    return json({
      error: {
        code: "invalid_youtube_url",
        message: error instanceof Error ? error.message : "Invalid YouTube URL.",
      },
    }, 400);
  }

  const accessToken = process.env.PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return json({
      error: {
        code: "youtube_oauth_not_configured",
        message: "Live official captions are not configured. Set PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN with a YouTube OAuth token that has the youtube.force-ssl scope, or import a VTT/SRT caption file instead.",
      },
    }, 503);
  }

  const preferredLanguages = Array.isArray(body.preferredLanguages)
    ? body.preferredLanguages.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : ["en"];

  const provider = new YouTubeDataApiTranscriptProvider({
    accessToken,
    preferredLanguages,
  });

  try {
    const cues = await provider.getTranscript(source);
    return json({
      source,
      cues,
      provider: "youtube-data-api",
      accessScope: "authorized-video-captions",
    });
  } catch (error) {
    if (error instanceof YouTubeDataApiError) {
      return json({
        error: {
          code: error.code ?? "youtube_caption_error",
          message: error.message,
        },
      }, error.status && error.status >= 400 && error.status < 600 ? error.status : 502);
    }

    return json({
      error: {
        code: "transcript_provider_failed",
        message: "The configured transcript provider failed unexpectedly.",
      },
    }, 502);
  }
}
