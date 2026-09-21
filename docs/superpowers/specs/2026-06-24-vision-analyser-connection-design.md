# Vision Analyser Connection Design

## Goal

Connect the VigiClaim demo app to the exported Custom Vision Docker analyser so the visual analysis card uses a real model response for the active claim photo.

## Architecture

The browser calls a Next.js API route at `/api/vision/analyze`. The route runs server-side, reads the selected dossier image from `data/raw/data3a`, posts it to the Custom Vision Docker endpoint, maps the response into the existing severity-only `VisionResult` UI contract, and returns JSON to the client.

The analyser endpoint is configured with `VISION_ANALYSER_URL`, defaulting to `http://127.0.0.1:8080/image` for local development. Docker Compose sets it to `http://vision-analyser/image` when both containers run on the same Docker network.

## Components

- `lib/vision-analyser.ts`: owns Custom Vision response types, severity mapping, repair estimate mapping, and the server-side HTTP call.
- `app/api/vision/analyze/route.ts`: exposes the server-side bridge to the client.
- `components/claims-workspace.tsx`: replaces the visual mock call with the API route call and switches the active dossier image from the shared catalogue.
- `docker-compose.yml`: runs the Next app and the Custom Vision analyser together.
- `README.md`: documents local analyser probing and full Docker startup.

## Data Flow

1. The user clicks "Lancer l'analyse visuelle".
2. The client calls `POST /api/vision/analyze`.
3. The route sends the selected dossier photo bytes to the analyser as multipart form data under `imageData`.
4. The route chooses the highest-probability prediction and returns severity plus confidence.
5. The visual analysis card renders severity and confidence only.

## Error Handling

If the analyser is unreachable, returns a non-OK response, or returns no predictions, the API route returns HTTP 502 with a short JSON error. The client already moves the visual card into `error` state when the call throws.

## Testing

The mapper is covered by a Node test that compiles the focused TypeScript helper and verifies the UI contract. Full verification uses `npm run lint`, `npm run build`, a direct analyser `curl`, and a local API route probe while Next is running.
