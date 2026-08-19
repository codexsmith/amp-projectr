"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import styles from "./page.module.css";
import { BrowserLocalStorageExplorationRepository } from "../adapters/persistence/browser-local-storage";
import { parseCaptionText } from "../adapters/transcripts/caption-file";
import {
  PROJECTR_PACKAGE_MEDIA_TYPE,
  DemoTranscriptProvider,
  createProjectrPackage,
  createSavedExploration,
  deriveOutline,
  explorationIdFor,
  normalizeTranscript,
  parseProjectrPackage,
  parseYouTubeUrl,
  searchTranscript,
  serializeProjectrPackage,
  youtubeTimestampUrl,
  type ExplorationSummary,
  type KnowledgeMap,
  type SavedExploration,
  type SourceVideo,
  type TranscriptCue,
  type TranscriptSegment,
} from "../core/projectr";

const demoTranscriptProvider = new DemoTranscriptProvider();
const explorationRepository = new BrowserLocalStorageExplorationRepository();

interface LiveTranscriptResponse {
  source?: SourceVideo;
  cues?: TranscriptCue[];
  error?: { message?: string };
}

interface MetadataResponse {
  source?: SourceVideo;
  error?: { code?: string; message?: string };
}

function formatTimestamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatDuration(seconds?: number): string | null {
  if (seconds === undefined) return null;
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`
    : `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function projectrFilename(source: SourceVideo): string {
  const stem = (source.title ?? source.sourceId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `projectr-${stem || source.sourceId}.json`;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceVideo | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeMap | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [metadataMessage, setMetadataMessage] = useState<string | null>(null);
  const [savedExplorations, setSavedExplorations] = useState<ExplorationSummary[]>([]);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hits = useMemo(() => searchTranscript(segments, query), [segments, query]);
  const currentSavedId = source ? explorationIdFor(source) : null;
  const currentIsSaved = currentSavedId
    ? savedExplorations.some((item) => item.id === currentSavedId)
    : false;

  useEffect(() => {
    void refreshSavedExplorations();
  }, []);

  async function refreshSavedExplorations(): Promise<void> {
    try {
      setSavedExplorations(await explorationRepository.list());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to read local Projectr storage.");
    }
  }

  async function enrichSource(parsed: SourceVideo): Promise<SourceVideo> {
    try {
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.canonicalUrl }),
      });
      const payload = await response.json() as MetadataResponse;
      if (!response.ok || !payload.source) {
        setMetadataMessage(
          payload.error?.message ?? "Source metadata is unavailable; transcript processing can continue.",
        );
        return parsed;
      }
      setMetadataMessage(null);
      return payload.source;
    } catch {
      setMetadataMessage("Source metadata is unavailable; transcript processing can continue.");
      return parsed;
    }
  }

  function applyTranscript(parsed: SourceVideo, cues: TranscriptCue[], label: string): void {
    const normalized = normalizeTranscript(parsed.sourceId, cues);
    if (normalized.length === 0) {
      throw new Error("The transcript contained no usable timestamped segments.");
    }

    setSource(parsed);
    setSegments(normalized);
    setKnowledgeMap(deriveOutline(parsed.sourceId, normalized));
    setProviderLabel(label);
    setActivityMessage(null);
    setQuery("");
  }

  function applySavedExploration(saved: SavedExploration, message: string): void {
    setUrl(saved.source.canonicalUrl);
    setSource(saved.source);
    setSegments(saved.transcriptSegments);
    setKnowledgeMap(saved.knowledgeMap);
    setProviderLabel(saved.providerLabel ?? "Portable Projectr exploration");
    setMetadataMessage(null);
    setActivityMessage(message);
    setQuery("");
  }

  function clearResult(): void {
    setSource(null);
    setSegments([]);
    setKnowledgeMap(null);
    setProviderLabel(null);
    setActivityMessage(null);
  }

  function currentSnapshot(savedAt: string): SavedExploration {
    if (!source || !knowledgeMap) {
      throw new Error("Load an exploration before creating a Projectr artifact.");
    }
    return createSavedExploration({
      source,
      transcriptSegments: segments,
      knowledgeMap,
      savedAt,
      providerLabel: providerLabel ?? undefined,
    });
  }

  function downloadPackage(exploration: SavedExploration): void {
    const exportedAt = new Date().toISOString();
    const projectrPackage = createProjectrPackage(exploration, exportedAt);
    const blob = new Blob([serializeProjectrPackage(projectrPackage)], {
      type: `${PROJECTR_PACKAGE_MEDIA_TYPE};charset=utf-8`,
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = projectrFilename(exploration.source);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  async function exploreLive(): Promise<void> {
    setError(null);
    setLoading(true);

    try {
      const parsed = parseYouTubeUrl(url);
      const enriched = await enrichSource(parsed);
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsed.canonicalUrl, preferredLanguages: ["en"] }),
      });
      const payload = await response.json() as LiveTranscriptResponse;
      if (!response.ok || !payload.cues) {
        throw new Error(
          payload.error?.message ?? "Unable to obtain captions from the configured live provider.",
        );
      }
      applyTranscript(enriched, payload.cues, "Official YouTube captions / authorized video");
    } catch (caught) {
      clearResult();
      setError(caught instanceof Error ? caught.message : "Unable to explore this source.");
    } finally {
      setLoading(false);
    }
  }

  async function exploreDemo(): Promise<void> {
    setError(null);
    setLoading(true);

    try {
      const parsed = parseYouTubeUrl(url);
      const enriched = await enrichSource(parsed);
      applyTranscript(
        enriched,
        await demoTranscriptProvider.getTranscript(enriched),
        "Demo fixture / portable core",
      );
    } catch (caught) {
      clearResult();
      setError(caught instanceof Error ? caught.message : "Unable to load the demo transcript.");
    } finally {
      setLoading(false);
    }
  }

  async function importCaptions(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setLoading(true);
    try {
      const parsed = parseYouTubeUrl(url);
      const enriched = await enrichSource(parsed);
      const extension = file.name.toLowerCase().split(".").pop();
      const cues = parseCaptionText(
        await file.text(),
        extension === "srt" ? "srt" : extension === "vtt" ? "vtt" : undefined,
      );
      applyTranscript(enriched, cues, `Imported captions / ${file.name}`);
    } catch (caught) {
      clearResult();
      setError(caught instanceof Error ? caught.message : "Unable to import this caption file.");
    } finally {
      setLoading(false);
    }
  }

  async function importProjectrPackage(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setLoading(true);
    try {
      const projectrPackage = parseProjectrPackage(await file.text());
      applySavedExploration(
        projectrPackage.exploration,
        `Loaded portable package exported ${formatSavedAt(projectrPackage.exportedAt)}. Local storage is unchanged.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to import this Projectr package.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrent(): Promise<void> {
    setError(null);
    try {
      await explorationRepository.save(currentSnapshot(new Date().toISOString()));
      await refreshSavedExplorations();
      setActivityMessage("Saved in this browser through the Projectr repository port.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this exploration locally.");
    }
  }

  function exportCurrent(): void {
    setError(null);
    try {
      downloadPackage(currentSnapshot(new Date().toISOString()));
      setActivityMessage("Exported a portable Projectr package. Local storage is unchanged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to export this Projectr package.");
    }
  }

  async function loadSaved(id: string): Promise<void> {
    setError(null);
    try {
      const saved = await explorationRepository.get(id);
      if (!saved) {
        await refreshSavedExplorations();
        throw new Error("That saved exploration is no longer available.");
      }
      applySavedExploration(saved, `Loaded local snapshot saved ${formatSavedAt(saved.savedAt)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load this saved exploration.");
    }
  }

  async function exportSaved(id: string): Promise<void> {
    setError(null);
    try {
      const saved = await explorationRepository.get(id);
      if (!saved) {
        await refreshSavedExplorations();
        throw new Error("That saved exploration is no longer available.");
      }
      downloadPackage(saved);
      setActivityMessage("Exported a saved exploration as a portable Projectr package.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to export this saved exploration.");
    }
  }

  async function removeSaved(id: string): Promise<void> {
    setError(null);
    try {
      await explorationRepository.remove(id);
      await refreshSavedExplorations();
      setActivityMessage("Removed the local saved copy. The currently loaded exploration is unchanged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove this saved exploration.");
    }
  }

  const sourceDuration = formatDuration(source?.durationSeconds);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Projectr / YouTube Knowledge Explorer</p>
          <h1>Turn a long video into navigable knowledge.</h1>
          <p className={styles.lede}>Start with the source. Preserve timestamps. Search the transcript. Build a deterministic outline before adding AI enrichment.</p>
        </div>
        <span className={styles.prototypeBadge}>Portable core + adapters</span>
      </header>

      <section className={styles.ingest} aria-labelledby="ingest-heading">
        <div>
          <h2 id="ingest-heading">Explore a YouTube source</h2>
          <p>Metadata enrichment uses the official YouTube videos API when configured. Transcript acquisition remains a separate adapter and metadata failure never blocks transcript processing.</p>
        </div>
        <div className={styles.ingestControls}>
          <label className={styles.inputLabel} htmlFor="youtube-url">YouTube URL</label>
          <div className={styles.inputRow}>
            <input id="youtube-url" value={url} onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." inputMode="url" autoComplete="off" />
            <button type="button" onClick={exploreLive} disabled={loading}>{loading ? "Loading..." : "Try live captions"}</button>
          </div>
          <div className={styles.inputRow} style={{ marginTop: 10 }}>
            <button type="button" onClick={exploreDemo} disabled={loading}>Run demo core</button>
            <label className={styles.inputLabel} style={{ margin: 0, alignSelf: "center" }}>
              Import VTT/SRT
              <input type="file" accept=".vtt,.srt,text/vtt,application/x-subrip,text/plain" onChange={importCaptions} disabled={loading} style={{ marginLeft: 8 }} />
            </label>
          </div>
          <p>Projectr does not scrape the YouTube watch page. Acquisition, metadata, persistence, and interchange remain replaceable boundaries.</p>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </section>

      <section className={styles.library} aria-labelledby="saved-heading">
        <div className={styles.panelHeading}>
          <div><p className={styles.panelKicker}>Artifact boundary</p><h2 id="saved-heading">Saved and portable explorations</h2></div>
          <div className={styles.libraryActions}>
            <span>{savedExplorations.length} saved</span>
            <label className={styles.importButton}>
              Import Projectr JSON
              <input type="file" accept=".json,application/json" onChange={importProjectrPackage} disabled={loading} />
            </label>
          </div>
        </div>
        {savedExplorations.length > 0 ? (
          <div className={styles.savedList}>
            {savedExplorations.map((item) => (
              <article className={styles.savedItem} key={item.id}>
                <div>
                  <strong>{item.source.title ?? item.source.sourceId}</strong>
                  <p>{item.source.creatorName ? `${item.source.creatorName} · ` : ""}{item.source.durationSeconds !== undefined ? `${formatDuration(item.source.durationSeconds)} · ` : ""}{item.segmentCount} segments · {item.topicCount} topics</p>
                  <small>{formatSavedAt(item.savedAt)}{item.providerLabel ? ` · ${item.providerLabel}` : ""}</small>
                </div>
                <div className={styles.savedActions}>
                  <button type="button" onClick={() => loadSaved(item.id)}>Load</button>
                  <button type="button" className={styles.secondaryButton} onClick={() => exportSaved(item.id)}>Export</button>
                  <button type="button" className={styles.removeButton} onClick={() => removeSaved(item.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        ) : <p className={styles.empty}>No saved explorations yet. Import a Projectr package or save a loaded exploration; neither requires a database.</p>}
      </section>

      {source && knowledgeMap ? (
        <>
          <section className={styles.sourceBar} aria-label="Loaded source">
            <div className={styles.sourceIdentity}>
              <span className={styles.statusDot} aria-hidden="true" />
              <div>
                <strong>{source.title ?? source.sourceId}</strong>
                <p>{source.creatorName ?? "YouTube source"}{sourceDuration ? ` · ${sourceDuration}` : ""}</p>
              </div>
            </div>
            <div className={styles.sourceActions}>
              <span className={styles.fixtureNotice}>{providerLabel}</span>
              <button type="button" className={styles.secondaryButton} onClick={exportCurrent}>Export package</button>
              <button type="button" className={styles.saveButton} onClick={saveCurrent}>{currentIsSaved ? "Save new snapshot" : "Save locally"}</button>
            </div>
          </section>
          {metadataMessage ? <p className={styles.metadataMessage} role="status">Metadata: {metadataMessage}</p> : null}
          {activityMessage ? <p className={styles.activityMessage} role="status">{activityMessage}</p> : null}

          <section className={styles.workspace}>
            <aside className={styles.outlinePanel} aria-labelledby="outline-heading">
              <div className={styles.panelHeading}>
                <div><p className={styles.panelKicker}>Knowledge map</p><h2 id="outline-heading">Deterministic outline</h2></div>
                <span>{knowledgeMap.topics.length} sections</span>
              </div>
              <ol className={styles.topicList}>
                {knowledgeMap.topics.map((topic) => (
                  <li key={topic.id}><a href={youtubeTimestampUrl(source, topic.startSeconds)} target="_blank" rel="noreferrer"><span className={styles.timestamp}>{formatTimestamp(topic.startSeconds)}</span><span><strong>{topic.title}</strong><small>{topic.keywords.join(" · ")}</small></span></a></li>
                ))}
              </ol>
            </aside>

            <section className={styles.transcriptPanel} aria-labelledby="transcript-heading">
              <div className={styles.panelHeading}>
                <div><p className={styles.panelKicker}>Source transcript</p><h2 id="transcript-heading">Search and jump</h2></div>
                <span>{segments.length} segments</span>
              </div>
              <label className={styles.searchLabel} htmlFor="transcript-search">Search transcript</label>
              <input id="transcript-search" className={styles.searchInput} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search words or phrases..." />
              <div className={styles.segmentList}>
                {(query ? hits : segments).map((item) => {
                  const key = "segmentId" in item ? item.segmentId : item.id;
                  return <article className={styles.segment} key={key}><a className={styles.timestampLink} href={youtubeTimestampUrl(source, item.startSeconds)} target="_blank" rel="noreferrer">{formatTimestamp(item.startSeconds)}</a><p>{item.text}</p></article>;
                })}
                {query && hits.length === 0 ? <p className={styles.empty}>No matching transcript segments.</p> : null}
              </div>
            </section>
          </section>
        </>
      ) : (
        <section className={styles.emptyState}>
          <div><p className={styles.panelKicker}>Adapter boundaries intact</p><h2>One knowledge model, multiple acquisition, metadata, persistence, and interchange mechanisms.</h2></div>
          <ul><li>Official source metadata behind `SourceMetadataProvider`</li><li>Official OAuth captions or local VTT/SRT import</li><li>Browser-local persistence behind `ExplorationRepository`</li><li>Versioned Projectr JSON packages for external consumers such as CorpusForge</li></ul>
        </section>
      )}
    </main>
  );
}
