"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import styles from "./page.module.css";
import { DeterministicKnowledgeAnswerer } from "../adapters/knowledge/deterministic-answer";
import {
  DeterministicKnowledgeEnricher,
  DeterministicKnowledgeSearcher,
} from "../adapters/knowledge/deterministic";
import { BrowserLocalStorageExplorationRepository } from "../adapters/persistence/browser-local-storage";
import { parseCaptionText } from "../adapters/transcripts/caption-file";
import {
  PROJECTR_PACKAGE_MEDIA_TYPE,
  DemoTranscriptProvider,
  answerWithEvidence,
  createProjectrPackage,
  createSavedExploration,
  deriveOutline,
  explorationIdFor,
  isKnowledgeAnswerAdmissible,
  normalizeTranscript,
  parseProjectrPackage,
  parseYouTubeUrl,
  serializeProjectrPackage,
  youtubeTimestampUrl,
  type ExplorationSummary,
  type KnowledgeAnswer,
  type KnowledgeEnrichment,
  type KnowledgeMap,
  type KnowledgeSearchHit,
  type SavedExploration,
  type SourceVideo,
  type TranscriptCue,
  type TranscriptSegment,
} from "../core/projectr";

const demoTranscriptProvider = new DemoTranscriptProvider();
const explorationRepository = new BrowserLocalStorageExplorationRepository();
const knowledgeEnricher = new DeterministicKnowledgeEnricher();
const knowledgeSearcher = new DeterministicKnowledgeSearcher();
const deterministicAnswerer = new DeterministicKnowledgeAnswerer(knowledgeSearcher);

interface LiveTranscriptResponse {
  source?: SourceVideo;
  cues?: TranscriptCue[];
  error?: { message?: string };
}

interface MetadataResponse {
  source?: SourceVideo;
  error?: { code?: string; message?: string };
}

