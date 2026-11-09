# Engagement analysis architecture and decision log

This document records the end-to-end design across the Chrome extension, NestJS backend, and Smart Meet AI service. Update the decision log as choices are made; retain superseded entries with dates.

**Status:** Architecture reviewed across all three components. Product direction is now clarified: cloud-only is the current product behavior; local inference is retained temporarily for the research paper and is planned for removal after publication. The extension's checked-in config currently says `MODE: "auto"`, so implementation/config alignment remains outstanding. NestJS now supports opt-in async callback inference for `/engagement/frames`; synchronous remains the default.

## System context: who captures and sends data?

The Chrome extension is the live data producer. Its offscreen page acquires camera frames, runs MediaPipe Face Mesh on each full frame, selects 52 landmarks, and creates 160×160 RGB face crops for cloud windows. It captures 16 frames over about 10 seconds, followed by a 20 second break by default. It does not record or upload a full video or audio.

The extension currently contains three routing modes. Its checked-in `config.js` default is `MODE: "auto"`: at each window's start it may choose cloud or local inference based on connectivity, and a failed cloud upload can be locally answered while the image window remains queued for retry. `MODE: "cloud"` sends every window to NestJS for cloud inference. `MODE: "local"` runs its bundled ONNX TCN in the browser. The product direction clarified for this project is cloud-only now. The local mode and auto/local fallback are being retained temporarily to satisfy the research paper requirement; they are not the intended current product route and are planned to be removed after the paper is published. The extension posts a session summary on Save and keeps its own local session record.

NestJS is the system's ingestion, authentication, idempotency, buffering, and durable persistence layer. The AI service is a model-serving dependency; it is not the caller-facing extension API. The existing backend accepts extension JSON at `/engagement/frames`, then `HttpModelClient` adapts it to multipart form-data for the AI service. Thus the implementation guide's multipart APIs should not be called directly by the extension without intentionally bypassing backend responsibilities.

## Current behavior by component

### Extension (implementation snapshot and intended current operation)

- **Cloud-only intended current operation:** sends every 16-frame JSON window containing raw RGB frame bytes as base64, landmarks `[16][52][3]`, face flags, timing, session/window IDs, and account metadata to NestJS for cloud inference.
- **Local window/fallback:** runs ONNX TCN on device; sends a result to `/engagement/onlyresult` with a stable `resultId` of `sessionId:windowIndex`, and retries failed delivery from extension storage.
- **Weights missing:** sends landmarks window to `/engagement/onlylandmarks`.
- **Research-only transitional behavior:** `MODE: "local"` and `MODE: "auto"` remain in the extension for research-paper requirements. In `auto` with `RETRY_FAILED_UPLOADS: true`, it can post a local result and later retry the same window's cloud upload. That can create two model outputs for one `(sessionId, windowIndex)`. This is a transition-mode concern, not a reason to keep adaptive routing as the target product architecture.

### NestJS backend

- `/engagement/frames`: validates the extension JSON window, checks for duplicates, and calls `MODEL_URL`. Synchronous mode buffers results as before; opt-in async mode durably stores a pending record before submission and updates it through authenticated AI callbacks.
- `/engagement/onlyresult`: persists an extension-side prediction directly to Postgres, deduplicated on `(sessionId, windowIndex)`; `resultId` is also unique when present.
- `/engagement/onlylandmarks`: calls `MODEL_LANDMARKS_URL` synchronously and persists its result directly to Postgres.
- `/engagement/sessions`: flushes buffered records, computes summary statistics from persisted records, and saves the session summary.
- `/engagement/sessions/:id/flush` and `GET /engagement/sessions/:id`: manual flush and report retrieval.

Synchronous mode expects the main-model output inline. Async frame mode accepts the AI job response, stores durable `pending`/`inferred`/`failed` record states in Postgres, and authenticates callback routes using a shared bearer token. Redis remains a temporary buffer for synchronous window records, not a durable job queue.

### Smart Meet AI service (implementation guide)

