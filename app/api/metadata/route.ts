import {
  YouTubeDataApiMetadataProvider,
  YouTubeMetadataError,
} from "../../../adapters/metadata/youtube-data-api";
import {
  parseYouTubeUrl,
  withSourceMetadata,
} from "../../../core/projectr";

interface MetadataRequestBody {
  url?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as MetadataRequestBody;
    if (typeof body.url !== "string") {
      return json({
        error: {
          code: "invalid_request",
          message: "A YouTube URL is required.",
        },
      }, 400);
    }

    const source = parseYouTubeUrl(body.url);
    const apiKey = process.env.PROJECTR_YOUTUBE_API_KEY?.trim();
    const accessToken = process.env.PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN?.trim();

    if (!apiKey && !accessToken) {
      return json({
        error: {
          code: "metadata_not_configured",
          message: "Configure PROJECTR_YOUTUBE_API_KEY or PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN to resolve YouTube metadata.",
        },
      }, 501);
    }

    const provider = new YouTubeDataApiMetadataProvider({ apiKey, accessToken });
    const metadata = await provider.getMetadata(source);
    return json({
      source: withSourceMetadata(source, metadata),
      metadata,
    });
  } catch (error) {
    if (error instanceof YouTubeMetadataError) {
      return json({
        error: { code: error.code, message: error.message },
      }, error.status && error.status >= 400 && error.status < 600 ? error.status : 502);
    }

    return json({
      error: {
        code: "metadata_failed",
        message: error instanceof Error
          ? error.message
          : "Unable to resolve source metadata.",
      },
    }, 400);
  }
}
