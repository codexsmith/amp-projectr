# Projectr / YouTube Knowledge Explorer

Projectr turns long-form video into searchable, navigable, structured knowledge while preserving a path back to the source.

The current repository began as an AWS Amplify Gen2 + Next.js starter. The Projectr core is intentionally being built independently of that starter infrastructure.

## Architecture rule

> The product model must not be owned by its implementation language, UI framework, cloud provider, database, or AI provider.

Portable JSON contracts live in `contracts/projectr`. Executable domain logic lives in `core/projectr` and has no dependency on Next.js, React, Amplify, AWS, a database client, an AI SDK, or a transcript library.

See `ARCHITECTURE.md` for the dependency rule and adapter strategy.

## Current vertical slice

Implemented behavior:

- parse and canonicalize supported YouTube video URLs;
- normalize timestamped transcript cues;
- search transcript segments and preserve timestamps;
- derive a deterministic time-window outline with keywords;
- generate timestamp links back to YouTube;
- abstract transcript acquisition behind `TranscriptProvider`;
- use the official YouTube Data API captions endpoints for videos the authenticated account is authorized to manage;
- import VTT/SRT caption material through a local adapter;
- retain the fixture provider for development and deterministic testing;
- expose all three acquisition paths through a thin Next.js UI.

## Transcript acquisition

Projectr deliberately does not scrape the YouTube watch page.

The official YouTube captions API requires OAuth. Listing caption tracks requires authorization, and downloading a caption track through the official API requires sufficient permission for that video. For that reason the official adapter is best suited to creator-owned or otherwise authorized videos, not arbitrary public-video transcript extraction.

Configure the server route with:

```bash
PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN=...
```

The token should include the YouTube `youtube.force-ssl` scope and belong to an account authorized for the target video's captions.

For other lawful transcript sources, paste the YouTube URL for provenance/timestamp links and import a `.vtt` or `.srt` caption file. The imported cues enter the same Projectr normalization/search/outline pipeline.

## Run

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test:core
```

The test command uses the repository's existing TypeScript dependency and Node. It covers the portable core plus transcript adapters without adding a testing framework.

## Adapter boundary

Provider-specific response objects terminate at `adapters/transcripts` and are converted to `TranscriptCue[]`. The core only sees the `TranscriptProvider` contract and portable domain types.

Future transcript integrations can therefore be added or replaced without changing the Projectr knowledge model.
