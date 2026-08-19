import {
  isSavedExploration,
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

export class BrowserLocalStorageExplorationRepository implements ExplorationRepository {
  constructor(
    private readonly resolveStorage: StorageResolver = defaultStorageResolver,
    private readonly prefix = DEFAULT_PREFIX,
  ) {}

  async save(exploration: SavedExploration): Promise<void> {
    if (!isSavedExploration(exploration)) {
      throw new Error("Cannot persist an invalid Projectr exploration.");
    }
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
