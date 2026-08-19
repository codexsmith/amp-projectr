"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import styles from "./page.module.css";
import {
  DemoTranscriptProvider,
  deriveOutline,
  normalizeTranscript,
  parseYouTubeUrl,
  searchTranscript,
  youtubeTimestampUrl,
  type KnowledgeMap,
  type SourceVideo,
  type TranscriptSegment,
} from "@/core/projectr";

const transcriptProvider = new DemoTranscriptProvider();

function formatTimestamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceVideo | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hits = useMemo(
    () => searchTranscript(segments, query),
    [segments, query],
  );

  async function explore(): Promise<void> {
    setError(null);
    setLoading(true);

    try {
      const parsed = parseYouTubeUrl(url);
      const cues = await transcriptProvider.getTranscript(parsed);
      const normalized = normalizeTranscript(parsed.sourceId, cues);
      const map = deriveOutline(parsed.sourceId, normalized);

      setSource(parsed);
      setSegments(normalized);
      setKnowledgeMap(map);
      setQuery("");
    } catch (caught) {
      setSource(null);
      setSegments([]);
      setKnowledgeMap(null);
      setError(caught instanceof Error ? caught.message : "Unable to explore this source.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Projectr / YouTube Knowledge Explorer</p>
          <h1>Turn a long video into navigable knowledge.</h1>
          <p className={styles.lede}>
            Start with the source. Preserve timestamps. Search the transcript. Build a deterministic outline before adding AI enrichment.
          </p>
        </div>
        <span className={styles.prototypeBadge}>Core prototype</span>
      </header>

      <section className={styles.ingest} aria-labelledby="ingest-heading">
        <div>
          <h2 id="ingest-heading">Explore a YouTube source</h2>
          <p>
            This slice validates the portable Projectr core. It currently uses a fixture transcript behind a replaceable provider interface.
          </p>
        </div>
        <div className={styles.ingestControls}>
          <label className={styles.inputLabel} htmlFor="youtube-url">YouTube URL</label>
          <div className={styles.inputRow}>
            <input
              id="youtube-url"
              value={url}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              inputMode="url"
              autoComplete="off"
            />
            <button type="button" onClick={explore} disabled={loading}>
              {loading ? "Loading..." : "Explore"}
            </button>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </section>

      {source && knowledgeMap ? (
        <>
          <section className={styles.sourceBar} aria-label="Loaded source">
            <div>
              <span className={styles.statusDot} aria-hidden="true" />
              <strong>Source loaded:</strong> {source.sourceId}
            </div>
            <div className={styles.fixtureNotice}>Fixture transcript / live adapter pending</div>
          </section>

          <section className={styles.workspace}>
            <aside className={styles.outlinePanel} aria-labelledby="outline-heading">
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.panelKicker}>Knowledge map</p>
                  <h2 id="outline-heading">Deterministic outline</h2>
                </div>
                <span>{knowledgeMap.topics.length} sections</span>
              </div>

              <ol className={styles.topicList}>
                {knowledgeMap.topics.map((topic) => (
                  <li key={topic.id}>
                    <a
                      href={youtubeTimestampUrl(source, topic.startSeconds)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className={styles.timestamp}>{formatTimestamp(topic.startSeconds)}</span>
                      <span>
                        <strong>{topic.title}</strong>
                        <small>{topic.keywords.join(" · ")}</small>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </aside>

            <section className={styles.transcriptPanel} aria-labelledby="transcript-heading">
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.panelKicker}>Source transcript</p>
                  <h2 id="transcript-heading">Search and jump</h2>
                </div>
                <span>{segments.length} segments</span>
              </div>

              <label className={styles.searchLabel} htmlFor="transcript-search">Search transcript</label>
              <input
                id="transcript-search"
                className={styles.searchInput}
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                placeholder="Try: source, transcript, provider..."
              />

              <div className={styles.segmentList}>
                {(query ? hits : segments).map((item) => {
                  const startSeconds = item.startSeconds;
                  const key = "segmentId" in item ? item.segmentId : item.id;
                  return (
                    <article className={styles.segment} key={key}>
                      <a
                        className={styles.timestampLink}
                        href={youtubeTimestampUrl(source, startSeconds)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {formatTimestamp(startSeconds)}
                      </a>
                      <p>{item.text}</p>
                    </article>
                  );
                })}
                {query && hits.length === 0 ? (
                  <p className={styles.empty}>No matching transcript segments.</p>
                ) : null}
              </div>
            </section>
          </section>
        </>
      ) : (
        <section className={styles.emptyState}>
          <div>
            <p className={styles.panelKicker}>First vertical slice</p>
            <h2>The framework is the shell, not the product.</h2>
          </div>
          <ul>
            <li>Portable JSON contracts</li>
            <li>Pure URL and transcript transformations</li>
            <li>Replaceable transcript provider</li>
            <li>No AI, database, or cloud dependency in the core</li>
          </ul>
        </section>
      )}
    </main>
  );
}
