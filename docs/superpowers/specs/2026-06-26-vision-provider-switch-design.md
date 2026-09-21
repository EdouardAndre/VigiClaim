# Vision Provider Switch Design

## Goal

Make the Computer Vision analyser selectable from the demo UI so the user can run the same claim photo against either the local Docker Custom Vision export or the published Azure Custom Vision Prediction endpoint.

## Current State

The browser calls `POST /api/vision/analyze`. The Next.js route reads the selected claim photo from the local dataset and calls `analyzeClaimPhoto()` in `lib/vision-analyser.ts`. That function always sends multipart form data to `VISION_ANALYSER_URL`, which works for the local Docker endpoint but not for Azure Custom Vision Prediction.

The Azure provider is optional and is configured through server-side environment
variables. Do not commit a resource name, resource group, endpoint, project ID,
published iteration, or prediction key. Use a local `.env.local` file or your
deployment's secret manager.

## User Experience

The Computer Vision analysis card will include a compact segmented control labelled by context as the analysis source. The options are:

- `Docker local`
- `Azure online`

The selected source is visible before and after running the analysis. Pressing the existing visual analysis button runs the model through the selected source. Results continue to show severity and confidence in the existing format.

## Architecture

The browser will send the selected provider with the existing analyse request:

```json
{
  "claimId": "SIN-2026-0847",
  "provider": "azure"
}
```

The server route validates the provider and passes it to `analyzeClaimPhoto()`. The analyser module owns provider-specific request formatting:

- Docker provider: `multipart/form-data` with field `imageData`
- Azure provider: raw image bytes with `Content-Type: application/octet-stream` and `Prediction-Key`

The response mapping remains shared because both providers return the Custom Vision `predictions` array.

## Configuration

Docker local remains the default for local compatibility:

- `VISION_DOCKER_URL`, default `http://127.0.0.1:8080/image`

Azure Custom Vision is configured server-side:

- `AZURE_CUSTOM_VISION_PREDICTION_URL`
- `AZURE_CUSTOM_VISION_PREDICTION_KEY`

The browser never receives the prediction key.

## Error Handling

If the selected provider is unavailable, missing configuration, or returns a non-OK response, `/api/vision/analyze` returns HTTP 502 with a short JSON error. The existing UI error state handles the failed call.

## Testing

Unit tests will cover:

- Custom Vision response mapping still chooses the highest probability tag.
- Docker requests use multipart form data.
- Azure requests use raw image bytes and the `Prediction-Key` header.
- Missing Azure configuration fails with a clear error.

Manual verification will cover:

- Docker local mode still works through Compose or a local analyser container.
- Azure online mode reaches the published Custom Vision endpoint with the project image.
