import type { TranscriptCue } from "../../core/projectr/types";

export type CaptionFormat = "vtt" | "srt";

function parseClock(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid caption timestamp: ${value}`);
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }

  throw new Error(`Invalid caption timestamp: ${value}`);
}

function stripCaptionMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function detectCaptionFormat(content: string): CaptionFormat {
  return /^WEBVTT\b/m.test(content.trimStart()) ? "vtt" : "srt";
}

export function parseCaptionText(content: string, format = detectCaptionFormat(content)): TranscriptCue[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues: TranscriptCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (format === "vtt" && (lines[0] === "WEBVTT" || lines[0].startsWith("NOTE"))) continue;

    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const [rawStart, rawEndWithSettings] = lines[timingIndex].split("-->").map((part) => part.trim());
    if (!rawStart || !rawEndWithSettings) continue;

    const rawEnd = rawEndWithSettings.split(/\s+/)[0];
    const startSeconds = parseClock(rawStart);
    const endSeconds = parseClock(rawEnd);
    const text = stripCaptionMarkup(lines.slice(timingIndex + 1).join(" "));
    if (!text || endSeconds <= startSeconds) continue;

    cues.push({
      startSeconds,
      durationSeconds: endSeconds - startSeconds,
      text,
    });
  }

  return cues;
}