interface HostedAnswerResponse {
  answer?: KnowledgeAnswer;
  provider?: string;
  model?: string;
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
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null);
  const [answerMode, setAnswerMode] = useState<string | null>(null);
  const [source, setSource] = useState<SourceVideo | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeMap | null>(null);
  const [enrichment, setEnrichment] = useState<KnowledgeEnrichment | null>(null);
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([]);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [metadataMessage, setMetadataMessage] = useState<string | null>(null);
  const [savedExplorations, setSavedExplorations] = useState<ExplorationSummary[]>([]);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [answering, setAnswering] = useState(false);

  const currentSavedId = source ? explorationIdFor(source) : null;
  const currentIsSaved = currentSavedId
    ? savedExplorations.some((item) => item.id === currentSavedId)
    : false;
  const conceptById = useMemo(
    () => new Map((enrichment?.concepts ?? []).map((concept) => [concept.id, concept])),
    [enrichment],
  );
  const answerEvidenceById = useMemo(
    () => new Map((answer?.evidence ?? []).map((evidence) => [evidence.segmentId, evidence])),
    [answer],
  );
  const visibleConcepts = useMemo(() => {
    const concepts = enrichment?.concepts ?? [];
    const terms = concepts.filter((concept) => concept.kind === "term");
    return (terms.length > 0 ? terms : concepts).slice(0, 12);
  }, [enrichment]);

  useEffect(() => {
    void refreshSavedExplorations();
  }, []);

  useEffect(() => {
    let active = true;
    if (!query.trim() || !source || !knowledgeMap) {
      setHits([]);
      return () => { active = false; };
    }

    void knowledgeSearcher.search({
      sourceId: source.sourceId,
      transcriptSegments: segments,
      knowledgeMap,
      enrichment: enrichment ?? undefined,
      query,
    }).then((results) => {
      if (active) setHits(results);
    }).catch(() => {
      if (active) setHits([]);
    });

    return () => { active = false; };
  }, [query, source, segments, knowledgeMap, enrichment]);

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

  async function deriveKnowledge(
    sourceId: string,
    transcriptSegments: TranscriptSegment[],
    map: KnowledgeMap,
  ): Promise<KnowledgeEnrichment> {
    return knowledgeEnricher.enrich({ sourceId, transcriptSegments, knowledgeMap: map });
  }

  async function applyTranscript(parsed: SourceVideo, cues: TranscriptCue[], label: string): Promise<void> {
    const normalized = normalizeTranscript(parsed.sourceId, cues);
    if (normalized.length === 0) {
      throw new Error("The transcript contained no usable timestamped segments.");
    }

    const map = deriveOutline(parsed.sourceId, normalized);
    const derivedEnrichment = await deriveKnowledge(parsed.sourceId, normalized, map);
    setSource(parsed);
    setSegments(normalized);
    setKnowledgeMap(map);
    setEnrichment(derivedEnrichment);
    setProviderLabel(label);
    setActivityMessage(null);
    setQuery("");
    setQuestion("");
    setAnswer(null);
    setAnswerMode(null);
  }

  async function applySavedExploration(saved: SavedExploration, message: string): Promise<void> {
    const savedEnrichment = saved.enrichment
      ?? await deriveKnowledge(saved.source.sourceId, saved.transcriptSegments, saved.knowledgeMap);
    setUrl(saved.source.canonicalUrl);
    setSource(saved.source);
    setSegments(saved.transcriptSegments);
    setKnowledgeMap(saved.knowledgeMap);
    setEnrichment(savedEnrichment);
    setProviderLabel(saved.providerLabel ?? "Portable Projectr exploration");
    setMetadataMessage(null);
    setActivityMessage(message);
    setQuery("");
    setQuestion("");
    setAnswer(null);
    setAnswerMode(null);
  }

  function clearResult(): void {
    setSource(null);
    setSegments([]);
    setKnowledgeMap(null);
    setEnrichment(null);
    setHits([]);
    setProviderLabel(null);
    setActivityMessage(null);
    setQuery("");
    setQuestion("");
    setAnswer(null);
    setAnswerMode(null);
  }

  function currentSnapshot(savedAt: string): SavedExploration {
    if (!source || !knowledgeMap) {
      throw new Error("Load an exploration before creating a Projectr artifact.");
    }
    return createSavedExploration({
      source,
      transcriptSegments: segments,
      knowledgeMap,
      enrichment: enrichment ?? undefined,
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

  async function askVideo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!source || !knowledgeMap || !question.trim()) return;

    const input = {
      sourceId: source.sourceId,
      question,
      transcriptSegments: segments,
      knowledgeMap,
      enrichment: enrichment ?? undefined,
      maxEvidence: 3,
    };

    setError(null);
    setAnswering(true);
    setAnswerMode(null);
    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json() as HostedAnswerResponse;

      if (response.ok && payload.answer) {
        if (!isKnowledgeAnswerAdmissible(payload.answer, input)) {
          throw new Error("Hosted answer failed the local Projectr evidence-boundary check.");
        }
        setAnswer(payload.answer);
        setAnswerMode(`OpenAI Responses · ${payload.model ?? "configured model"}`);
        return;
      }

      if (payload.error?.code !== "answer_not_configured") {
        throw new Error(payload.error?.message ?? "Hosted answer provider failed.");
      }

      const fallback = await answerWithEvidence(deterministicAnswerer, input);
      setAnswer(fallback);
      setAnswerMode("Deterministic extractive fallback");
    } catch (caught) {
      setAnswer(null);
      setAnswerMode(null);
      setError(caught instanceof Error ? caught.message : "Unable to answer from this source.");
    } finally {
      setAnswering(false);
    }
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
      await applyTranscript(enriched, payload.cues, "Official YouTube captions / authorized video");
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
      await applyTranscript(
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
      await applyTranscript(enriched, cues, `Imported captions / ${file.name}`);
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
      await applySavedExploration(
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
      await applySavedExploration(saved, `Loaded local snapshot saved ${formatSavedAt(saved.savedAt)}.`);
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
          <p className={styles.lede}>Start with the source. Preserve timestamps. Search evidence, inspect concepts, and ask questions whose claims stay bound to the transcript.</p>
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
          <p>Projectr does not scrape the YouTube watch page. Acquisition, metadata, enrichment, retrieval, answering, persistence, and interchange remain replaceable boundaries.</p>
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
                  <p>{item.source.creatorName ? `${item.source.creatorName} · ` : ""}{item.source.durationSeconds !== undefined ? `${formatDuration(item.source.durationSeconds)} · ` : ""}{item.segmentCount} segments · {item.topicCount} topics · {item.conceptCount} concepts</p>
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
              <button type="button" className={styles.saveButton} onClick={saveCurrent}>{currentIsSaved ? "Update saved copy" : "Save locally"}</button>
            </div>
          </section>
          {metadataMessage ? <p className={styles.metadataMessage} role="status">Metadata: {metadataMessage}</p> : null}
          {activityMessage ? <p className={styles.activityMessage} role="status">{activityMessage}</p> : null}

          <section className={styles.askPanel} aria-labelledby="ask-heading">
            <div className={styles.panelHeading}>
              <div><p className={styles.panelKicker}>Evidence-bound answer</p><h2 id="ask-heading">Ask this video</h2></div>
              <span>{answerMode ?? "hosted synthesis when configured"}</span>
            </div>
            <form className={styles.askForm} onSubmit={askVideo}>
              <input value={question} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuestion(event.target.value)} placeholder="What does the source say about...?" aria-label="Question about this video" />
              <button type="submit" disabled={answering || !question.trim()}>{answering ? "Checking evidence..." : "Ask"}</button>
            </form>
            <p className={styles.askNote}>When the server has an OpenAI key, Projectr retrieves bounded evidence first and the hosted model may synthesize only claim text against that evidence. Projectr reconstructs source excerpts and validates the result again before display. Without hosted configuration, the deterministic extractive answerer remains available.</p>
            {answer ? (
              answer.status === "answered" ? (
                <div className={styles.answerCard}>
                  <div className={styles.answerHeader}><strong>Answer from source evidence</strong><span>{answer.evidence.length} evidence segment{answer.evidence.length === 1 ? "" : "s"}</span></div>
                  <ol className={styles.answerClaims}>
                    {answer.claims.map((claim) => (
                      <li key={claim.id}>
                        <p>{claim.text}</p>
                        <div className={styles.answerEvidenceLinks}>
                          {claim.evidenceSegmentIds.map((segmentId) => {
                            const evidence = answerEvidenceById.get(segmentId);
                            return evidence ? <a key={segmentId} href={youtubeTimestampUrl(source, evidence.startSeconds)} target="_blank" rel="noreferrer">Evidence {formatTimestamp(evidence.startSeconds)}</a> : null;
                          })}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : <p className={styles.insufficientAnswer}>Projectr found insufficient transcript evidence to answer that question without inventing support.</p>
            ) : null}
          </section>

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

              <div className={styles.conceptSection}>
                <div className={styles.conceptHeading}>
                  <div><p className={styles.panelKicker}>Enrichment boundary</p><h3>Concept layer</h3></div>
                  <span>{enrichment?.concepts.length ?? 0} concepts</span>
                </div>
                <p className={styles.conceptNote}>Generated deterministically today; the same portable contract can later be produced by an embedding or LLM adapter.</p>
                <div className={styles.conceptList}>
                  {visibleConcepts.map((concept) => (
                    <button type="button" key={concept.id} onClick={() => setQuery(concept.label)} title={`Search evidence linked to ${concept.label}`}>
                      {concept.label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className={styles.transcriptPanel} aria-labelledby="transcript-heading">
              <div className={styles.panelHeading}>
                <div><p className={styles.panelKicker}>Evidence retrieval</p><h2 id="transcript-heading">Search and jump</h2></div>
                <span>{segments.length} segments</span>
              </div>
              <label className={styles.searchLabel} htmlFor="transcript-search">Search text or concepts</label>
              <input id="transcript-search" className={styles.searchInput} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search words, phrases, or concepts..." />
              <p className={styles.searchNote}>Direct transcript matches are ranked with concept-linked evidence. No model call is required for the current adapter.</p>
              <div className={styles.segmentList}>
                {(query ? hits : segments).map((item) => {
                  const key = "segmentId" in item ? item.segmentId : item.id;
                  const matchedConceptLabels = "matchedConceptIds" in item
                    ? item.matchedConceptIds
                      .map((id) => conceptById.get(id)?.label)
                      .filter((label): label is string => Boolean(label))
                      .slice(0, 3)
                    : [];
                  return <article className={styles.segment} key={key}><a className={styles.timestampLink} href={youtubeTimestampUrl(source, item.startSeconds)} target="_blank" rel="noreferrer">{formatTimestamp(item.startSeconds)}</a><div><p>{item.text}</p>{matchedConceptLabels.length > 0 ? <small className={styles.matchMeta}>Concept links: {matchedConceptLabels.join(" · ")}</small> : null}</div></article>;
                })}
                {query && hits.length === 0 ? <p className={styles.empty}>No matching transcript or concept-linked evidence.</p> : null}
              </div>
            </section>
          </section>
        </>
      ) : (
        <section className={styles.emptyState}>
          <div><p className={styles.panelKicker}>Adapter boundaries intact</p><h2>One knowledge model, multiple acquisition, metadata, enrichment, retrieval, answering, persistence, and interchange mechanisms.</h2></div>
          <ul><li>Official source metadata behind `SourceMetadataProvider`</li><li>Official OAuth captions or local VTT/SRT import</li><li>Portable concepts behind `KnowledgeEnricher`</li><li>Replaceable retrieval behind `KnowledgeSearcher`</li><li>Evidence-bound claims behind `KnowledgeAnswerer`</li><li>Browser-local persistence behind `ExplorationRepository`</li><li>Versioned Projectr JSON packages for external consumers such as CorpusForge</li></ul>
        </section>
      )}
    </main>
  );
}
