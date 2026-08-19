import type { SourceVideo, TranscriptCue } from "./types";

export interface TranscriptProvider {
  getTranscript(video: SourceVideo): Promise<TranscriptCue[]>;
}
