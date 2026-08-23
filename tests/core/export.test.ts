import {
  PROJECTR_PACKAGE_MEDIA_TYPE,
  ProjectrPackageError,
  createProjectrPackage,
  parseProjectrPackage,
  serializeProjectrPackage,
} from "../../core/projectr/export";
import { createSavedExploration } from "../../core/projectr/persistence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

const exploration = createSavedExploration({
  source: {
    kind: "youtube",
    sourceId: "abc123def45",
    canonicalUrl: "https://www.youtube.com/watch?v=abc123def45",
    title: "Portable source",
  },
  savedAt: "2026-08-19T20:00:00.000Z",
  providerLabel: "Imported captions",
  transcriptSegments: [{
    id: "abc123def45:1",
    sourceId: "abc123def45",
    startSeconds: 0,
    endSeconds: 5,
    text: "Portable knowledge artifact.",
  }],
  knowledgeMap: {
    sourceId: "abc123def45",
    topics: [{
      id: "topic-1",
      title: "Portable",
      startSeconds: 0,
      endSeconds: 5,
      segmentIds: ["abc123def45:1"],
      keywords: ["portable"],
    }],
  },
});

function run(): void {
  const projectrPackage = createProjectrPackage(exploration, "2026-08-19T21:00:00.000Z");
  equal(projectrPackage.mediaType, PROJECTR_PACKAGE_MEDIA_TYPE, "package media type");
  equal(projectrPackage.schemaVersion, 1, "package version");

  const serialized = serializeProjectrPackage(projectrPackage);
  const roundTrip = parseProjectrPackage(serialized);
  equal(roundTrip.exploration.source.title, "Portable source", "source metadata round-trip");
  equal(
    roundTrip.exploration.transcriptSegments[0].text,
    "Portable knowledge artifact.",
    "transcript round-trip",
  );

  let versionError: unknown;
  try {
    parseProjectrPackage({ ...projectrPackage, schemaVersion: 2 });
  } catch (error) {
    versionError = error;
  }
  assert(versionError instanceof ProjectrPackageError, "unsupported version should be typed error");
  equal(versionError.code, "unsupported_version", "unsupported version error code");

  const invalidExploration = JSON.parse(serialized) as {
    exploration: { transcriptSegments: Array<{ sourceId: string }> };
  };
  invalidExploration.exploration.transcriptSegments[0].sourceId = "wrong-source";

  let coherenceError: unknown;
  try {
    parseProjectrPackage(invalidExploration);
  } catch (error) {
    coherenceError = error;
  }
  assert(coherenceError instanceof ProjectrPackageError, "cross-source package should fail");
  equal(coherenceError.code, "invalid_exploration", "cross-source error code");

  console.log("Projectr package tests passed.");
}

run();
