# Vision Analyser Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing visual analysis card to the exported Custom Vision Docker analyser.

**Architecture:** Add a server-side Next API route that posts the fixed demo claim image to the analyser and maps Custom Vision predictions into the app's existing `VisionResult` contract. Keep the browser unaware of Docker networking and use `VISION_ANALYSER_URL` for environment-specific endpoint selection.

**Tech Stack:** Next.js App Router, TypeScript, React client component, Docker Compose, Node built-in test runner.

---

### Task 1: Add Mapping Contract

**Files:**
- Create: `tests/vision-analyser.test.mjs`
- Create: `lib/vision-analyser.ts`

- [ ] **Step 1: Write the failing test**

Create a Node test that transpiles `lib/vision-analyser.ts` and asserts that the highest Custom Vision prediction maps to `VisionResult`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vision-analyser.test.mjs`
Expected: FAIL because `lib/vision-analyser.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `mapCustomVisionResponse()` with severity and confidence mappings for `minor`, `moderate`, and `severe`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/vision-analyser.test.mjs`
Expected: PASS.

### Task 2: Add API Route

**Files:**
- Create: `app/api/vision/analyze/route.ts`
- Modify: `lib/vision-analyser.ts`

- [ ] **Step 1: Add server analyser call**

Implement `analyzeClaimPhoto()` to read the selected dossier image from `data/raw/data3a`, build multipart form data, and post it to `VISION_ANALYSER_URL`.

- [ ] **Step 2: Add route**

Implement `POST /api/vision/analyze` and return 502 JSON on analyser failures.

### Task 3: Connect Client and Docker

**Files:**
- Modify: `components/claims-workspace.tsx`
- Add: `docker-compose.yml`
- Modify: `README.md`

- [ ] **Step 1: Replace visual mock call**

Change `runVision()` to call `/api/vision/analyze`.

- [ ] **Step 2: Add compose wiring**

Add `app` and `vision-analyser` services with `VISION_ANALYSER_URL=http://vision-analyser/image`.

- [ ] **Step 3: Document startup**

Document `docker compose up --build` and the direct analyser probe.

### Task 4: Verify

**Files:**
- No new files.

- [ ] **Step 1: Run mapper test**

Run: `node --test tests/vision-analyser.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Probe analyser and API route**

Run analyser `curl` against `http://127.0.0.1:8080/image`, then run Next locally and `curl -X POST http://127.0.0.1:3000/api/vision/analyze`.
Expected: both return JSON and the API result has `severity` and `confidence`.
