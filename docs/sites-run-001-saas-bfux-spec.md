# Projectr / YouTube Knowledge Explorer — Sites Run 001 SaaS BFUX Specification

**Status:** run-ready specification  
**Date:** 2026-09-12  
**Run:** Sites Run 001  
**Preparation branch:** `sites/run-001-saas-bfux`  
**Implementation baseline:** `portable-youtube-explorer-core`  
**Product:** Projectr / YouTube Knowledge Explorer  
**Run class:** presentation / interaction / responsive-product pass  
**External content acquisition:** prohibited for Run 001

## 1. Purpose

This is the first supervised run of the Sites workflow against an existing Boundary First Labs product implementation.

The run is intentionally bounded. It is not a product-discovery exercise, a research exercise, a content-ingestion exercise, or an invitation to redesign Projectr's domain model.

The goal is to test whether the Sites workflow can take an already substantial executable product and translate it into a mainstream, highly legible SaaS interface while preserving the product's existing evidence, provenance, portability, and interaction boundaries.

The desired result can be summarized as:

> **Fisher-Price BFUX:** simple without being simplistic, obvious without being patronizing, calm without hiding power, and capable of revealing deeper structure only when the user asks for it.

The governing interaction maxim is:

> **Tell me what you're gonna tell me. Tell me. Tell me what you told me.**

Operationally:

> **Hint → Action → Consequence**

Every meaningful interactive surface should orient the user, expose one obvious primary operation, and make the result of that operation immediately visible.

## 2. Sources of authority

Run 001 should use the following authority order.

### A. Projectr product and implementation authority

Repository: `codexsmith/amp-projectr`  
Baseline branch: `portable-youtube-explorer-core`

The existing portable Projectr contracts and executable core are authoritative for product semantics. The UI must adapt to them rather than silently replacing them.

Current capabilities already include:

- YouTube URL parsing;
- optional source metadata;
- timestamped transcript normalization;
- deterministic outline generation;
- deterministic concept enrichment;
- transcript and concept-linked search;
- evidence-bound answering;
- timestamp navigation;
- VTT/SRT import;
- browser-local persistence;
- Projectr package import/export;
- hosted OpenAI answering behind the same bounded answer port;
- deterministic fallback behavior and fixture-driven tests.

### B. BFUX interaction authority

Canonical Lab source:

`boundary-first-labs/organized_library_curated/999_Library/03_Domains/03_engineered_systems__domain_family/01_software_engineering__domain/01_boundary_first_ux__product/HINT_ACTION_CONSEQUENCE.md`

Companion review instrument:

`HAC_REVIEW_CHECKLIST.md`

The implementation should preserve the broader BFUX principle that renderer and responsive projection do not own semantic truth. Desktop and mobile are alternate projections of one product state, not separate products.

### C. Wireframe authority

The design session on 2026-09-12 produced three successful light-SaaS mockup directions. Run 001 uses their common grammar rather than treating any generated image as pixel-perfect implementation authority.

The canonical synthesis is:

- **Wireframe C — Numbered journey:** primary information architecture.
- **Wireframe B — Guided demo:** primary demo and tool-card grammar.
- **Wireframe A — Clean SaaS dashboard:** visual polish, spacing, and compact information treatment.

The implementation should reproduce the semantic layout and interaction rhythm, not mechanically copy generated-image artifacts.

## 3. What Run 001 is testing

The run should answer a small set of questions.

1. Can Sites read an existing product rather than inventing one?
2. Can it obey an explicit no-research / no-content-gathering boundary?
3. Can it produce a visually mainstream SaaS surface while preserving BFUX interaction semantics?
4. Can it turn a dense expert prototype into a progressive, self-teaching user journey?
5. Can it preserve Projectr's source → evidence → structure → navigation → answer chain without exposing every internal mechanism at once?
6. Can it produce a responsive mobile projection that preserves the same sequence and consequences?
7. Can it leave the portable domain core intact while substantially changing the presentation layer?

A beautiful page that breaks these constraints is a failed run.

## 4. Content and quota boundary

### Hard rule

> **Do not gather external content for Run 001.**

The run must not spend quota or time on content discovery.

Do not:

- search the web for videos;
- call YouTube for demo content;
- scrape YouTube pages;
- fetch live captions for the demonstration;
- use the YouTube Data API to populate the demonstration;
- browse for stock photography;
- research competitors for product copy;
- generate a content corpus;
- add a recommendation feed;
- require an LLM to make the demo work.