- `/predict/frames`: accepts a repeated `frames` multipart field, optional/supplied NumPy landmarks, and `meta`; suitable for individual windows already sampled by the extension.
- `/predict/video`: accepts video and samples frames on the AI service.
- `/predict/video-landmarks`: accepts video plus landmarks aligned to the server-sampled frames.
- `/predict/tcn-landmarks`: accepts exactly 16×52×3 landmarks as JSON, uses x/y, and returns synchronously.
- The three main routes respond synchronously if `RESULT_URL` is unset. When set, they return `202` and later POST results to `RESULT_URL`, optionally notifying `RECEIVED_URL`. The TCN route is always synchronous.

## Architectural choices and tradeoffs

### 1. Cloud-only product flow through the backend (current direction)

Every window is sent from the extension to NestJS; NestJS remains the sole authenticated extension-facing API and adapts windows to AI `/predict/frames`, passing supplied landmarks. No local inference fallback is used in the current product flow. Keep the existing local/auto code temporarily for the paper requirement, then remove it in a planned post-publication change. Main-model calls stay synchronous initially.

- **Benefits:** Matches the live window producer and 16-frame shape; one authoritative cloud model/result per window; avoids sending a whole meeting video; preserves backend authentication, validation, and persistence; no duplicate MediaPipe pass on the model service.
- **Costs:** Cloud requests include ~1.6 MB JSON and backend multipart conversion; internet/service availability affects inference; synchronous inference ties up the request path and depends on timeout behavior.
- **Implementation note:** `config.js` currently defaults to `MODE: "auto"`. The intended cloud-only runtime requires setting/using the cloud path, but do not remove local inference until the paper publication requirement is fulfilled. After publication, remove local mode, auto routing/fallback, browser model assets/code, and local-only result paths only after checking whether any research records or endpoint compatibility still depend on them.

### 2. Local inference retained temporarily for the research paper

Keep the browser ONNX TCN and any required local/auto paths available during the paper period. This is a transitional research requirement; it is not the current cloud-only product behavior.

- **Benefits:** Preserves reproducibility and implementation evidence required by the paper; avoids prematurely deleting work needed for research.
- **Costs:** Transitional code/config complexity remains; `auto` can mix model sources and create competing results; local inference should not be mistaken for the supported current product route.
- **Exit:** Remove after publication in a separately tracked cleanup decision/change. Do not remove it now.

### 3. Use browser TCN as primary and cloud only as fallback or audit (not current product direction)

The extension runs the bundled ONNX model for every window, optionally uploading results or some windows to the cloud.

- **Benefits:** Fast response, offline capable, no face crops needed for the primary output, consistent local model for each session.
- **Costs:** Model and weights ship to clients and require version rollout; client performance varies; backend cannot independently reproduce predictions unless landmarks are also retained; cloud audit introduces duplicate-result policy.
- **Fit:** A deliberate privacy/offline-first model strategy, not merely a network workaround.

### 4. Use AI `/predict/tcn-landmarks` for fallback when browser weights are absent (transitional contingency)

The existing `/engagement/onlylandmarks` route already represents this fallback: NestJS sends the 16×52 landmarks to `MODEL_LANDMARKS_URL` and waits for a result. Confirm that URL points to the guide's TCN route and that class/confidence semantics match the local ONNX implementation.

- **Benefits:** Small payload; no face crops transmitted; works when extension weights cannot load; reuses existing route shape.
- **Costs:** Still requires connectivity; same TCN family may be redundant with browser inference; quality and outputs must be calibrated against main model; currently no retry queue for failed landmarks calls.
- **Fit:** A contingency path, not necessarily a second primary cloud model.

### 5. Switch to whole-video analysis

Upload a video to `/predict/video` or `/predict/video-landmarks` and let AI sample it.

- **Benefits:** AI service owns sampling and can analyze a full continuous recording in one request.
- **Costs:** Conflicts with current product behavior (short camera windows separated by breaks); requires video recording/storage, larger and more sensitive uploads, new session/window mapping, and a change to the extension's privacy/data lifecycle. Caller-supplied landmark alignment is especially brittle if the service samples frames independently.
- **Fit:** Consider only if product changes from live rolling-window analysis to post-call video analysis. The current extension explicitly does not upload video/audio.

### 6. Synchronous versus callback inference

**Synchronous** is compatible with the current NestJS model client: one request returns one prediction and can enter the current buffer. It is simple but the live request waits for inference.

