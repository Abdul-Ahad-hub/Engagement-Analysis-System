# Engagement Analysis System (Core Engine)

Domain-agnostic microservice that calculates human engagement from a stream of 16-frame (`160x160` RGB) capture windows and 52 normalized facial landmarks.

This engine is completely independent of any specific application domain (such as Google Meet, Zoom, or user authentication) and only operates on `(sessionId, windowIndex)` capture streams.

## Core Endpoints

- `POST /engagement/frames` — Validate a 16-frame + 52-landmark capture window, run AI inference (unless skipped by business rules), and buffer the result in Redis.
- `POST /engagement/sessions` — Flush buffered windows for `sessionId` to PostgreSQL and compute aggregate session engagement metrics (`windowsStored`, `windowsInferred`, `avgEngagementScore`, `dominantLabel`).
- `GET /engagement/sessions/:sessionId` — Retrieve the session summary and ordered window records for `sessionId`.
- `POST /engagement/sessions/:sessionId/flush` — Explicitly flush buffered windows for `sessionId` to PostgreSQL.
- `GET /health` — Service reachability check.
