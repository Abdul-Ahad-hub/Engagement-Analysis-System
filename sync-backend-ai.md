# Synchronous Backend ↔ AI Service Integration Guide

This guide defines the synchronous mapping between inference input types on the NestJS backend and their matching AI service routes. The route mapping is based on input shape: video, video plus landmarks, separate frames, or landmarks only. No model-selection decision is made here. Browser-side local inference remains preserved separately for the research-paper requirement.

## System boundary

```text
Chrome Extension
  └─ JSON + Google bearer token → NestJS backend (/engagement/*)
       ├─ validates, identifies, deduplicates, buffers, persists
       └─ synchronous internal HTTP request → Smart Meet AI service (/predict/*)
```

The extension should call NestJS, not the AI service directly. NestJS owns extension authentication, validation, session/window identity, persistence, and result reporting. The AI service receives only inference inputs and returns predictions.

## Endpoint mapping

| NestJS backend endpoint | Purpose | AI service endpoint | Current relation |
|---|---|---|---|
| `POST /engagement/frames` | Main inference for supplied individual frames (current extension window contract) | `POST /predict/frames` | Existing synchronous mapping via `HttpModelClient.predict()` and `MODEL_URL` |
| `POST /engagement/video` | Inference from an uploaded video without caller landmarks | `POST /predict/video` | Implemented synchronous proxy |
| `POST /engagement/video-landmarks` | Inference from an uploaded video plus landmarks aligned to its sampled frames | `POST /predict/video-landmarks` | Implemented synchronous proxy |
| `POST /engagement/onlylandmarks` | Inference from landmarks only | `POST /predict/tcn-landmarks` | Synchronous mapping; adapter sends only accepted `landmarks` property |
| `POST /engagement/onlyresult` | Persist a prediction already made by extension's local ONNX model | None | Backend-only persistence; must not invoke AI a second time |
| `POST /engagement/sessions` | Flush and save aggregate session summary | None | Backend-only persistence/aggregation |
| `GET /engagement/sessions/:sessionId` | Read saved session and window records | None | Backend-only read |
| `POST /engagement/sessions/:sessionId/flush` | Flush temporary window buffer to Postgres | None | Backend-only persistence operation |
| NestJS `GET /health` | Backend reachability and configured AI route flags | None | Public backend health route; does not call AI or verify its live availability |
| AI `GET /health` | AI server status and main model queue/batch info | None | Separate AI health endpoint; NestJS health does not proxy it |
| AI `POST /predict/video` | Analyze uploaded video | NestJS `POST /engagement/video` | Synchronous proxy |
| AI `POST /predict/video-landmarks` | Analyze video plus caller landmarks aligned to server sampling | NestJS `POST /engagement/video-landmarks` | Synchronous proxy |

## Synchronous inference route mappings

The backend inference routes should preserve the same input type when forwarding to AI. They should not silently turn a video request into a frames request or a video-plus-landmarks request into landmarks-only inference.

### Video only: `/engagement/video` → `/predict/video`

The NestJS route accepts multipart form-data containing a required `video` file and optional JSON-string `meta` object. It synchronously forwards the video and metadata to AI `/predict/video` and returns the normalized prediction. Uploaded files are capped at 200 MiB.

### Video plus landmarks: `/engagement/video-landmarks` → `/predict/video-landmarks`

The NestJS route accepts multipart form-data containing required `video`, required NumPy `.npy` `landmarks`, and optional JSON-string `meta`. It forwards both files and metadata to AI `/predict/video-landmarks` synchronously and returns the normalized prediction. Uploaded files are capped at 200 MiB each. Landmark rows must correspond exactly to the frames AI samples from the video.

Both video proxy routes return the normalized `ModelPredictionResult` directly and currently do not create engagement records or session summaries. Their request metadata is passed through to the AI service. Callers needing durable results should use the existing window/session persistence contract or add a deliberate video-result persistence contract.

### Separate frames: `/engagement/frames` → `/predict/frames` (existing)

This is the current extension flow. It receives JSON with separate frame objects and landmarks, then converts the frame objects to repeated PNG multipart fields and the landmarks to `.npy` before synchronously calling `/predict/frames`.

### Landmarks only: `/engagement/onlylandmarks` → `/predict/tcn-landmarks` (existing)

This route receives the extension's landmarks window, validates its metadata and shape, then synchronously sends only `{ "landmarks": [...] }` as JSON to the TCN AI route. The backend retains request metadata for saving the result. The adapter sends only that accepted property.

All four mappings are synchronous: NestJS waits for AI's prediction response and returns the result to its caller. Configure the corresponding `MODEL_*_URL` values and keep AI `RESULT_URL` unset for this flow. Callback mode is outside this simple mapping.