**Callback mode** can free the request path: AI returns `202` with `job_id`, then posts accepted/completed events. But this requires NestJS to persist a job keyed to extension `(sessionId, windowIndex)`, return/track a pending state, accept authenticated and retried callbacks idempotently, reconcile errors/timeouts, and expose completion to the session report/UI. The present Redis result buffer and direct `onlyresult` insert do not constitute that lifecycle. AI callback `job_id` is not a substitute for the extension's stable window identity.

**Assessment:** Synchronous remains the default. Async callback mode is implemented as an opt-in for frame windows; enable it only after configuring the AI callback URLs and shared token.

## Recommended target architecture (proposal, not selected)

1. Preserve the extension's 16-frame window contract. Current product route is cloud-only; do not move capture or routing into the AI service.
2. Keep NestJS as the one public ingestion boundary. It authenticates the extension, validates IDs/shapes, assigns an explicit prediction source, and adapts cloud frames/landmarks to AI `/predict/frames`.
3. Retain the extension's local TCN temporarily for research-paper requirements, but do not rely on it as a product fallback while operating cloud-only. After publication, remove it through a planned cleanup.
4. Keep `/engagement/onlylandmarks` only if the research period requires server-side TCN when browser weights are unavailable; confirm whether that remains needed. It is not part of the cloud-only main-model path.
5. Keep synchronous main-model calls initially. Introduce callbacks only alongside durable job records, callback authentication, retry-safe upserts, observable status, and UI/report handling for pending/failed jobs.
6. Continue avoiding whole-video uploads unless the product explicitly changes its collection and privacy model.

The recommendation deliberately separates **routing policy** (extension chooses a prediction route per window) from **inference transport** (NestJS sends cloud windows to AI) and **result policy** (which source is canonical and how multiple model outputs are retained). The current system has routing and inference transport, but result precedence is under-specified.

## Decision log

| Date | Topic | Status / decision | Rationale and next action |
|---|---|---|---|
| 2026-11-08 | Data ownership | Confirmed current architecture | Extension captures and sends sampled windows; NestJS is the public ingestion/persistence layer; AI service performs inference. |
| 2026-11-08 | Live input contract | Recommended: retain 16-frame windows | Matches current capture and model guide frame count. Do not use whole-video routes without a product change. |
| 2026-11-08 | Cloud model route | Pending selection; recommendation `/predict/frames` with supplied landmarks | Closest match to extension window payload and existing adapter. |
| 2026-11-08 | Product inference route | Decided: cloud-only current operation | Every current product window should go to cloud through NestJS. Checked-in extension config still defaults to `auto`; align configuration/operation separately. |
| 2026-11-08 | Local inference lifecycle | Decided: retain temporarily, remove after paper publication | Local inference is a research-paper requirement, not the intended current product route. Do not remove it now; track post-publication cleanup. |
| 2026-11-08 | Result precedence/storage | Open for transitional research modes | Cloud-only operation has one intended source. The `auto` mode can still create local plus later cloud outputs for one window; define handling if/when that mode is used during research. |
| 2026-11-08 | TCN fallback | Pending endpoint/model confirmation | Existing browser TCN and `/onlylandmarks` fallback exist; verify model/version and class semantics. |
| 2026-11-08 | Delivery mode | Recommended synchronous initially; not selected | Compatible with current `HttpModelClient`. Async needs durable job lifecycle and callback receiver. |
| 2026-11-09 | Async frame callbacks | Implemented, opt-in (`MODEL_ASYNC=true`) | Pending records are persisted before AI submission; authenticated idempotent callbacks update the same `(sessionId, windowIndex)` record. Sync remains the default. |
| 2026-11-08 | Video endpoints | Not selected | Incompatible with current extension's no-video rolling-window collection without a product/data-lifecycle change. |

## Decisions required before implementation

- Which AI model is the intended canonical cloud model: main image-plus-landmark model or landmarks-only TCN?
- Should AI inference remain synchronous, or is there a concrete latency/throughput target that requires callbacks?
- Which model/version, class names, confidence meaning, and error/skip semantics must be persisted and shown?

The cloud-only product direction and temporary research retention of local inference are decided. Align the extension's runtime configuration with cloud-only operation as an implementation step, while leaving research code/assets intact until publication. Record any future model/API and async choices here, then implement and record verification results.