The existing repository and the deterministic Projectr fixture are sufficient.

Live provider-backed capability may remain represented as a secondary product path, but Run 001 verification must not invoke it.

## 5. Demo-first execution rule

The first successful path through the application must require no external setup.

A first-time visitor should be able to select **Run demo** and immediately receive a populated Projectr exploration built from the existing deterministic fixture.

The demo path must require:

- no account;
- no API key;
- no OAuth;
- no live metadata request;
- no live caption request;
- no model provider.

If the current UI requires a YouTube URL before invoking `DemoTranscriptProvider`, adapt the application layer so demo mode supplies a local fixture source identity and metadata.

Do not weaken or broaden the portable Projectr contracts solely for demo convenience.

Demo mode should be visibly identified as fixture/demo content. Broken or fictitious outbound YouTube navigation should not be shown as if it were a real source link.

## 6. Product proposition

Primary title:

# Projectr

Secondary label:

**YouTube Knowledge Explorer**

Primary proposition:

> **Turn a long video into navigable knowledge.**

Supporting copy may use the existing product language:

> Start with the source. Preserve timestamps. Search evidence, inspect concepts, and ask questions whose claims stay bound to the transcript.

Avoid generic AI-product language such as:

- unlock the power of AI;
- chat with any video;
- revolutionize learning;
- AI-powered insights;
- your intelligent content copilot.

Projectr's differentiators are structure, source integrity, timestamp navigation, portable artifacts, progressive exploration, and evidence-bound answers.

## 7. Canonical user journey

The primary interface should read as one simple journey.

### 1 — Choose a video

**Hint:** Choose a video to explore. Use the built-in demo or provide a source.  
**Primary action:** Run demo.  
**Secondary action:** Paste a YouTube URL.  
**Consequence:** A source exploration loads and the product visibly reports what became available.  
**Next:** Watch / inspect the source.

The demo should be the safest and most prominent first-run action.

### 2 — Watch the source

**Hint:** This is the source whose evidence Projectr is organizing.  
**Action:** Play / scrub / choose a timestamp where meaningful in the current source mode.  
**Consequence:** The active timestamp and transcript context update together.  
**Next:** Inspect transcript evidence or key takeaways.

For fixture mode, a simulated source/timeline treatment is acceptable. Do not imply external playback occurred if it did not.

### 3 — Understand

Public label may be **Key takeaways**, **Explore the outline**, or another plain-language equivalent.

**Hint:** Here is the structure Projectr derived from this source.  
**Action:** Select a topic or concept.  
**Consequence:** Related evidence becomes visible and the current exploration state updates.  
**Next:** Inspect the evidence or ask a question.

Default content should favor a compact summary of sections and concepts, not a graph.

### 4 — Ask a question

**Hint:** Ask from the evidence available in this source.  
**Action:** Enter a question or use a prepared example.  
**Consequence:** An evidence-bound answer appears with timestamped supporting segments.  
**Next:** Jump into the cited evidence.

The deterministic answerer must be sufficient for Run 001 verification. Hosted synthesis is optional infrastructure and must not be required for the primary experience.

### 5 — Explore deeper

**Hint:** Choose how you want to go deeper.  
**Action:** Search transcript, browse concepts, or view outline.  
**Consequence:** The selected focused instrument opens with current context preserved.  
**Next:** Continue exploring, save, or export.

This is where capability density belongs. Advanced functions should not compete with the first four steps on initial load.

## 8. Primary desktop composition

The generated wireframes converge on the following desktop structure.

```text
+------------------------------------------------------------------+
| Projectr                         Turn a long video into ...        |
| YouTube Knowledge Explorer                       Save / Export     |
+------------------------------------------------------------------+
| 1  CHOOSE A VIDEO TO EXPLORE                                    |
|    [ Run demo ]   [ Paste YouTube URL....................... ]   |
+--------------------------------------+---------------------------+
| 2  WATCH THE SOURCE                  | 3  KEY TAKEAWAYS          |
|                                      |    topics / concepts       |
|     source / fixture preview         |                           |
|     active timestamp                 +---------------------------+
|                                      | 4  ASK A QUESTION         |
|                                      |    [ question......... ]   |
+--------------------------------------+---------------------------+
| Transcript / Key Moments / Concepts / Outline                    |
| focused evidence list with timestamp actions                     |
+--------------------------------------+---------------------------+
| 5  EXPLORE DEEPER                   | Save / Export consequence  |
| Search transcript · Concepts · Outline                           |
+------------------------------------------------------------------+
```

