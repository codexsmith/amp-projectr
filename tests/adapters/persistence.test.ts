import { BrowserLocalStorageExplorationRepository, type KeyValueStorage } from "../../adapters/persistence/browser-local-storage";
import { createSavedExploration } from "../../core/projectr/persistence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

async function run(): Promise<void> {
  const storage = new MemoryStorage();
  const repository = new BrowserLocalStorageExplorationRepository(() => storage, "test:");
  const source = { kind: "youtube" as const, sourceId: "abc123def45", canonicalUrl: "https://www.youtube.com/watch?v=abc123def45" };
  const saved = createSavedExploration({
    source,
    savedAt: "2026-08-19T20:00:00.000Z",
    providerLabel: "Imported captions / example.vtt",
    transcriptSegments: [{ id: "abc123def45:1", sourceId: source.sourceId, startSeconds: 0, endSeconds: 5, text: "Hello source." }],
    knowledgeMap: { sourceId: source.sourceId, topics: [{ id: "topic-1", title: "Hello", startSeconds: 0, endSeconds: 5, segmentIds: ["abc123def45:1"], keywords: ["hello"] }] },
  });

  await repository.save(saved);
  const loaded = await repository.get(saved.id);
  assert(loaded, "saved exploration should load");
  equal(loaded.providerLabel, saved.providerLabel, "provider label should round-trip");
  equal(loaded.transcriptSegments[0].text, "Hello source.", "transcript should round-trip");

  const listed = await repository.list();
  equal(listed.length, 1, "repository should list saved exploration");
  equal(listed[0].segmentCount, 1, "summary should count segments");
  equal(listed[0].topicCount, 1, "summary should count topics");

  storage.setItem("test:corrupt", "not-json");
  equal((await repository.list()).length, 1, "corrupt entries should be ignored");

  await repository.remove(saved.id);
  equal(await repository.get(saved.id), null, "removed exploration should not load");

  let mismatchThrew = false;
  try {
    createSavedExploration({
      source,
      savedAt: saved.savedAt,
      providerLabel: saved.providerLabel,
      knowledgeMap: saved.knowledgeMap,
      transcriptSegments: [{ ...saved.transcriptSegments[0], sourceId: "wrong" }],
    });
  } catch {
    mismatchThrew = true;
  }
  assert(mismatchThrew, "mismatched transcript source should fail");

  console.log("Persistence adapter tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
