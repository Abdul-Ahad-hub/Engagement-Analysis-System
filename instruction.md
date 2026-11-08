# Engagement Inference Implementation Instructions

## Project focus

Cloud inference is the primary product path and the main focus of implementation. The Chrome extension sends captured 16-frame windows to the NestJS backend, and the backend forwards cloud-routed windows to the Smart Meet AI service. Keep this end-to-end cloud path aligned with the implementation guide and make it production-ready.

## Local inference must be preserved

The browser-side ONNX/TCN local inference exists to satisfy the research paper requirement. Do not remove, disable permanently, or replace its code, model weights, or supporting assets as part of cloud-inference work. It is a research feature that must remain available until the paper requirement is fulfilled and its removal is explicitly planned.

## Work in parallel

Complete the cloud-inference implementation while preserving the local research path. Cloud work and local preservation are concurrent requirements: do not postpone cloud implementation until after the paper, and do not delete local inference to simplify the cloud implementation.

When changing shared extension/backend contracts, maintain compatibility with the preserved local-result path (`/engagement/onlyresult`) and any research-required routing/configuration. Keep cloud prediction records identifiable by source/model so research outputs and cloud outputs are not silently confused or overwritten.

## Before changing behavior

1. Read the extension capture/routing code, backend routes/services/storage, and the AI implementation guide together.
2. Keep the extension as the camera/window producer and NestJS as the authenticated ingestion and persistence boundary.
3. Implement cloud inference using the AI route that matches the extension's sampled-window payload; do not switch to whole-video upload without an explicit product decision.
4. Preserve the local TCN implementation and research assets while cloud behavior is built and verified.
5. Record architecture and behavior decisions in `DECISIONS.md`, including any source precedence, retry, and persistence rules.

## Lifecycle note

Local inference may be considered for removal only after the research paper requirement is complete and a separate cleanup decision is recorded. Until then, cloud is the active product focus and local inference remains a supported research path.