The exact grid may vary. The semantic ordering may not.

## 9. Mobile projection

Mobile must become one ordered reading and action flow rather than a compressed dashboard.

Recommended order:

1. product identity / proposition;
2. Run demo / source choice;
3. source card;
4. transcript search / key moments;
5. concepts / outline;
6. evidence-bound answer;
7. save / export.

The mobile version should preserve:

- the same active source;
- the same selected concept/topic;
- the same evidence references;
- the same answer standing;
- timestamp continuity;
- large touch targets;
- clear primary actions.

Do not introduce mobile-only semantics or hide provenance merely to shorten the page.

## 10. Visual language — SaaS BFUX

### Required character

The first run should feel:

- mainstream;
- modern;
- friendly;
- calm;
- spacious;
- confident;
- scalable;
- easy to learn without instruction.

### Visual defaults

Prefer:

- light / near-white application background;
- dark navy or near-black typography;
- generous whitespace;
- large readable headings;
- rounded cards and controls;
- subtle borders and soft elevation;
- simple BFUX-compatible glyphs;
- large input and button targets;
- functional pastel accent fields;
- short hint text directly under headings;
- clear selected / loaded / success states.

Functional accent families may distinguish local roles, for example:

- blue — source / primary operation / navigation;
- green — loaded / operative / exploration success;
- amber — takeaways / insight / structure;
- purple — question / answer;
- pink or red — search emphasis only when useful.

Color is supplementary. Meaning must remain legible without it.

### Explicit rejection

Do not make the default UI:

- a dark command center;
- a dense research workbench;
- an observability dashboard;
- a neon knowledge graph;
- an instrument cluster full of simultaneous micro-panels;
- a wall of developer terminology;
- a graph-first product;
- a generic chat application.

Earlier dense BFUX mockups were useful exploration but are not the SaaS target for Run 001.

## 11. Progressive disclosure

Projectr already has more capability than the first screen should show.

The run should preserve capability while decreasing simultaneous cognitive load.

### First layer

- run demo / choose source;
- source identity;
- simple takeaways;
- ask;
- explore deeper.

### Second layer

- transcript search;
- key moments;
- concepts;
- outline;
- evidence references;
- save/export.

### Third layer / advanced

- VTT/SRT import;
- package import;
- provider details;
- live authorized caption acquisition;
- metadata-provider state;
- hosted-answer provider state;
- detailed provenance / interchange diagnostics.

These capabilities should remain reachable, but they should not occupy equal visual weight with Run demo.

## 12. Hint / Action / Consequence contract

Every major interactive surface in Run 001 must be reviewable with this tuple.

| Surface | Hint | Primary action | Visible consequence | Next |
| --- | --- | --- | --- | --- |
| Source choice | Choose a video to explore | Run demo / submit URL | Source is loaded and exploration capabilities appear | Watch / inspect |
| Source | This is the evidence source | Select time / play where supported | Active time and transcript context change | Inspect evidence |
| Transcript search | Find moments and ideas in the source | Search | Matching timestamped segments and count appear | Jump / inspect |
| Takeaways | Main structure derived from the source | Select topic/concept | Related evidence becomes current | Ask / inspect |
| Ask | Ask from this source's evidence | Submit question | Evidence-bound answer + cited moments appear | Jump to evidence |
| Explore deeper | Choose a deeper view | Search / concepts / outline | Focused instrument opens with context retained | Continue exploration |
| Save | Keep this exploration | Save | Local saved state is visibly confirmed | Reload/export |
| Export | Take the portable artifact with you | Export package | File/export confirmation is visible | External use |

A surface with an absent Hint, Action, or Consequence should not be polished around; it should be redesigned.

## 13. State and consequence requirements

The UI should make these state changes explicit where applicable:

- source selected;
- demo content loaded;
- transcript ready;
- search query active;
- result count;
- selected concept/topic;
- answer generated;
- evidence count;
- active timestamp;
- saved state;
- exported state;
- insufficient evidence;
- unavailable provider.

Avoid generic toast-only feedback for consequential actions. The changed state should be visible in the relevant surface.

## 14. Architecture constraints

The existing architecture rule remains authoritative:

> The product model must not be owned by its implementation language, UI framework, cloud provider, database, or AI provider.

Run 001 should primarily change application/UI code and styling.

Do not:

