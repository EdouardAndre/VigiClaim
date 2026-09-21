# VigiClaim — LLM Review Brief

Use this document when asking another LLM to assess the repository for a specific role. Attach the repository as well when possible: this brief is an accurate map of the project, not a replacement for source review.

## Copy/paste assignment

```text
You are assessing VigiClaim for the role of [TARGET ROLE].

Use the attached repository and PROJECT_REVIEW_BRIEF.md as evidence. Evaluate it as a portfolio / interview project, not as a production insurance platform.

Give:
1. A role-specific overall assessment and score out of 10.
2. Evidence-backed strengths, tied to concrete files or implementation choices.
3. Gaps that matter for this role, ranked by importance.
4. The three highest-leverage improvements the candidate should make before presenting it.
5. Interview questions a hiring manager is likely to ask, with the evidence the candidate should be ready to explain.

Separate demonstrated capability from mocked, planned, or unverified capability. Do not infer production readiness from the UI alone.
```

## One-paragraph summary

VigiClaim is a French-language, full-stack proof of concept for motor-insurance claim triage. A claims handler can select one of four demo cases, run an image through a real exported Azure Custom Vision / TensorFlow Lite classifier, view a deterministic mock fraud score, and request a recommendation from a locally hosted Semantic Kernel + Ollama investigation agent. The project demonstrates cohesive product UI, server-side integration, Docker composition, an edge-style inference path, and basic model evaluation. It is deliberately incomplete as a production system: there is no persistence, authentication, real fraud model, ML operations, audit trail, or formal decision-governance layer.

## Product workflow

1. The React interface displays a claim queue and an active dossier, including a damage photo and structured claim metadata.
2. The user chooses a vision provider: the local Docker model by default, or Azure Custom Vision when configured.
3. `POST /api/vision/analyze` reads the selected local image server-side and returns the highest-probability severity label plus confidence.
4. The fraud card returns a hand-authored result keyed to the selected claim ID. It is not a trained model.
5. Once the vision and fraud cards succeed, `POST /api/agent/investigate` forwards both results and the selected claim to a FastAPI service.
6. The agent uses local Ollama via Semantic Kernel, calls a Wikipedia lookup tool, estimates a repair cost using deterministic rules, and returns an `approve`, `manual_review`, or `investigate_fraud` reference decision. The Next.js route maps that decision to French UI language and suggested actions.

## Technology and architecture

| Layer | Implementation | Evidence |
| --- | --- | --- |
| Web UI | Next.js 16, React 19, TypeScript, Tailwind-related styling, Phosphor icons | `app/`, `components/claims-workspace.tsx` |
| Server bridge | Next.js App Router API routes | `app/api/vision/analyze/route.ts`, `app/api/agent/investigate/route.ts` |
| Vision | Exported Azure Custom Vision TensorFlow Lite model, served by Flask | `customvision-docker/` |
| Optional cloud vision | Server-side Azure Custom Vision Prediction REST call | `lib/vision-analyser.ts` |
| Fraud | Deterministic mocked claim-level outputs | `lib/mock-services.ts` |
| Agent | FastAPI, Semantic Kernel, Ollama, MCP fetch plugin | `agent/investigator.py` |
| Containers | Three-service Docker Compose stack | `docker-compose.yml` |
| Evaluation | Python HTTP evaluator with saved JSON/CSV reports | `scripts/evaluate_custom_vision_docker.py`, `reports/` |
| Tests | Node built-in test runner, TypeScript transpiled in test | `tests/vision-analyser.test.mjs` |

## What is genuinely implemented

