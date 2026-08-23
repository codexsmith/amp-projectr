import { isSavedExploration, type SavedExploration } from "./persistence";

export const PROJECTR_PACKAGE_MEDIA_TYPE = "application/vnd.boundaryfirst.projectr.exploration+json" as const;
export const PROJECTR_PACKAGE_SCHEMA_VERSION = 1 as const;

export interface ProjectrPackage {
  mediaType: typeof PROJECTR_PACKAGE_MEDIA_TYPE;
  schemaVersion: typeof PROJECTR_PACKAGE_SCHEMA_VERSION;
  exportedAt: string;
  exploration: SavedExploration;
}

export type ProjectrPackageErrorCode =
  | "invalid_json"
  | "invalid_package"
  | "unsupported_media_type"
  | "unsupported_version"
  | "invalid_exploration";

export class ProjectrPackageError extends Error {
  constructor(public readonly code: ProjectrPackageErrorCode, message: string) {
    super(message);
    this.name = "ProjectrPackageError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createProjectrPackage(
  exploration: SavedExploration,
  exportedAt: string,
): ProjectrPackage {
  if (!isSavedExploration(exploration)) {
    throw new ProjectrPackageError("invalid_exploration", "Cannot export an invalid Projectr exploration.");
  }
  if (Number.isNaN(Date.parse(exportedAt))) {
    throw new ProjectrPackageError("invalid_package", "Projectr export time must be an ISO-compatible timestamp.");
  }

  return {
    mediaType: PROJECTR_PACKAGE_MEDIA_TYPE,
    schemaVersion: PROJECTR_PACKAGE_SCHEMA_VERSION,
    exportedAt,
    exploration,
  };
}

export function parseProjectrPackage(input: string | unknown): ProjectrPackage {
  let value: unknown = input;

  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new ProjectrPackageError("invalid_json", "The selected file is not valid JSON.");
    }
  }

  if (!isRecord(value)) {
    throw new ProjectrPackageError("invalid_package", "The JSON value is not a Projectr package object.");
  }
  if (value.mediaType !== PROJECTR_PACKAGE_MEDIA_TYPE) {
    throw new ProjectrPackageError("unsupported_media_type", "The JSON file is not a Projectr exploration package.");
  }
  if (value.schemaVersion !== PROJECTR_PACKAGE_SCHEMA_VERSION) {
    throw new ProjectrPackageError(
      "unsupported_version",
      `Unsupported Projectr package schema version: ${String(value.schemaVersion)}.`,
    );
  }
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new ProjectrPackageError("invalid_package", "Projectr package export timestamp is invalid.");
  }
  if (!isSavedExploration(value.exploration)) {
    throw new ProjectrPackageError(
      "invalid_exploration",
      "Projectr package contains an invalid or incoherent exploration.",
    );
  }

  return {
    mediaType: PROJECTR_PACKAGE_MEDIA_TYPE,
    schemaVersion: PROJECTR_PACKAGE_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    exploration: value.exploration,
  };
}

export function serializeProjectrPackage(projectrPackage: ProjectrPackage): string {
  const validated = parseProjectrPackage(projectrPackage);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