- merge adapter-specific types into core contracts;
- make OpenAI a required Projectr primitive;
- make AWS/Amplify semantics part of the product model;
- replace portable Projectr artifacts with UI state objects;
- make Corpus Forge a Projectr dependency;
- introduce a vector database to support this UI pass;
- create new domain abstractions solely to mirror card layout.

Prefer no new dependencies unless a concrete UI requirement cannot reasonably be met with the existing stack.

## 15. Existing behavior to preserve

The first run must not regress:

- URL parsing;
- transcript normalization;
- deterministic outline generation;
- deterministic concept enrichment and retrieval;
- evidence admissibility checks;
- deterministic evidence-bound answering;
- hosted answer boundary when configured;
- caption file import;
- local persistence;
- Projectr package import/export;
- portable schemas and tests.

## 16. Implementation cut line

The smallest successful Sites Run 001 is:

```text
existing portable Projectr core
+ no-network one-click demo
+ light SaaS BFUX shell
+ Choose → Watch → Understand → Ask → Explore deeper journey
+ transcript search with timestamped results
+ compact concepts/outline treatment
+ deterministic evidence-bound answer
+ visible consequences
+ save/export retained
+ coherent mobile projection
```

Anything beyond this is optional extension.

## 17. Deliberate non-goals

Do not spend Run 001 on:

- external content ingestion;
- creator/channel libraries;
- recommendations;
- user accounts;
- social features;
- collaboration;
- cross-video synthesis;
- embeddings/vector retrieval;
- arbitrary knowledge graphs;
- a new backend;
- Corpus Forge integration;
- marketing-site expansion;
- pricing/billing;
- generalized design-system extraction;
- exhaustive BFUX doctrine exposition;
- a full rebuild of the Projectr core.

## 18. Verification

### Core verification

Run and preserve:

```bash
npm run test:core
```

Run the application build appropriate to the current repository state.

The Sites workflow should report any baseline/environment failure separately from failures introduced by the UI pass.

### Interaction verification

Verify at minimum:

1. clean load with no configured provider keys;
2. Run demo performs no external content request;
3. fixture exploration becomes visible;
4. transcript search returns deterministic fixture evidence;
5. selecting an evidence/timestamp changes the visible current context;
6. selecting a concept/topic exposes related evidence;
7. deterministic answer path returns an admissible evidence-bound result for a supported fixture question;
8. insufficient-evidence behavior remains legible;
9. save/load remains functional;
10. export remains functional.

### Responsive verification

Inspect at least:

- wide desktop;
- intermediate/tablet width;
- narrow mobile width.

The narrow version must be an ordered product journey, not a horizontally shrunken dashboard.

### Accessibility verification

Check:

- keyboard reachability;
- visible focus state;
- labels for icon controls;
- form labels and error association;
- touch-target size;
- meaning not encoded only in color;
- usable reduced-motion behavior where motion exists.

## 19. BFUX acceptance gate

Run the major surfaces through Hint / Action / Consequence review.

No major surface may score `0` on Hint, Action, or Consequence.

Target overall review posture:

- purpose recognizable within seconds;
- one dominant action per local surface;
- consequence visible near the action;
- next step apparent from the result;
- advanced capability progressively disclosed.

The run should be rejected or repaired if it becomes visually impressive but operationally ambiguous.

## 20. Definition of done

Sites Run 001 is successful when a first-time visitor can, without setup or external content acquisition:

1. understand that Projectr turns long video into navigable, timestamped knowledge;
2. run the built-in fixture in one obvious action;
3. see that a source has become transcript evidence, structure, and searchable concepts/topics;
4. search the transcript and receive timestamped results;
5. select a concept/topic and see a visible consequence;
6. ask a question and receive an evidence-bound answer or explicit insufficient-evidence state;
7. move from an answer/result back to supporting evidence;
8. preserve the exploration through existing save/export behavior;
9. repeat the same conceptual journey on mobile;
10. do all of the above without modifying the portable product model or requiring YouTube/OpenAI/provider configuration.

The run is especially successful if the interface feels obvious enough that a user never needs to know the phrase **Hint / Action / Consequence** because the grammar is already visible in the product.

## 21. Run instruction for Sites

Use this specification and the existing repository as the complete content source for Run 001.

> **Do not research what Projectr should be. Projectr already exists.**
>
> **Do not gather content. Use the deterministic fixture.**
>
> **Do not redesign the portable core. Re-project it through a simpler interface.**
>
> **Build the smallest complete user journey first.**
>
> **Show what an action changed.**

When uncertain, prefer the interpretation that preserves existing product semantics while reducing simultaneous cognitive load.