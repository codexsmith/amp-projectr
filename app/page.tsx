"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
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

const DEMO_SOURCE: SourceVideo = {
  kind: "youtube",
  sourceId: "projectr001",
  canonicalUrl: "https://www.youtube.com/watch?v=projectr001",
  title: "How Projectr keeps knowledge tied to its source",
  creatorName: "Built-in Projectr demo",
  durationSeconds: 154,
};

type SourceMode = "demo" | "live" | "captions" | "package";
type DeepView = "transcript" | "concepts" | "outline";

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

function StepHeading({
  number,
  label,
  title,
  hint,
  headingId,
  aside,
}: {
  number: number;
  label: string;
  title: string;
  hint: string;
  headingId: string;
  aside?: ReactNode;
}) {
  return (
    <div className={styles.stepHeading}>
      <span className={styles.stepNumber} aria-hidden="true">{number}</span>
      <div className={styles.stepCopy}>
        <span className={styles.stepLabel}>{label}</span>
        <h2 id={headingId}>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className={styles.stepAside}>{aside}</div> : null}
    </div>
  );
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null);
  const [answerMode, setAnswerMode] = useState<string | null>(null);
  const [source, setSource] = useState<SourceVideo | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode | null>(null);
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
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [deepView, setDeepView] = useState<DeepView>("transcript");

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
    return (terms.length > 0 ? terms : concepts).slice(0, 8);
  }, [enrichment]);
  const activeSegment = useMemo(
    () => segments.find((segment) => segment.id === activeSegmentId) ?? segments[0] ?? null,
    [segments, activeSegmentId],
  );
  const selectedTopic = useMemo(
    () => knowledgeMap?.topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [knowledgeMap, selectedTopicId],
  );
  const selectedConcept = useMemo(
    () => enrichment?.concepts.find((concept) => concept.id === selectedConceptId) ?? null,
    [enrichment, selectedConceptId],
  );
  const selectedSegmentIds = selectedConcept?.segmentIds ?? selectedTopic?.segmentIds ?? [];
  const focusedSegments = useMemo(() => {
    if (query.trim()) return hits;
    if (selectedSegmentIds.length > 0) {
      const selectedIds = new Set(selectedSegmentIds);
      return segments.filter((segment) => selectedIds.has(segment.id));
    }
    return segments;
  }, [query, hits, selectedSegmentIds, segments]);

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
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as MetadataResponse
        : {};
      if (!response.ok || !payload.source) {
        setMetadataMessage(
          payload.error?.message ?? "Source details are unavailable; transcript processing can continue.",
        );
        return parsed;
      }
      setMetadataMessage(null);
      return payload.source;
    } catch {
      setMetadataMessage("Source details are unavailable; transcript processing can continue.");
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

  async function applyTranscript(
    parsed: SourceVideo,
    cues: TranscriptCue[],
    label: string,
    mode: SourceMode,
  ): Promise<void> {
    const normalized = normalizeTranscript(parsed.sourceId, cues);
    if (normalized.length === 0) throw new Error("The transcript contained no usable timestamped moments.");

    const map = deriveOutline(parsed.sourceId, normalized);
    const derivedEnrichment = await deriveKnowledge(parsed.sourceId, normalized, map);
    setSource(parsed);
    setSourceMode(mode);
    setSegments(normalized);
    setKnowledgeMap(map);
    setEnrichment(derivedEnrichment);
    setProviderLabel(label);
    setActivityMessage(`${mode === "demo" ? "Demo ready" : "Source ready"}: ${normalized.length} timestamped moments, ${map.topics.length} topics, and ${derivedEnrichment.concepts.length} concepts.`);
    setSearchDraft("");
    setQuery("");
    setQuestion("");
    setAnswer(null);
    setAnswerMode(null);
    setActiveSegmentId(normalized[0].id);
    setSelectedTopicId(null);
    setSelectedConceptId(null);
    setDeepView("transcript");
  }

  async function applySavedExploration(saved: SavedExploration, message: string): Promise<void> {
    const savedEnrichment = saved.enrichment
      ?? await deriveKnowledge(saved.source.sourceId, saved.transcriptSegments, saved.knowledgeMap);
    setUrl(saved.source.canonicalUrl);
    setSource(saved.source);
    setSourceMode(saved.providerLabel?.toLowerCase().includes("demo fixture") ? "demo" : "package");
    setSegments(saved.transcriptSegments);
    setKnowledgeMap(saved.knowledgeMap);
    setEnrichment(savedEnrichment);
    setProviderLabel(saved.providerLabel ?? "Portable Projectr exploration");
    setMetadataMessage(null);
    setActivityMessage(message);
    setSearchDraft("");
    setQuery("");
    setQuestion("");
    setAnswer(null);
    setAnswerMode(null);
    setActiveSegmentId(saved.transcriptSegments[0]?.id ?? null);
    setSelectedTopicId(null);
    setSelectedConceptId(null);
    setDeepView("transcript");
  }

  function clearResult(): void {
    setSource(null);
    setSourceMode(null);
    setSegments([]);
    setKnowledgeMap(null);
    setEnrichment(null);
    setHits([]);
    setProviderLabel(null);
    setActivityMessage(null);
    setSearchDraft("");
    setQuery("");
    setQuestion("");
    setAnswer(null);
    setAnswerMode(null);
    setActiveSegmentId(null);
    setSelectedTopicId(null);
    setSelectedConceptId(null);
  }

  function currentSnapshot(savedAt: string): SavedExploration {
    if (!source || !knowledgeMap) throw new Error("Load an exploration before creating a Projectr artifact.");
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
    const blob = new Blob([serializeProjectrPackage(projectrPackage)], { type: `${PROJECTR_PACKAGE_MEDIA_TYPE};charset=utf-8` });
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
      if (sourceMode === "demo") {
        setAnswer(await answerWithEvidence(deterministicAnswerer, input));
        setAnswerMode("Source-only deterministic answer");
        return;
      }

      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if ([404, 405].includes(response.status) || !response.headers.get("content-type")?.includes("application/json")) {
        setAnswer(await answerWithEvidence(deterministicAnswerer, input));
        setAnswerMode("Source-only deterministic answer");
        return;
      }
      const payload = await response.json() as HostedAnswerResponse;
      if (response.ok && payload.answer) {
        if (!isKnowledgeAnswerAdmissible(payload.answer, input)) throw new Error("Hosted answer failed the local Projectr evidence check.");
        setAnswer(payload.answer);
        setAnswerMode(`Hosted synthesis · ${payload.model ?? "configured model"}`);
        return;
      }
      if (payload.error?.code !== "answer_not_configured") throw new Error(payload.error?.message ?? "Hosted answer provider failed.");
      setAnswer(await answerWithEvidence(deterministicAnswerer, input));
      setAnswerMode("Source-only deterministic answer");
    } catch (caught) {
      setAnswer(null);
      setAnswerMode(null);
      setError(caught instanceof Error ? caught.message : "Unable to answer from this source.");
    } finally {
      setAnswering(false);
    }
  }

  async function exploreLive(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
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
      const payload = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as LiveTranscriptResponse
        : {};
      if (!response.ok || !payload.cues) throw new Error(payload.error?.message ?? "Unable to obtain captions from the configured live provider.");
      await applyTranscript(enriched, payload.cues, "Authorized YouTube captions", "live");
    } catch (caught) {
      clearResult();
      setError(caught instanceof Error ? caught.message : "Unable to explore this source.");
    } finally {
      setLoading(false);
    }
  }

  async function exploreDemo(): Promise<void> {
    setError(null);
    setMetadataMessage(null);
    setLoading(true);
    try {
      await applyTranscript(DEMO_SOURCE, await demoTranscriptProvider.getTranscript(DEMO_SOURCE), "Built-in demo fixture · no network", "demo");
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
      const cues = parseCaptionText(await file.text(), extension === "srt" ? "srt" : extension === "vtt" ? "vtt" : undefined);
      await applyTranscript(enriched, cues, `Imported captions · ${file.name}`, "captions");
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
      await applySavedExploration(projectrPackage.exploration, `Portable package loaded. It was exported ${formatSavedAt(projectrPackage.exportedAt)}; local storage is unchanged.`);
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
      setActivityMessage("Saved locally in this browser. You can reload or export this exploration below.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this exploration locally.");
    }
  }

  function exportCurrent(): void {
    setError(null);
    try {
      downloadPackage(currentSnapshot(new Date().toISOString()));
      setActivityMessage("Portable Projectr package exported. Your local saved state is unchanged.");
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
      await applySavedExploration(saved, `Local exploration loaded from ${formatSavedAt(saved.savedAt)}.`);
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
      setActivityMessage("Saved exploration exported as a portable Projectr package.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to export this saved exploration.");
    }
  }

  async function removeSaved(id: string): Promise<void> {
    setError(null);
    try {
      await explorationRepository.remove(id);
      await refreshSavedExplorations();
      setActivityMessage("Local saved copy removed. The open exploration is unchanged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove this saved exploration.");
    }
  }

  function chooseSegment(segmentId: string): void { setActiveSegmentId(segmentId); }

  function selectAtSeconds(seconds: number): void {
    if (segments.length === 0) return;
    const nearest = segments.reduce((best, segment) => (
      Math.abs(segment.startSeconds - seconds) < Math.abs(best.startSeconds - seconds) ? segment : best
    ), segments[0]);
    setActiveSegmentId(nearest.id);
  }

  function moveActive(direction: -1 | 1): void {
    if (segments.length === 0) return;
    const currentIndex = Math.max(0, segments.findIndex((segment) => segment.id === activeSegment?.id));
    const nextIndex = Math.min(segments.length - 1, Math.max(0, currentIndex + direction));
    setActiveSegmentId(segments[nextIndex].id);
  }

  function selectTopic(topicId: string): void {
    const topic = knowledgeMap?.topics.find((item) => item.id === topicId);
    if (!topic) return;
    setSelectedTopicId(topic.id);
    setSelectedConceptId(null);
    setSearchDraft("");
    setQuery("");
    setActiveSegmentId(topic.segmentIds[0] ?? null);
  }

  function selectConcept(conceptId: string): void {
    const concept = enrichment?.concepts.find((item) => item.id === conceptId);
    if (!concept) return;
    setSelectedConceptId(concept.id);
    setSelectedTopicId(null);
    setSearchDraft("");
    setQuery("");
    setActiveSegmentId(concept.segmentIds[0] ?? null);
  }

  function searchTranscript(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSelectedTopicId(null);
    setSelectedConceptId(null);
    setQuery(searchDraft.trim());
  }

  function clearTranscriptFocus(): void {
    setSearchDraft("");
    setQuery("");
    setSelectedTopicId(null);
    setSelectedConceptId(null);
  }

  const sourceDurationSeconds = source?.durationSeconds ?? segments[segments.length - 1]?.endSeconds ?? 0;
  const sourceDuration = formatDuration(sourceDurationSeconds);
  const selectionLabel = selectedConcept?.label ?? selectedTopic?.title ?? null;
  const selectionKind = selectedConcept ? "Concept" : selectedTopic ? "Topic" : null;
  const selectionPreview = selectedSegmentIds.length > 0 ? segments.find((segment) => segment.id === selectedSegmentIds[0]) ?? null : null;
  const isDemo = sourceMode === "demo";

  return (
    <main className={styles.pageShell}>
      <header className={styles.siteHeader}>
        <a className={styles.brand} href="#top" aria-label="Projectr home">
          <span className={styles.brandMark} aria-hidden="true">P</span>
          <span><strong>Projectr</strong><small>YouTube Knowledge Explorer</small></span>
        </a>
        <p className={styles.headerPromise}>Every insight stays connected to a timestamp.</p>
        {source ? <span className={styles.readyPill}><span aria-hidden="true">✓</span> Exploration ready</span> : null}
      </header>

      <section className={styles.intro} id="top">
        <p className={styles.eyebrow}>A clearer way through long-form video</p>
        <h1>Turn a long video into<br />navigable knowledge.</h1>
        <p>Start with the source. Preserve timestamps. Search evidence, inspect concepts, and ask questions whose answers stay bound to the transcript.</p>
      </section>

      {error ? <div className={styles.errorBanner} role="alert"><strong>Something needs attention.</strong><span>{error}</span></div> : null}

      <section className={`${styles.journeyCard} ${styles.chooseCard}`} aria-labelledby="choose-heading">
        <StepHeading number={1} label="Choose" title="Choose a video to explore" hint="Try the complete experience with the built-in source. It works without an account, key, provider, or network request." headingId="choose-heading" aside={source ? <span className={styles.completedLabel}>Completed</span> : null} />
        <div className={styles.chooseActions}>
          <button className={styles.demoButton} type="button" onClick={exploreDemo} disabled={loading}>
            <span>{loading ? "Preparing…" : sourceMode === "demo" ? "Restart demo" : "Run demo"}</span>
            <span className={styles.buttonArrow} aria-hidden="true">→</span>
          </button>
          <details className={styles.sourceDisclosure}>
            <summary>Use your own YouTube source</summary>
            <div className={styles.sourceOptions}>
              <form onSubmit={exploreLive} className={styles.urlForm}>
                <label htmlFor="youtube-url">YouTube URL</label>
                <div className={styles.fieldRow}>
                  <input id="youtube-url" value={url} onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" autoComplete="off" />
                  <button type="submit" disabled={loading || !url.trim()}>Load authorized captions</button>
                </div>
              </form>
              <div className={styles.importRow}>
                <span>Already have captions?</span>
                <label className={styles.fileButton}>Import VTT or SRT<input type="file" accept=".vtt,.srt,text/vtt,application/x-subrip,text/plain" onChange={importCaptions} disabled={loading} /></label>
              </div>
              <p className={styles.helperText}>Your URL is used only when you choose a live or caption-file path. Projectr does not scrape the watch page.</p>
            </div>
          </details>
        </div>
        {source && knowledgeMap && enrichment ? (
          <div className={styles.loadConsequence} role="status">
            <span className={styles.successIcon} aria-hidden="true">✓</span>
            <div><strong>{activityMessage?.startsWith("Demo ready") ? activityMessage : "Exploration ready."}</strong><span>{isDemo ? "Built entirely from the local fixture. No YouTube, metadata, caption, or AI request was made." : providerLabel}</span></div>
          </div>
        ) : (
          <div className={styles.demoPreview} aria-label="What the demo includes">
            <span><strong>10</strong> timestamped moments</span>
            <span><strong>Structured</strong> topics and concepts</span>
            <span><strong>Traceable</strong> source-only answers</span>
          </div>
        )}
      </section>

      {source && knowledgeMap ? (
        <>
          <div className={styles.primaryGrid}>
            <section className={`${styles.journeyCard} ${styles.watchCard}`} aria-labelledby="watch-heading">
              <StepHeading number={2} label="Watch" title="Stay anchored to the source" hint={isDemo ? "Move through the fixture timeline. The active transcript context follows you." : "Move through the source timeline. The active transcript context follows you."} headingId="watch-heading" aside={<span className={styles.dataPill}>{providerLabel}</span>} />
              <div className={styles.sourceStage}>
                <div className={styles.sourceStageTop}><span className={styles.sourceModeLabel}>{isDemo ? "Guided demo" : "Active source"}</span><span>{sourceDuration}</span></div>
                <div className={styles.sourceTitleBlock}>
                  <span className={styles.playGlyph} aria-hidden="true">▶</span>
                  <div><h3>{source.title ?? source.sourceId}</h3><p>{source.creatorName ?? "YouTube source"}</p></div>
                </div>
                <div className={styles.timelineBlock}>
                  <div className={styles.timelineLabels}><label htmlFor="source-timeline">Active timestamp</label><strong>{formatTimestamp(activeSegment?.startSeconds ?? 0)}</strong></div>
                  <input id="source-timeline" className={styles.timeline} type="range" min="0" max={Math.max(1, Math.floor(sourceDurationSeconds))} value={Math.floor(activeSegment?.startSeconds ?? 0)} onChange={(event) => selectAtSeconds(Number(event.target.value))} />
                  <div className={styles.timelineControls}>
                    <button type="button" onClick={() => moveActive(-1)} disabled={activeSegment?.id === segments[0]?.id} aria-label="Previous transcript moment">← Previous</button>
                    <span>{isDemo ? "Simulated fixture timeline" : "Timestamp-linked source context"}</span>
                    <button type="button" onClick={() => moveActive(1)} disabled={activeSegment?.id === segments[segments.length - 1]?.id} aria-label="Next transcript moment">Next →</button>
                  </div>
                </div>
              </div>
              <div className={styles.activeContext} role="status" aria-live="polite">
                <div className={styles.contextTime}>{formatTimestamp(activeSegment?.startSeconds ?? 0)}</div>
                <div><span>Current transcript context</span><p>{activeSegment?.text}</p></div>
              </div>
              {!isDemo ? <a className={styles.sourceLink} href={youtubeTimestampUrl(source, activeSegment?.startSeconds ?? 0)} target="_blank" rel="noreferrer">Open source at {formatTimestamp(activeSegment?.startSeconds ?? 0)} <span aria-hidden="true">↗</span></a> : null}
              {metadataMessage ? <p className={styles.inlineNotice} role="status">{metadataMessage}</p> : null}
            </section>

            <section className={`${styles.journeyCard} ${styles.understandCard}`} aria-labelledby="understand-heading">
              <StepHeading number={3} label="Understand" title="See the shape of the source" hint="Choose a topic or concept. Projectr will show exactly which moments support it." headingId="understand-heading" aside={<span className={styles.dataPill}>{knowledgeMap.topics.length} topics · {enrichment?.concepts.length ?? 0} concepts</span>} />
              <div className={styles.takeawayList}>
                {knowledgeMap.topics.slice(0, 3).map((topic) => {
                  const firstSegment = segments.find((segment) => topic.segmentIds.includes(segment.id));
                  const selected = selectedTopicId === topic.id;
                  return (
                    <button className={selected ? styles.takeawaySelected : ""} type="button" key={topic.id} onClick={() => selectTopic(topic.id)} aria-pressed={selected}>
                      <span className={styles.takeawayTime}>{formatTimestamp(topic.startSeconds)}</span>
                      <span><strong>{topic.title}</strong><small>{firstSegment?.text}</small></span>
                      <span className={styles.chevron} aria-hidden="true">›</span>
                    </button>
                  );
                })}
              </div>
              <div className={styles.conceptCluster} aria-label="Key concepts">
                {visibleConcepts.map((concept) => <button type="button" key={concept.id} onClick={() => selectConcept(concept.id)} aria-pressed={selectedConceptId === concept.id}>{concept.label}</button>)}
              </div>
              {selectionLabel && selectionPreview ? (
                <div className={styles.selectionConsequence} role="status">
                  <span>{selectionKind} selected</span><strong>{selectionLabel}</strong><p><b>{formatTimestamp(selectionPreview.startSeconds)}</b> {selectionPreview.text}</p>
                  <button type="button" onClick={() => setDeepView("transcript")}>View {selectedSegmentIds.length} related moment{selectedSegmentIds.length === 1 ? "" : "s"} below →</button>
                </div>
              ) : <p className={styles.selectionHint}>Select any item to focus its supporting evidence.</p>}
            </section>
          </div>

          <section className={`${styles.journeyCard} ${styles.askCard}`} aria-labelledby="ask-heading">
            <StepHeading number={4} label="Ask" title="Ask from the evidence in this source" hint="Projectr answers only when it can point back to timestamped transcript evidence." headingId="ask-heading" aside={answerMode ? <span className={styles.dataPill}>{answerMode}</span> : null} />
            <div className={styles.askLayout}>
              <div>
                <form className={styles.askForm} onSubmit={askVideo}>
                  <label htmlFor="source-question">Your question</label>
                  <div className={styles.fieldRow}>
                    <input id="source-question" value={question} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuestion(event.target.value)} placeholder="What does the source say about preserving evidence?" />
                    <button type="submit" disabled={answering || !question.trim()}>{answering ? "Checking…" : "Ask Projectr"}</button>
                  </div>
                </form>
                <div className={styles.exampleQuestions}>
                  <span>Try an example:</span>
                  <button type="button" onClick={() => setQuestion("How does Projectr preserve evidence?")}>How is evidence preserved?</button>
                  <button type="button" onClick={() => setQuestion("Did astronauts visit Europa?")}>Did astronauts visit Europa?</button>
                </div>
              </div>
              <div className={`${styles.answerSurface} ${answer ? styles.answerSurfaceReady : ""}`} aria-live="polite">
                {!answer ? (
                  <div className={styles.answerEmpty}><span className={styles.answerIcon} aria-hidden="true">?</span><div><strong>Your answer will appear here</strong><p>Supporting moments will stay visible beside each claim.</p></div></div>
                ) : answer.status === "answered" ? (
                  <div>
                    <div className={styles.answerHeader}><span className={styles.answerCheck} aria-hidden="true">✓</span><div><strong>Answered from source evidence</strong><p>{answer.evidence.length} supporting moment{answer.evidence.length === 1 ? "" : "s"}</p></div></div>
                    <ol className={styles.answerClaims}>
                      {answer.claims.map((claim) => (
                        <li key={claim.id}><p>{claim.text}</p><div className={styles.answerEvidenceLinks}>{claim.evidenceSegmentIds.map((segmentId) => {
                          const evidence = answerEvidenceById.get(segmentId);
                          return evidence ? <button type="button" key={segmentId} onClick={() => chooseSegment(segmentId)}>View evidence · {formatTimestamp(evidence.startSeconds)}</button> : null;
                        })}</div></li>
                      ))}
                    </ol>
                  </div>
                ) : <div className={styles.insufficientAnswer}><span aria-hidden="true">!</span><div><strong>Not enough evidence in this source</strong><p>Projectr found no transcript support for that question, so it did not invent an answer.</p></div></div>}
              </div>
            </div>
          </section>

          <section className={`${styles.journeyCard} ${styles.exploreCard}`} id="deep-explorer" aria-labelledby="explore-heading">
            <StepHeading number={5} label="Explore deeper" title="Choose how you want to go deeper" hint="Search every transcript moment, browse concepts, or open the full outline without losing your current context." headingId="explore-heading" aside={<span className={styles.contextPill}>{selectionLabel ? `${selectionKind}: ${selectionLabel}` : `At ${formatTimestamp(activeSegment?.startSeconds ?? 0)}`}</span>} />
            <div className={styles.viewSwitcher} aria-label="Deeper exploration views">
              <button type="button" aria-pressed={deepView === "transcript"} onClick={() => setDeepView("transcript")}>Search transcript</button>
              <button type="button" aria-pressed={deepView === "concepts"} onClick={() => setDeepView("concepts")}>Browse concepts</button>
              <button type="button" aria-pressed={deepView === "outline"} onClick={() => setDeepView("outline")}>View outline</button>
            </div>

            {deepView === "transcript" ? (
              <div className={styles.deepPanel}>
                <form className={styles.searchForm} onSubmit={searchTranscript}>
                  <label htmlFor="transcript-search">Find a word, phrase, or idea</label>
                  <div className={styles.fieldRow}><input id="transcript-search" value={searchDraft} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchDraft(event.target.value)} placeholder="Search the transcript…" /><button type="submit" disabled={!searchDraft.trim()}>Search</button></div>
                </form>
                <div className={styles.resultBar} role="status">
                  <span>{query ? `${hits.length} result${hits.length === 1 ? "" : "s"} for “${query}”` : selectionLabel ? `${selectedSegmentIds.length} moment${selectedSegmentIds.length === 1 ? "" : "s"} supporting ${selectionLabel}` : `${segments.length} timestamped transcript moments`}</span>
                  {(query || selectionLabel) ? <button type="button" onClick={clearTranscriptFocus}>Show full transcript</button> : null}
                </div>
                <div className={styles.segmentList}>
                  {focusedSegments.map((item) => {
                    const key = "segmentId" in item ? item.segmentId : item.id;
                    const matchedConceptLabels = "matchedConceptIds" in item ? item.matchedConceptIds.map((id) => conceptById.get(id)?.label).filter((label): label is string => Boolean(label)).slice(0, 3) : [];
                    return (
                      <article className={`${styles.segment} ${activeSegment?.id === key ? styles.segmentActive : ""}`} key={key}>
                        <button className={styles.timestampButton} type="button" onClick={() => chooseSegment(key)} aria-label={`Set active timestamp to ${formatTimestamp(item.startSeconds)}`}>{formatTimestamp(item.startSeconds)}</button>
                        <div><p>{item.text}</p>{matchedConceptLabels.length > 0 ? <small>Related: {matchedConceptLabels.join(" · ")}</small> : null}</div>
                        {activeSegment?.id === key ? <span className={styles.currentBadge}>Current</span> : null}
                      </article>
                    );
                  })}
                  {query && hits.length === 0 ? <div className={styles.noResults}><strong>No matching evidence</strong><p>Try a phrase that appears in the transcript, such as “timestamps” or “source.”</p></div> : null}
                </div>
              </div>
            ) : null}

            {deepView === "concepts" ? (
              <div className={styles.deepPanel}>
                <div className={styles.panelIntro}><strong>{enrichment?.concepts.length ?? 0} source-linked concepts</strong><span>Select one to focus its transcript evidence.</span></div>
                <div className={styles.conceptGrid}>{(enrichment?.concepts ?? []).map((concept) => (
                  <button type="button" key={concept.id} onClick={() => { selectConcept(concept.id); setDeepView("transcript"); }}><span className={styles.conceptKind}>{concept.kind === "topic" ? "Topic" : "Concept"}</span><strong>{concept.label}</strong><small>{concept.segmentIds.length} related moment{concept.segmentIds.length === 1 ? "" : "s"}</small><span className={styles.chevron} aria-hidden="true">›</span></button>
                ))}</div>
              </div>
            ) : null}

            {deepView === "outline" ? (
              <div className={styles.deepPanel}>
                <div className={styles.panelIntro}><strong>{knowledgeMap.topics.length} source sections</strong><span>Select a section to focus its moments and timestamp.</span></div>
                <ol className={styles.outlineList}>{knowledgeMap.topics.map((topic, index) => (
                  <li key={topic.id}><button type="button" onClick={() => { selectTopic(topic.id); setDeepView("transcript"); }}><span className={styles.outlineIndex}>{String(index + 1).padStart(2, "0")}</span><span className={styles.outlineTime}>{formatTimestamp(topic.startSeconds)}</span><span><strong>{topic.title}</strong><small>{topic.keywords.join(" · ")}</small></span><span className={styles.chevron} aria-hidden="true">›</span></button></li>
                ))}</ol>
              </div>
            ) : null}
          </section>

          <section className={styles.keepCard} aria-labelledby="keep-heading">
            <div><span className={styles.keepLabel}>Keep your exploration</span><h2 id="keep-heading">Save here or take it with you.</h2><p>Local saves stay in this browser. Exports use Projectr’s portable, versioned package.</p></div>
            <div className={styles.keepActions}><button type="button" className={styles.secondaryButton} onClick={saveCurrent}>{currentIsSaved ? "Update saved copy" : "Save in this browser"}</button><button type="button" className={styles.primaryButton} onClick={exportCurrent}>Export package <span aria-hidden="true">↓</span></button></div>
            {activityMessage && !activityMessage.startsWith("Demo ready") ? <p className={styles.keepConsequence} role="status"><span aria-hidden="true">✓</span>{activityMessage}</p> : null}
          </section>
        </>
      ) : (
        <section className={styles.firstRunGuide} aria-label="Projectr journey"><p>One click turns the fixture into a source you can:</p><div><span><b>1</b> Watch</span><span aria-hidden="true">→</span><span><b>2</b> Understand</span><span aria-hidden="true">→</span><span><b>3</b> Ask</span><span aria-hidden="true">→</span><span><b>4</b> Explore deeper</span></div></section>
      )}

      <details className={styles.advancedDetails}>
        <summary>Saved work &amp; advanced import</summary>
        <div className={styles.advancedBody}>
          <div className={styles.advancedIntro}><div><span className={styles.stepLabel}>Portable utility</span><h2>Saved explorations</h2></div><label className={styles.fileButton}>Import Projectr package<input type="file" accept=".json,application/json" onChange={importProjectrPackage} disabled={loading} /></label></div>
          {savedExplorations.length > 0 ? (
            <div className={styles.savedList}>{savedExplorations.map((item) => (
              <article className={styles.savedItem} key={item.id}><div><strong>{item.source.title ?? item.source.sourceId}</strong><p>{item.segmentCount} moments · {item.topicCount} topics · {item.conceptCount} concepts</p><small>Saved {formatSavedAt(item.savedAt)}</small></div><div className={styles.savedActions}><button type="button" onClick={() => loadSaved(item.id)}>Load</button><button type="button" onClick={() => exportSaved(item.id)}>Export</button><button type="button" className={styles.removeButton} onClick={() => removeSaved(item.id)}>Remove</button></div></article>
            ))}</div>
          ) : <p className={styles.emptySaved}>No saved explorations yet. Run the demo, then save it to smoke-test local persistence.</p>}
          <div className={styles.provenanceNote}><strong>Portable by design.</strong><span>Source, transcript, topics, concepts, and provider standing remain inside the Projectr artifact. Hosted answering stays behind its existing optional provider boundary.</span></div>
        </div>
      </details>

      <footer className={styles.footer}><span>Projectr</span><p>Source → evidence → structure → answer</p></footer>
    </main>
  );
}
