import type { SourceMetadataProvider } from "../../core/projectr/metadata";
import type { SourceMetadata, SourceVideo } from "../../core/projectr/types";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchResponseLike>;

export type YouTubeMetadataErrorCode =
  | "metadata_request_failed"
  | "video_not_found"
  | "invalid_response";

export class YouTubeMetadataError extends Error {
  constructor(
    public readonly code: YouTubeMetadataErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "YouTubeMetadataError";
  }
}

export interface YouTubeDataApiMetadataProviderOptions {
  apiKey?: string;
  accessToken?: string;
  fetchImpl?: FetchLike;
  endpoint?: string;
}

interface ThumbnailResource {
  url?: string;
}

interface VideoResource {
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: Record<string, ThumbnailResource | undefined>;
  };
  contentDetails?: {
    duration?: string;
  };
}

interface VideoListResponse {
  items?: VideoResource[];
  error?: { message?: string };
}

function defaultFetch(
  url: string,
  init?: { headers?: Record<string, string> },
): Promise<FetchResponseLike> {
  return fetch(url, init);
}

export function parseIso8601DurationSeconds(value: string): number | undefined {
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if (!match) return undefined;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) ? total : undefined;
}

function selectThumbnail(
  thumbnails?: Record<string, ThumbnailResource | undefined>,
): string | undefined {
  if (!thumbnails) return undefined;
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbnails[key]?.url;
    if (url) return url;
  }
  return undefined;
}

export class YouTubeDataApiMetadataProvider implements SourceMetadataProvider {
  private readonly fetchImpl: FetchLike;
  private readonly endpoint: string;

  constructor(private readonly options: YouTubeDataApiMetadataProviderOptions) {
    if (!options.apiKey && !options.accessToken) {
      throw new Error("YouTube metadata requires an API key or OAuth access token.");
    }
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
    this.endpoint = options.endpoint ?? "https://www.googleapis.com/youtube/v3/videos";
  }

  async getMetadata(source: SourceVideo): Promise<SourceMetadata | null> {
    if (source.kind !== "youtube") return null;

    const query = new URLSearchParams({
      part: "snippet,contentDetails",
      id: source.sourceId,
    });

    const useApiKey = Boolean(this.options.apiKey);
    if (useApiKey) query.set("key", this.options.apiKey!);
    const headers = !useApiKey && this.options.accessToken
      ? { Authorization: `Bearer ${this.options.accessToken}` }
      : undefined;

    const response = await this.fetchImpl(
      `${this.endpoint}?${query.toString()}`,
      headers ? { headers } : undefined,
    );
    const payload = await response.json() as VideoListResponse;

    if (!response.ok) {
      throw new YouTubeMetadataError(
        "metadata_request_failed",
        payload.error?.message
          ?? `YouTube metadata request failed with status ${response.status}.`,
        response.status,
      );
    }

    const video = payload.items?.[0];
    if (!video) {
      throw new YouTubeMetadataError(
        "video_not_found",
        "YouTube returned no metadata for this video.",
        404,
      );
    }

    if (!video.snippet && !video.contentDetails) {
      throw new YouTubeMetadataError(
        "invalid_response",
        "YouTube metadata response did not contain snippet or content details.",
      );
    }

    return {
      title: video.snippet?.title,
      creatorName: video.snippet?.channelTitle,
      durationSeconds: video.contentDetails?.duration
        ? parseIso8601DurationSeconds(video.contentDetails.duration)
        : undefined,
      thumbnailUrl: selectThumbnail(video.snippet?.thumbnails),
      publishedAt: video.snippet?.publishedAt,
    };
  }
}
