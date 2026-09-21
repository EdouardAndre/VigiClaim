# VigiClaim

> An AI-assisted demo for triaging motor-insurance claims from damage photos, claim signals, and transparent business rules.

VigiClaim is a French-language proof of concept for claims handlers. It brings three complementary signals into one workspace:

- **Computer vision** estimates damage severity from a claim photo using an exported Azure Custom Vision model.
- **Fraud scoring** presents explainable, claim-specific risk signals. It is intentionally mocked in the current MVP.
- **Investigation agent** combines the two signals with simple business rules and proposes a next action through a local Semantic Kernel + Ollama service.

This is a demonstration project, not a production claims-decisioning system. It does not make payments or final coverage decisions.

## What is implemented

- Responsive Next.js 16 operations dashboard with four demo claims
- Local, containerised TensorFlow Lite vision inference for an edge-style demo
- Optional server-side Azure Custom Vision Prediction integration
- Deterministic, explainable mock fraud results
- FastAPI investigation service using Semantic Kernel, Ollama, and tool calls
- Evaluation scripts and saved validation metrics for the exported vision model

## Architecture

```text
Browser
  │
  ├─ POST /api/vision/analyze ──► Next.js server ──► Local TFLite container
  │                                                  or Azure Custom Vision
  │
  ├─ Mock fraud score (deterministic demo data)
  │
  └─ POST /api/agent/investigate ─► FastAPI agent ─► Ollama + business rules
```

The browser never receives the Azure prediction key. The Azure integration is optional; the Docker vision service is the default provider.

## Quick start: full demo with Docker

Prerequisites: Docker Desktop and [Ollama](https://ollama.com/).

```bash
ollama serve
ollama pull qwen3.5:9b
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The app, vision service, and agent service listen on ports `3000`, `8080`, and `8000` respectively.

To stop the stack:

```bash
docker compose down
```

## Local development

Install the web dependencies and start the Next.js app:

```bash
npm ci
npm run dev
```

The interface loads without the supporting services, but running visual analysis requires the vision container. Running an agent recommendation also requires the FastAPI agent and Ollama.

Start the vision service:

```bash
docker build -t vigiclaim-vision ./customvision-docker
docker run --rm -p 8080:80 vigiclaim-vision
```

Start the agent in another terminal:

```bash
cd agent
python -m pip install -r requirements.txt
uvicorn investigator:app --host 0.0.0.0 --port 8000
```

Then start Next.js with local service URLs:

```bash
VISION_DOCKER_URL=http://127.0.0.1:8080/image AGENT_SERVICE_URL=http://127.0.0.1:8000/investigate npm run dev
```

## Optional Azure Custom Vision provider

Copy the safe template, then replace the placeholders in your local file only:

```bash
cp .env.example .env.local
```

Select **Azure online** in the Computer Vision card. Keep these variables server-only; do not use the `NEXT_PUBLIC_` prefix.

## Validation and checks

```bash
node --test tests/vision-analyser.test.mjs
npm run lint
npm run build
```

The exported Docker model was evaluated on 248 validation images. The saved top-label evaluation reports **70.2% accuracy** and **67.6% macro F1**; the `moderate` class is the weakest (F1: 46.0%). See [reports/customvision-validation-metrics.json](reports/customvision-validation-metrics.json).

To re-evaluate a running vision container:

```bash
python scripts/evaluate_custom_vision_docker.py
```

## Data and model notes

- The source-only repository intentionally excludes `data/`, `public/images/`, and the exported `customvision-docker/app/model.tflite` artefact. Supply your own rights-cleared assets before running the complete demo.
- The local dataset used during development is the [Car Damage Severity Dataset](https://www.kaggle.com/datasets/prajwalbhamere/car-damage-severity-dataset), published under **CC BY-NC-SA 4.0** and described by its uploader as scraped from multiple sources. Use `scripts/setup-data.sh --kaggle` only if its terms fit your intended use.
- Treat any dataset and exported model as non-commercial / attribution-sensitive unless you have confirmed otherwise. The fraud outcomes in the UI are hand-tuned mocks, not the output of a trained fraud model.

## Repository map

```text
app/                         Next.js pages and server API routes
components/                  Claims dashboard UI
lib/                         Demo claims, mock scoring, vision integration
agent/                       FastAPI + Semantic Kernel investigation service
customvision-docker/         Exported Custom Vision TFLite inference container
data/                        Local third-party images (intentionally untracked)
scripts/                     Dataset setup, model training, and evaluation
reports/                     Saved model metrics and per-image predictions
tests/                       Focused Node test for vision mapping and demo claims
docs/                        Design notes and implementation plans
PROJECT_REVIEW_BRIEF.md      Evaluator-ready project context
```

## Limits and intended use

VigiClaim is for portfolio, learning, and demo use only. A production version would need authenticated APIs, persistent claim data, a trained and monitored fraud model, formal evaluation and fairness controls, human approval workflows, audit logging, and a security review.
