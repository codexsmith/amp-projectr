import type { TranscriptProvider } from "../../core/projectr/providers";
import type { SourceVideo, TranscriptCue } from "../../core/projectr/types";
import { parseCaptionText } from "./caption-file";

interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponseLike>;

interface CaptionTrack {
  id: string;
  snippet?: {
    language?: string;
    name?: string;
    trackKind?: string;
    isDraft?: boolean;
  };
}

interface CaptionListResponse {
  items?: CaptionTrack[];
}

export interface YouTubeDataApiTranscriptProviderOptions {
  accessToken: string;
  preferredLanguages?: string[];
  fetchImpl?: FetchLike;
}

export class YouTubeDataApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "YouTubeDataApiError";
  }
}

function chooseTrack(tracks: CaptionTrack[], preferredLanguages: string[]): CaptionTrack | undefined {
  const preferred = preferredLanguages.map((value) => value.toLowerCase());

  return [...tracks].sort((left, right) => {
    const leftLanguage = left.snippet?.language?.toLowerCase() ?? "";
    const rightLanguage = right.snippet?.language?.toLowerCase() ?? "";
    const leftPreferred = preferred.findIndex((language) => language === leftLanguage);
    const rightPreferred = preferred.findIndex((language) => language === rightLanguage);
    const leftRank = leftPreferred === -1 ? Number.MAX_SAFE_INTEGER : leftPreferred;
    const rightRank = rightPreferred === -1 ? Number.MAX_SAFE_INTEGER : rightPreferred;
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftGenerated = left.snippet?.trackKind === "ASR" ? 1 : 0;
    const rightGenerated = right.snippet?.trackKind === "ASR" ? 1 : 0;
    if (leftGenerated !== rightGenerated) return leftGenerated - rightGenerated;

    return left.id.localeCompare(right.id);
  })[0];
}

async function errorMessage(response: FetchResponseLike, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export class YouTubeDataApiTranscriptProvider implements TranscriptProvider {
  private readonly preferredLanguages: string[];
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: YouTubeDataApiTranscriptProviderOptions) {
    if (!options.accessToken.trim()) {
      throw new Error("A YouTube OAuth access token is required.");
    }
    this.preferredLanguages = options.preferredLanguages?.length ? options.preferredLanguages : ["en"];
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  }

  async getTranscript(video: SourceVideo): Promise<TranscriptCue[]> {
    const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${encodeURIComponent(video.sourceId)}`;
    const listResponse = await this.fetchImpl(listUrl, {
      headers: { Authorization: `Bearer ${this.options.accessToken}` },
    });

    if (!listResponse.ok) {
      const message = await errorMessage(listResponse, "Unable to list caption tracks for this video.");
      throw new YouTubeDataApiError(
        listResponse.status === 401 || listResponse.status === 403
          ? "The official YouTube captions API only exposes tracks to an authenticated account with permission for the video."
          : message,
        listResponse.status,
        "caption_list_failed",
      );
    }

    const payload = await listResponse.json() as CaptionListResponse;
    const track = chooseTrack(payload.items ?? [], this.preferredLanguages);
    if (!track) {
      throw new YouTubeDataApiError("No accessible caption track was returned for this video.", 404, "caption_track_not_found");
    }

    const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(track.id)}?tfmt=vtt`;
    const downloadResponse = await this.fetchImpl(downloadUrl, {
      headers: { Authorization: `Bearer ${this.options.accessToken}` },
    });

    if (!downloadResponse.ok) {
      const message = await errorMessage(downloadResponse, "Unable to download the selected caption track.");
      throw new YouTubeDataApiError(
        downloadResponse.status === 401 || downloadResponse.status === 403
          ? "The authenticated account is not authorized to download this caption track through the official YouTube API."
          : message,
        downloadResponse.status,
        "caption_download_failed",
      );
    }

    const cues = parseCaptionText(await downloadResponse.text(), "vtt");
    if (cues.length === 0) {
      throw new YouTubeDataApiError("The selected caption track contained no usable timestamped cues.", 422, "caption_parse_empty");
    }

    return cues;
  }
}
