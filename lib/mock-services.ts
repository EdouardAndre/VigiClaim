export type VisionResult = {
  severity: "Faible" | "Modérée" | "Élevée";
  confidence: number;
};

export type FraudResult = {
  score: number;
  level: "Faible" | "Modéré" | "Élevé";
  predicted: boolean;
  probability: number;
  factors: Array<{ label: string; impact: "positif" | "neutre" | "négatif" }>;
};

export type AgentResult = {
  decision: "Validation assistée" | "Revue manuelle" | "Investigation requise";
  confidence: number;
  rationale: string;
  actions: string[];
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockComputerVision(): Promise<VisionResult> {
  await wait(1450);
  return {
    severity: "Modérée",
    confidence: 94.2,
  };
}

// Mocked fraud outputs, hand-tuned per claim so the score tracks the actual red flags in
// each record (witnesses, police report, incident hour, claim/total ratio) instead of the
// real Azure ML model's output, which came back inconsistent with the underlying data.
const fraudModelOutputsByClaimId: Record<
  string,
  { probability: number; predicted: boolean; factors: FraudResult["factors"] }
> = {
  "SIN-2026-0847": {
    probability: 0.08,
    predicted: false,
    factors: [
      { label: "Rapport de police disponible et pompiers intervenus sur place", impact: "positif" },
      { label: "Deux témoins confirment les circonstances de la collision", impact: "positif" },
      { label: "Sinistre déclaré en pleine journée (14h)", impact: "positif" },
      { label: "Sinistre multi-véhicules avec blessures corporelles", impact: "neutre" },
    ],
  },
  "SIN-2026-0841": {
    probability: 0.05,
    predicted: false,
    factors: [
      { label: "Dommage mineur cohérent avec un choc en stationnement", impact: "positif" },
      { label: "Montant réclamé faible et proportionné aux dégâts", impact: "positif" },
      { label: "Un témoin confirme les circonstances", impact: "positif" },
      { label: "Aucun rapport de police pour un sinistre à faible enjeu", impact: "neutre" },
    ],
  },
  "SIN-2026-0835": {
    probability: 0.42,
    predicted: false,
    factors: [
      { label: "Autorités contactées mais aucun rapport de police versé au dossier", impact: "négatif" },
      { label: "Sinistre déclaré tard le soir (23h), sans témoin", impact: "négatif" },
      { label: "Dommages arrière cohérents avec une collision à un seul véhicule", impact: "positif" },
    ],
  },
  "SIN-2026-0829": {
    probability: 0.81,
    predicted: true,
    factors: [
      { label: "Vol déclaré sans aucun rapport de police", impact: "négatif" },
      { label: "Aucun témoin, incident signalé à 2h du matin", impact: "négatif" },
      { label: "Montant réclamé strictement égal à la valeur totale du véhicule", impact: "négatif" },
      { label: "Ancienneté du contrat cohérente avec le profil assuré", impact: "positif" },
    ],
  },
};

function levelFromProbability(probability: number): FraudResult["level"] {
  if (probability >= 0.6) return "Élevé";
  if (probability >= 0.3) return "Modéré";
  return "Faible";
}

export async function mockFraudScore(claimId: string): Promise<FraudResult> {
  await wait(1200);
  const output = fraudModelOutputsByClaimId[claimId];

  if (!output) {
    throw new Error(`Aucune sortie de modèle fraude mockée pour le sinistre ${claimId}`);
  }

  return {
    score: Math.round(output.probability * 100),
    level: levelFromProbability(output.probability),
    predicted: output.predicted,
    probability: output.probability,
    factors: output.factors,
  };
}

export async function mockAgentDecision(): Promise<AgentResult> {
  await wait(1850);
  return {
    decision: "Validation assistée",
    confidence: 88.6,
    rationale:
      "Les dommages visuels sont compatibles avec le récit déclaré et l’estimation atelier. Le score de fraude reste sous le seuil de revue manuelle. Une validation peut être proposée après contrôle du devis détaillé.",
    actions: [
      "Demander le devis détaillé au garage",
      "Vérifier la date de prise des photographies",
      "Autoriser une provision maximale de 4 100 €",
    ],
  };
}
