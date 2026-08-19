import {
  SAVED_EXPLORATION_SCHEMA_VERSION,
  summarizeExploration,
  type ExplorationRepository,
  type ExplorationSummary,
  type SavedExploration,
} from "../../core/projectr/persistence";

export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DEFAULT_PREFIX = "projectr.saved-exploration.v1:";

type StorageResolver = () => KeyValueStorage;

function defaultStorageResolver(): KeyValueStorage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Browser local storage is not available in this runtime.");
  }
  return window.localStorage;
}

function isSavedExploration(value: unknown): value is SavedExploration {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedExploration>;
  return candidate.schemaVersion === SAVED_EXPLORATION_SCHEMA_VERSION
    && typeof candidate.id === "string"
    && typeof candidate.savedAt === "string"
    && candidate.source?.kind === "youtube"
    && typeof candidate.source.sourceId === "string"
    && typeof candidate.source.canonicalUrl === "string"
    && Array.isArray(candidate.transcriptSegments)
    && candidate.knowledgeMap?.sourceId === candidate.source.sourceId
    && Array.isArray(candidate.knowledgeMap.topics);
}

export class BrowserLocalStorageExplorationRepository implements ExplorationRepository {
  constructor(
    private readonly resolveStorage: StorageResolver = defaultStorageResolver,
    private readonly prefix = DEFAULT_PREFIX,
  ) {}

  async save(exploration: SavedExploration): Promise<void> {
    this.resolveStorage().setItem(this.storageKey(exploration.id), JSON.stringify(exploration));
  }

  async get(id: string): Promise<SavedExploration | null> {
    const raw = this.resolveStorage().getItem(this.storageKey(id));
    if (!raw) return null;
    return this.parse(raw);
  }

  async list(): Promise<ExplorationSummary[]> {
    const storage = this.resolveStorage();
    const summaries: ExplorationSummary[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(this.prefix)) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const exploration = this.parse(raw);
      if (exploration) summaries.push(summarizeExploration(exploration));
    }

    return summaries.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  async remove(id: string): Promise<void> {
    this.resolveStorage().removeItem(this.storageKey(id));
  }

  private storageKey(id: string): string {
    return `${this.prefix}${id}`;
  }

  private parse(raw: string): SavedExploration | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isSavedExploration(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
