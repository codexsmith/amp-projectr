import type { SourceMetadata, SourceVideo } from "./types";

export interface SourceMetadataProvider {
  getMetadata(source: SourceVideo): Promise<SourceMetadata | null>;
}

export function withSourceMetadata(
  source: SourceVideo,
  metadata: SourceMetadata | null,
): SourceVideo {
  if (!metadata) return { ...source };

  return {
    ...source,
    ...(metadata.title ? { title: metadata.title } : {}),
    ...(metadata.creatorName ? { creatorName: metadata.creatorName } : {}),
    ...(metadata.durationSeconds !== undefined
      ? { durationSeconds: metadata.durationSeconds }
      : {}),
    ...(metadata.thumbnailUrl ? { thumbnailUrl: metadata.thumbnailUrl } : {}),
    ...(metadata.publishedAt ? { publishedAt: metadata.publishedAt } : {}),
  };
}