## Main cloud path: `/engagement/frames` → `/predict/frames`

### 1. Extension → NestJS request

The extension submits one sampled window as JSON to `POST /engagement/frames` (typically once per capture window):

- 16 frame objects, each containing base64 raw RGB bytes, shape `[160,160,3]`, and capture metadata;
- `landmarks` with shape `[16][52][3]`;
- `faceDetected` with 16 booleans;
- `sessionId`, `meetingId`, `windowIndex`, timestamps and capture timing;
- `landmarkIndices`, `landmarkCount`, and optional user details.

The NestJS global validation pipe validates/whitelists the DTO. The Google auth guard accepts an optional bearer token and, when present, verifies it and replaces client-provided email/user ID with verified values. The frame service checks the Redis temporary window cache for a duplicate. It skips model execution if there are fewer than 8 useful frames or fewer than 8 face frames; otherwise it calls the model client.

### 2. NestJS → AI request

`HttpModelClient.predict()` converts the backend `ModelInput` to multipart form-data for `MODEL_URL` (or legacy alias `MODEL_ENDPOINT_URL`):

| AI multipart field | Backend conversion |
|---|---|
| repeated `frames` | Each base64 160×160 RGB frame is converted to a PNG named `frame_00.png` through `frame_15.png` |
| `landmarks` | `[16][52][3]` numbers encoded as NumPy v1.0 little-endian float32 `.npy` |
| `meta` | JSON with `sessionId`, `meetingId`, `windowIndex`, `userEmail`, `partial`, `framesFilled`, `frameIntervalMs`, `startedAt`, `endedAt` |

The request goes to the AI service's `/predict/frames` route. Do not set a manual multipart `Content-Type` boundary; `fetch` builds it from `FormData`. The current client adds an ngrok warning-bypass header and applies `MODEL_TIMEOUT_MS` (default 30 seconds).

### 3. AI → NestJS result

In synchronous mode (`RESULT_URL` unset), AI returns a one-item JSON array. An example item includes metadata plus `engagement_Level` and `confidence`. `HttpModelClient.parse()` unwraps the first array item and maps recognized label/score aliases into:

```ts
{
  engagementScore: number | null,
  engagementLabel: string,
  raw: unknown
}
```

The backend stores `engagementScore` and `engagementLabel` in an `EngagementResultDto`, buffers it by session in Redis, and may flush the record to Postgres after 10 windows. Explicit flush or session save also writes the buffer. The extension receives the backend's immediate response from `/engagement/frames`, including `ok`, `duplicate`, and the window result. The AI service does not write to the backend database.

### Main path settings

```env
MODEL_URL=http://<ai-host>:8000/predict/frames
MODEL_TIMEOUT_MS=30000
```

Use an AI host reachable from the NestJS runtime. `localhost` only works if both services share the same host/network namespace. The AI guide's `HOST`/`PORT` configure its listener; NestJS `PORT` is a separate setting.

## Landmark-only path: `/engagement/onlylandmarks` → `/predict/tcn-landmarks`

`POST /engagement/onlylandmarks` is called by the extension when its local ONNX weights cannot be used. It carries session/window metadata, face flags, landmark indices, and `[16][52][3]` landmarks. NestJS validates the window and calls `HttpModelClient.predictLandmarks()` using `MODEL_LANDMARKS_URL`.

The AI guide specifies `/predict/tcn-landmarks` as synchronous JSON and says **only** the `landmarks` property is accepted. Its valid body is:

```json
{"landmarks": [[[0.1, 0.2, 0.0]] /* exactly 16 × 52 × 3 values in total */]}
```

The backend adapter sends only `{ landmarks: input.landmarks }` to `/predict/tcn-landmarks`; it retains metadata on the NestJS side for persistence. Configure:

```env
MODEL_LANDMARKS_URL=http://<ai-host>:8000/predict/tcn-landmarks
```

The guide says TCN returns `classIndex`, `label`, `engagement_Level`, `confidence`, `probs`, and `logits`. `parse()` recognizes `label`/`engagement_Level` and `confidence`; it currently discards normalized class index/probabilities from the typed result, though raw response can be saved. Confirm intended score semantics: main model `confidence` and TCN top-class probability may not represent the same calibrated engagement score.

## Backend-only routes

These endpoints do not synchronize to an AI route:

