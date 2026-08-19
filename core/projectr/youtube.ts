import type { SourceVideo } from "./types";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function extractCandidate(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "embed", "live"].includes(parts[0] ?? "")) {
      return parts[1] ?? null;
    }
  }

  return null;
}

export function parseYouTubeUrl(input: string): SourceVideo {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter a YouTube URL.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  const sourceId = extractCandidate(url);
  if (!sourceId || !VIDEO_ID_PATTERN.test(sourceId)) {
    throw new Error("This does not look like a supported YouTube video URL.");
  }

  return {
    kind: "youtube",
    sourceId,
    canonicalUrl: `https://www.youtube.com/watch?v=${sourceId}`,
  };
}

export function youtubeTimestampUrl(video: SourceVideo, seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  return `${video.canonicalUrl}&t=${wholeSeconds}s`;
}
