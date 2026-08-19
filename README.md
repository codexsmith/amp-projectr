# Projectr / YouTube Knowledge Explorer

Projectr turns long-form video into searchable, navigable, structured knowledge while preserving a path back to the source.

The current repository began as an AWS Amplify Gen2 + Next.js starter. The Projectr core is intentionally being built independently of that starter infrastructure.

## Architecture rule

> The product model must not be owned by its implementation language, UI framework, cloud provider, database, or AI provider.

Portable JSON contracts live in `contracts/projectr`. Executable domain logic lives in `core/projectr` and currently has no dependency on Next.js, React, Amplify, AWS, a database client, an AI SDK, or a transcript library.

See `ARCHITECTURE.md` for the dependency rule and adapter strategy.

## Current vertical slice

Implemented core behavior:

- parse and canonicalize supported YouTube video URLs;
- normalize timestamped transcript cues;
- search transcript segments and preserve timestamps;
- derive a deterministic time-window outline with keywords;
- generate timestamp links back to YouTube;
- abstract transcript acquisition behind `TranscriptProvider`;
- expose the flow through a thin Next.js UI.

The UI currently uses `DemoTranscriptProvider`, a fixture-backed adapter. This is deliberate: it closes and tests the product core before selecting a live YouTube transcript dependency.

## Run

```bash
npm install
npm run dev
```

Then open the local Next.js URL and paste a supported YouTube video URL. The first slice validates the URL and runs the fixture transcript through the real Projectr normalization, search, outline, and timestamp-navigation core.

## Core tests

```bash
npm run test:core
```

The core test command uses only the repository's existing TypeScript dependency and Node. It does not add a testing framework.

## Next adapter task

Implement the first live `TranscriptProvider` without changing the core domain model. Candidate provider approaches should be evaluated for:

- legal/terms compatibility;
- transcript availability and language handling;
- stability;
- authentication/API requirements;
- failure behavior;
- ability to return timestamped cues without downloading/re-encoding video.

Provider-specific response objects must terminate at the adapter boundary and be converted to `TranscriptCue[]`.
