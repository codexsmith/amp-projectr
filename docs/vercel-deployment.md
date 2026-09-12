# Projectr — Vercel deployment

Projectr is deployed as a native Next.js application on Vercel. The portable Projectr core and contracts remain independent of the hosting platform.

## Deployment model

Vercel should build the repository with the standard Next.js build:

```bash
npm ci
npm run build
```

Do not use the `scripts/build.mjs` static projection created for the Sites Run 001 publishing experiment. That projection omits the server route-handler surface used by the optional hosted providers.

The canonical Vercel application includes:

- the client-side deterministic Projectr demo and exploration workflow;
- `POST /api/answer` for optional hosted evidence-bound synthesis;
- `POST /api/metadata` for optional YouTube metadata enrichment;
- `POST /api/transcript` for optional authorized YouTube caption acquisition;
- browser-local persistence and Projectr package import/export.

The built-in demo requires no provider credentials and should remain fully usable when every server-side provider variable is absent.

## Environment variables

Optional hosted answering:

```text
OPENAI_API_KEY
PROJECTR_OPENAI_MODEL
```

Optional YouTube metadata:

```text
PROJECTR_YOUTUBE_API_KEY
```

Optional authorized YouTube metadata/captions:

```text
PROJECTR_YOUTUBE_OAUTH_ACCESS_TOKEN
```

Secrets must remain server-side. Do not expose these values with `NEXT_PUBLIC_*` names.

## Vercel project settings

Use the repository root as the Root Directory and allow Vercel to detect the Next.js framework. No custom Output Directory is required.

Recommended production branch after the migration is accepted: the repository's canonical product branch (ultimately `main`). Preview deployments should be used for `deploy/vercel-port` and subsequent pull requests before promotion.

## Migration standing

The repository originated from an AWS Amplify Gen2 starter, but Projectr's product model does not depend on Amplify or AWS. The first Vercel migration deliberately leaves the old Amplify packages and files in place until the native Vercel build and Run 001 acceptance checks are green. They are migration residue, not part of the Projectr architecture.

After Vercel verification, a separate cleanup may remove:

- `amplify/`;
- `amplify.yml`;
- unused `aws-amplify` / `@aws-amplify/*` dependencies;
- obsolete starter assets;
- the Sites-only static build script if it is no longer needed as an alternate publishing target.

Keeping cleanup separate makes the hosting migration itself an explicit portability test: the same Projectr domain and application behavior should execute under a different hosting provider without changing the product contracts.
