# Engagement Analysis System (Core Engine)

Domain-agnostic microservice that calculates human engagement from a stream of 16-frame (`160x160` RGB) capture windows and 52 normalized facial landmarks.

This engine is completely independent of any specific application domain (such as Google Meet, Zoom, or user authentication) and only operates on `(sessionId, windowIndex)` capture streams.

## Core Endpoints

- `POST /engagement/frames` — Validate a 16-frame + 52-landmark capture window, run AI inference (synchronously or via async callback), and buffer/persist the result.
- `POST /engagement/onlylandmarks` — Run TCN landmark-only inference for a 16-frame landmark window.
- `POST /engagement/onlyresult` — Persist a pre-computed local inference result for `(sessionId, windowIndex)`.
- `POST /engagement/video` & `POST /engagement/video-landmarks` — Synchronous video proxy routes to the AI model server.
- `POST /engagement/ai-callbacks/received` & `POST /engagement/ai-callbacks/results` — Authenticated callbacks for async AI inference.
- `POST /engagement/sessions` — Flush buffered windows for `sessionId` to PostgreSQL and compute aggregate session engagement metrics.
- `GET /engagement/sessions/:sessionId` — Retrieve the session summary and ordered window records for `sessionId`.
- `POST /engagement/sessions/:sessionId/flush` — Explicitly flush buffered windows for `sessionId` to PostgreSQL.
- `GET /health` — Service reachability check.
