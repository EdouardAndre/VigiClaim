import { NextResponse } from "next/server";
import { DEFAULT_DEMO_CLAIM_ID, getDemoClaimById } from "@/lib/demo-claims";
import type { AgentResult, FraudResult, VisionResult } from "@/lib/mock-services";

type AgentServiceResponse = {
  answer?: unknown;
  decision?: unknown;
};

type InvestigateRequestBody = {
  claimId?: unknown;
  vision?: Partial<VisionResult>;
  fraud?: Partial<FraudResult>;
};

const DEFAULT_AGENT_SERVICE_URL = "http://127.0.0.1:8000/investigate";

const severityToAgent: Record<VisionResult["severity"], string> = {
  Faible: "minor",
  Modérée: "moderate",
  Élevée: "severe",
};

function getAgentServiceUrl(): string {
  const configuredUrl = process.env.AGENT_SERVICE_URL ?? DEFAULT_AGENT_SERVICE_URL;

  if (configuredUrl.endsWith("/investigate")) {
    return configuredUrl;
  }

  return `${configuredUrl.replace(/\/$/, "")}/investigate`;
}

function normalizeDecision(decision: string): AgentResult["decision"] {
  if (decision.startsWith("investigate_fraud")) {
    return "Investigation requise";
  }

  if (decision.startsWith("manual_review") || decision.startsWith("deny")) {
    return "Revue manuelle";
  }

  return "Validation assistée";
}

function buildActions(decision: AgentResult["decision"], fraud: FraudResult): string[] {
  if (decision === "Investigation requise") {
    return [
      "Geler l'indemnisation le temps de l'enquête",
      "Demander les pièces justificatives manquantes",
      "Transmettre le dossier à l'équipe fraude",
    ];
  }

  if (decision === "Revue manuelle") {
    return [
      "Contrôler la cohérence du devis atelier",
      "Vérifier les circonstances déclarées",
      "Demander une validation gestionnaire avant paiement",
    ];
  }

  return [
    "Contrôler le devis détaillé du garage",
    fraud.predicted ? "Documenter l'écart avec le score fraude" : "Valider les pièces justificatives",
    "Préparer la proposition d'indemnisation",
  ];
}

function toAgentResult(payload: AgentServiceResponse, fraud: FraudResult): AgentResult {
  const referenceDecision = typeof payload.decision === "string" ? payload.decision : "";
  const answer = typeof payload.answer === "string" && payload.answer.trim() ? payload.answer : referenceDecision;
  const decision = normalizeDecision(referenceDecision);

  return {
    decision,
    confidence: referenceDecision ? 91 : 78,
    rationale: answer || "L'agent a terminé l'analyse sans fournir de synthèse détaillée.",
    actions: buildActions(decision, fraud),
  };
}

function parseCompleteInputs(
  vision: InvestigateRequestBody["vision"],
  fraud: InvestigateRequestBody["fraud"],
): { vision: VisionResult; fraud: FraudResult } {
  if (
    !vision ||
    !fraud ||
    !["Faible", "Modérée", "Élevée"].includes(String(vision.severity)) ||
    typeof vision.confidence !== "number" ||
    typeof fraud.probability !== "number" ||
    typeof fraud.predicted !== "boolean"
  ) {
    throw new Error("Vision and fraud results are required before running the agent");
  }

  return {
    vision: vision as VisionResult,
    fraud: fraud as FraudResult,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InvestigateRequestBody;
    const claimId = typeof body.claimId === "string" ? body.claimId : DEFAULT_DEMO_CLAIM_ID;
    const claim = getDemoClaimById(claimId);

    const { vision, fraud } = parseCompleteInputs(body.vision, body.fraud);

    const response = await fetch(getAgentServiceUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cv: {
          severity: severityToAgent[vision.severity],
          confidence: Math.max(0, Math.min(1, vision.confidence / 100)),
        },
        ml: {
          fraud: fraud.predicted ? "Y" : "N",
          fraud_probability: fraud.probability,
        },
        claim: {
          id: claim.id,
          vehicle: claim.vehicle,
          amount: claim.record.totalClaimAmount,
          coverage: "comprehensive",
          incident: claim.incident,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent service returned ${response.status}`);
    }

    const payload = (await response.json()) as AgentServiceResponse;

    return NextResponse.json(toAgentResult(payload, fraud));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent service unavailable";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