- A polished, responsive single-page claims workspace with a queue, claim selection, navigation states, service states, loading states, and error states.
- Four hard-coded demo claims linked to local damage images and structured insurance-like records.
- A real server-side call to the local TFLite model; the integration maps Custom Vision predictions to the UI contract and has focused tests.
- A real optional Azure Custom Vision HTTP integration. The prediction key is read server-side from environment variables and is not exposed to the browser.
- A Docker Compose workflow that starts the web app, vision container, and agent container. Ollama intentionally runs on the host machine.
- A FastAPI agent endpoint with a per-process async lock, deterministic reference decision rules, and a local LLM/tool-call flow.
- A reproducible script that evaluates the model against a labelled validation split and writes metrics plus per-image predictions.

## Verification at handoff time

- `node --test tests/vision-analyser.test.mjs` passed: 3 tests, 0 failures.
- `npm run lint` passed after adding the repository's ESLint 9 flat configuration.
- `npm run build` passed with Next.js 16.2.9. The app has one static route and three dynamic API routes.
- Docker Compose, the vision container, the FastAPI agent, and Ollama were not started for this documentation review; their end-to-end interaction remains to be verified in a local runtime.

## What is mocked, constrained, or incomplete

- The fraud score is entirely mocked and hand-tuned per claim. There is no trained fraud classifier, feature pipeline, or calibration.
- Claim data is hard-coded demo data. There is no database, upload workflow, identity management, or real insurer integration.
- Only one image is rendered per claim even though the UI displays a higher photo count. Claim documents, filters, search, settings, and new-claim creation are UI-only.
- The agent's `vehicle_lookup` is a Wikipedia search, not a vehicle valuation source. Repair estimates are a three-value in-memory lookup.
- The app does not make a final decision, but the agent can recommend freezing compensation. There is no explicit human approval / override workflow or audit trail.
- The project does not include CI, deployment infrastructure, observability, API authentication, rate limiting, or end-to-end tests.
- Python dependencies in `agent/requirements.txt` are unpinned.

## Data, model, and evaluation

- The development working copy contains 1,631 vehicle-damage images (about 17 MB) from the Kaggle Car Damage Severity Dataset; the public source-only repository intentionally excludes `data/`, the exported model, and public image assets pending rights confirmation.
- The source dataset is CC BY-NC-SA 4.0 and its uploader says the images were scraped from multiple sources. This is a licensing and provenance concern for public or commercial reuse.
- The exported TFLite model is about 2.5 MB and has three labels: `minor`, `moderate`, and `severe`.
- `reports/customvision-validation-metrics.json` covers 248 validation images: 70.2% top-label accuracy, 67.6% macro F1, 68.6% weighted F1. The moderate class has 46.0% F1, materially below minor (80.2%) and severe (76.7%).
- A separate historical multiclass report exists at `reports/customvision-validation-metrics-multiclass.json` and is weaker (63.7% accuracy, 61.0% macro F1). An evaluator should ask which model/configuration is the intended baseline and why both reports remain.
- No data split provenance, training experiment tracking, threshold selection, confidence calibration, bias analysis, or model card is included.

## API and trust boundaries

| Interface | Purpose | Current limitation |
| --- | --- | --- |
| `POST /api/vision/analyze` | Runs selected claim image through local or Azure vision | No caller auth; accepts only known demo claim IDs |
| `GET /api/claims/[claimId]/photo` | Serves a known local demo image | No caller auth; safe path resolution is indirect through claim lookup |
| `POST /api/agent/investigate` | Sends claim + vision + fraud signals to FastAPI | No caller auth, rate limit, schema-depth validation, or audit log |
| `POST :8080/image` | Vision inference endpoint | Published host port in Compose; intended for local demo |
| `POST :8080/url` | Exported model fetches and classifies a provided URL | Potential SSRF risk if exposed beyond a trusted local environment |
| `POST :8000/investigate` | Agent service | Published host port and unauthenticated; intended for local demo |

## Repository map

