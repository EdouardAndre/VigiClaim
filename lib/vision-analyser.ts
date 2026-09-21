import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_DEMO_CLAIM_ID, getDemoClaimById } from "@/lib/demo-claims";
import type { VisionResult } from "@/lib/mock-services";

type CustomVisionPrediction = {
  tagName: string;
  probability: number;
};

type CustomVisionResponse = {
  predictions?: CustomVisionPrediction[];
};

export type VisionAnalyserProvider = "docker" | "azure";

const DEFAULT_DOCKER_ANALYSER_URL = "http://127.0.0.1:8080/image";

const severityByTag: Record<string, VisionResult["severity"]> = {
  minor: "Faible",
  moderate: "Modérée",
  severe: "Élevée",
};

function toPercent(probability: number): number {
  return Math.round(probability * 1000) / 10;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer.length);
  bytes.set(buffer);

  return bytes.buffer;
}

export function mapCustomVisionResponse(payload: CustomVisionResponse): VisionResult {
  const predictions = [...(payload.predictions ?? [])].sort((left, right) => right.probability - left.probability);
  const topPrediction = predictions[0];

  if (!topPrediction) {
    throw new Error("No predictions returned by the vision analyser");
  }

  const topTag = topPrediction.tagName.toLowerCase();

  return {
    severity: severityByTag[topTag] ?? "Modérée",
    confidence: toPercent(topPrediction.probability),
  };
}

export function getClaimImagePath(claimId: string): string {
  const claim = getDemoClaimById(claimId);

  return path.join(process.cwd(), "data", claim.datasetPath.replace(/^data\//, ""));
}

export function parseVisionAnalyserProvider(provider: unknown): VisionAnalyserProvider {
  return provider === "azure" ? "azure" : "docker";
}

async function callDockerAnalyser(imageBuffer: Buffer, claimId: string): Promise<CustomVisionResponse> {
  const analyserUrl = process.env.VISION_DOCKER_URL ?? process.env.VISION_ANALYSER_URL ?? DEFAULT_DOCKER_ANALYSER_URL;
  const formData = new FormData();
  formData.append("imageData", new Blob([toArrayBuffer(imageBuffer)], { type: "image/jpeg" }), `${claimId}.jpeg`);

  const response = await fetch(analyserUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Docker vision analyser returned ${response.status}`);
  }

  return response.json();
}

async function callAzureCustomVision(imageBuffer: Buffer): Promise<CustomVisionResponse> {
  const predictionUrl = process.env.AZURE_CUSTOM_VISION_PREDICTION_URL;
  const predictionKey = process.env.AZURE_CUSTOM_VISION_PREDICTION_KEY;

  if (!predictionKey || !predictionUrl) {
    throw new Error("Azure Custom Vision prediction key or prediction url is not configured");
  }

  const response = await fetch(predictionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Prediction-Key": predictionKey,
    },
    body: toArrayBuffer(imageBuffer),
  });

  if (!response.ok) {
    throw new Error(`Azure Custom Vision returned ${response.status}`);
  }

  return response.json();
}

export async function analyzeClaimPhoto(
  claimId = DEFAULT_DEMO_CLAIM_ID,
  provider: VisionAnalyserProvider = "docker",
): Promise<VisionResult> {
  const imageBuffer = await readFile(getClaimImagePath(claimId));
  const response =
    provider === "azure"
      ? await callAzureCustomVision(imageBuffer)
      : await callDockerAnalyser(imageBuffer, claimId);

  return mapCustomVisionResponse(response);
}
