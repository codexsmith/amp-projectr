import type { TranscriptProvider } from "./providers";
import type { SourceVideo, TranscriptCue } from "./types";

const DEMO_CUES: TranscriptCue[] = [
  { startSeconds: 0, durationSeconds: 12, text: "A long video becomes easier to use when we preserve timestamps and treat the transcript as structured source material." },
  { startSeconds: 12, durationSeconds: 14, text: "The first step is source ingestion. We identify the video, normalize the transcript, and keep a stable reference back to the original source." },
  { startSeconds: 26, durationSeconds: 15, text: "Search should return the matching transcript segment and a timestamp, not merely a detached answer without provenance." },
  { startSeconds: 41, durationSeconds: 14, text: "A deterministic outline can be generated before any language model is involved. That keeps the baseline understandable and testable." },
  { startSeconds: 55, durationSeconds: 17, text: "Topic sections are small navigation structures. They help a learner move through the source without replacing the source itself." },
  { startSeconds: 72, durationSeconds: 15, text: "Later enrichment can extract concepts, claims, entities, and relationships, but those capabilities belong behind replaceable provider interfaces." },
  { startSeconds: 87, durationSeconds: 18, text: "The product contract should survive a change from Next.js to another interface, from one database to another, or from one AI provider to another." },
  { startSeconds: 105, durationSeconds: 16, text: "That separation turns the prototype into an executable test of the knowledge model rather than a permanent commitment to the prototype stack." },
  { startSeconds: 121, durationSeconds: 18, text: "The useful unit is not a feed item. It is a source with searchable segments, navigable topics, provenance, and a path back to the original evidence." },
  { startSeconds: 139, durationSeconds: 15, text: "Once that core works, a live YouTube transcript adapter can replace the fixture provider without changing the domain model or the user interface contract." },
];

export class DemoTranscriptProvider implements TranscriptProvider {
  async getTranscript(_video: SourceVideo): Promise<TranscriptCue[]> {
    return DEMO_CUES.map((cue) => ({ ...cue }));
  }
}