- `POST /engagement/onlyresult` stores a result produced on-device by the extension's ONNX TCN. It uses `source: "local"`, stable `resultId`, and stores the richer prediction object. It should stay independent of cloud model calls.
- `POST /engagement/sessions` flushes buffered records, calculates summary values, then upserts the session. It does not ask AI to infer anything.
- `GET /engagement/sessions/:sessionId` reads a session and its persisted records.
- `POST /engagement/sessions/:sessionId/flush` writes the temporary Redis buffer to Postgres.

The extension probes the NestJS base URL plus `/health`. NestJS health returns `ok`, service name, synchronous mode, and booleans indicating which model route URLs are configured. This is a cheap backend reachability/configuration check; it does not connect to AI and does not validate database or Redis health. AI `/health` is a separate endpoint for AI process/model queue status.

## Synchronous operation and error behavior

1. Extension sends the window and waits on NestJS.
2. NestJS validates input, applies duplicate/skip rules, then waits for AI inference.
3. AI responds directly to the NestJS HTTP request.
4. NestJS parses and buffers the result, then returns a result to the extension.

Expected behavior from the AI guide: invalid model input gives 422; a full main-model queue gives 503; synchronous model timeout gives 504; unexpected inference failure gives 500. The backend maps non-2xx AI responses to `ModelInferenceException`. The extension may retry failed uploads, so backend and model operations should remain idempotent by `(sessionId, windowIndex)` and avoid creating a second logical window on retries.

Set the backend timeout longer than the AI's worst expected inference time, but below the caller/hosting request limit. Current backend default is 30 seconds. If this limit is insufficient, asynchronous AI callbacks require a separate durable job lifecycle; setting AI `RESULT_URL` alone is not supported by the current backend client, because it expects the prediction in the original response.

## Async callback mode: not currently wired

When AI `RESULT_URL` is set, main routes return `202 {job_id,status:"accepted"}` and later call `RESULT_URL`; optional `RECEIVED_URL` receives acceptance. Current `HttpModelClient` expects a prediction immediately and would try to parse the acceptance object as a prediction, failing. No backend callback controller currently receives `RECEIVED_URL` or `RESULT_URL`, persists AI job IDs, or maps them back to an extension window.

Therefore leave `RESULT_URL` unset for the current synchronous integration. To adopt async later, implement a durable mapping from AI `job_id` to `(sessionId, windowIndex)`, accepted/completed/error states, authenticated callback endpoints, idempotent retries/upserts, and a way for the extension/session report to observe pending completion. AI `job_id` does not replace the extension's window identity.

## AI route mapping notes

- `/predict/video` and `/predict/video-landmarks` accept video uploads. The current extension does not record/upload video; it samples 16 discrete frames per window. The backend video routes support callers supplying video but do not change extension capture behavior.
- `/predict/frames` without landmarks is possible per the AI guide, but this backend already supplies landmarks, avoiding duplicate MediaPipe extraction. Keep the supplied-landmarks option unless the model pipeline is intentionally changed.
- `/predict/tcn-landmarks` is not equivalent to the main image-plus-landmark model. Use it only when the intended TCN model and class semantics are explicitly selected.

## Contract checks before enabling cloud inference

- Point `MODEL_URL` at the AI `/predict/frames` URL and keep `RESULT_URL` unset for synchronous calls.
- Confirm the AI multipart route accepts PNG files in repeated `frames` parts and a NumPy `.npy` landmarks part shaped `(16,52,3)`.
- Confirm AI uses supplied landmarks and does not require a different landmark order/normalization than the extension's 52-point order.
- Confirm `engagement_Level` is a class index or label and interpret `confidence` consistently. Preserve full raw output if later analysis needs probabilities/logits.
- Configure each backend model URL to its corresponding AI endpoint; video routes are optional when unused.
- Keep cloud predictions distinguishable from local results (`source`, model/version). During research-mode `auto`, one window can receive both a local output and a later successful cloud retry; persistence/reporting must not silently choose based on arrival order.
- Use NestJS `/health` to check backend reachability/configuration and AI `/health` separately to check the model service.

## Related files

- AI contract: `E:\Smart-Meet System\Smart-Meet-Ai\implementationguide.md`
- Backend controller: `src/endpoints/FramesController.ts`
- Backend business flow: `src/services/FramesService.ts`
- AI transport/format conversion: `src/services/HttpModelClient.ts`
- Backend request DTOs: `src/dtos/FrameDTO.ts`, `src/dtos/OnlyLandmarksDto.ts`, `src/dtos/OnlyResultDto.ts`, `src/dtos/SessionSummaryDto.ts`
- Architecture decisions and status: `DECISIONS.md`
- Extension producer and route policy: `E:\Smart-Meet System\Extension\Smart-Meet-Session-Recorder\offscreen.js`, `background.js`, and `config.js`