```text
app/
  layout.tsx                         Application metadata and French locale
  page.tsx                           Renders the claims workspace
  api/vision/analyze/route.ts        Vision bridge endpoint
  api/agent/investigate/route.ts     Agent bridge endpoint
  api/claims/[claimId]/photo/route.ts Demo-image endpoint
components/
  claims-workspace.tsx               Main UI and all client interactions
lib/
  demo-claims.ts                     Four typed demo claim records
  mock-services.ts                   Mock fraud outputs and UI contracts
  vision-analyser.ts                 Local/Azure vision calls and mapping
agent/
  investigator.py                    FastAPI agent, tools, and decision rules
  requirements.txt                   Python dependencies
customvision-docker/
  app/model.tflite                   Exported inference model
  app/app.py, predict.py             Flask serving and preprocessing
data/raw/data3a/                     Third-party train/validation images
scripts/
  setup-data.sh                      Dataset download helper
  train_custom_vision_severity.py    Custom Vision training/export utility
  evaluate_custom_vision_docker.py   HTTP model evaluator
reports/                             Stored metrics and prediction CSVs
tests/vision-analyser.test.mjs       Three focused Node tests
docs/superpowers/                    Design decisions and implementation plans
Dockerfile, docker-compose.yml       Build and local orchestration
```

## Quality signals to weigh

### Strengths

- Coherent end-to-end product story rather than disconnected experiments: photo -> severity -> fraud signal -> recommendation.
- Server-side handling of the optional Azure prediction key.
- Dockerized local inference and an explicit edge-demo path, which makes the demo runnable without cloud access for vision.
- A custom evaluation script and saved metrics, including per-class results rather than a single headline accuracy number.
- Typed TypeScript contracts around claim, vision, fraud, and agent results.
- Clear separation between the Next.js API façade, vision implementation, UI, and agent service.
- The UI honestly labels the fraud signal as mock in the service-health section and project description, although that distinction should remain prominent everywhere.

### Material gaps

- Domain validity: the vision model's moderate-damage performance is weak, and the fraud model is not real.
- Production safety: no auth, logs, data-retention policy, encryption, access control, abuse protection, or deployment boundary.
- Decision governance: no model card, decision thresholds, human override, appeal process, auditability, or fairness evaluation despite an insurance-fraud use case.
- Test depth: only mapping and demo-record tests; no route, container, agent, UI, or end-to-end coverage.
- Reproducibility: agent dependencies are unpinned; model and data provenance are incomplete.
- Asset rights: third-party dataset and public images need licensing/provenance review before public or commercial use.

## How to calibrate the review by role

| Target role | What should matter most |
| --- | --- |
| Frontend / product engineer | UI quality, interaction design, state management, accessibility, component structure, error UX, responsiveness |
| Full-stack engineer | API boundaries, service composition, input validation, auth gaps, testability, reliability, repository hygiene |
| ML engineer | Dataset lineage, evaluation design, class-level metrics, model lifecycle, data splits, reproducibility, calibration, monitoring |
| MLOps / platform engineer | Containers, repeatable environments, dependency pinning, CI/CD, secrets, deployment topology, observability, model packaging |
| AI / LLM engineer | Agent/tool design, prompt constraints, tool-call reliability, agent evaluation, guardrails, decision traceability |
| Product / data analyst | Problem framing, demo realism, explanation design, operational workflow, measurable success criteria, limitations |
| Security engineer | Secret handling, public service exposure, SSRF endpoint, auth, image upload controls, dependency supply chain, logging/privacy |

## Candidate talking points

- Be explicit that VigiClaim is a **demonstrator**, not a production fraud-detection platform.
- Explain why the vision call stays server-side and why environment variables are not prefixed `NEXT_PUBLIC_`.
- Discuss the poor moderate-damage F1 and how you would improve the dataset, labels, thresholding, and evaluation before using the model operationally.
- Explain the fraud card as a UX and integration placeholder, not a trained model.
- Explain the edge demo: the exported TFLite model runs in a local Flask container rather than requiring Azure at inference time.
- Acknowledge the security, privacy, licensing, and governance work needed for an actual insurer deployment.
