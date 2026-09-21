export type InsuranceClaimRecord = {
  policyState: string;
  policyDeductible: number;
  policyAnnualPremium: number;
  insuredAge: number;
  insuredSex: "MALE" | "FEMALE";
  insuredEducationLevel: string;
  insuredOccupation: string;
  insuredHobbies: string;
  incidentDate: string;
  incidentType: string;
  collisionType: string;
  incidentSeverity: "Minor Damage" | "Major Damage" | "Total Loss";
  authoritiesContacted: string;
  incidentState: string;
  incidentCity: string;
  incidentHourOfTheDay: number;
  numberOfVehiclesInvolved: number;
  bodilyInjuries: number;
  witnesses: number;
  policeReportAvailable: boolean;
  claimAmount: number;
  totalClaimAmount: number;
};

export type DemoClaim = {
  id: string;
  claimant: string;
  vehicle: string;
  date: string;
  amount: string;
  status: "À analyser" | "En revue" | "Investigation" | "Validé";
  risk: string;
  incident: string;
  contract: string;
  garage: string;
  photoCount: number;
  documentCount: number;
  datasetPath: string;
  expectedSeverity: "Faible" | "Modérée" | "Élevée";
  photoAlt: string;
  record: InsuranceClaimRecord;
};

export const DEFAULT_DEMO_CLAIM_ID = "SIN-2026-0847";

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatIncidentDate(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function mapSeverity(severity: InsuranceClaimRecord["incidentSeverity"]): DemoClaim["expectedSeverity"] {
  if (severity === "Minor Damage") return "Faible";
  if (severity === "Major Damage") return "Modérée";
  return "Élevée";
}

function mapAuthorities(authorities: string): string {
  if (authorities === "None") return "Aucune autorité contactée";
  if (authorities === "Police") return "Rapport de police";
  if (authorities === "Fire") return "Pompiers contactés";
  return authorities;
}

function buildClaim(
  id: string,
  status: DemoClaim["status"],
  risk: string,
  photoCount: number,
  documentCount: number,
  datasetPath: string,
  record: InsuranceClaimRecord,
): DemoClaim {
  const sexLabel = record.insuredSex === "MALE" ? "Homme" : "Femme";
  const expectedSeverity = mapSeverity(record.incidentSeverity);

  return {
    id,
    claimant: `${sexLabel}, ${record.insuredAge} ans`,
    vehicle: `${record.insuredOccupation} · ${record.incidentCity}, ${record.incidentState}`,
    date: formatIncidentDate(record.incidentDate),
    amount: formatUsd(record.totalClaimAmount),
    status,
    risk,
    incident: `${record.incidentType} · ${record.collisionType} · ${record.incidentCity}, ${record.incidentState}`,
    contract: `Franchise ${formatUsd(record.policyDeductible)} · Prime ${formatUsd(record.policyAnnualPremium)}/an · ${record.policyState}`,
    garage: mapAuthorities(record.authoritiesContacted),
    photoCount,
    documentCount,
    datasetPath,
    expectedSeverity,
    photoAlt: `Photo de validation montrant des dommages automobiles ${expectedSeverity.toLowerCase()}`,
    record,
  };
}

const claimRecords: Array<{
  id: string;
  status: DemoClaim["status"];
  risk: string;
  photoCount: number;
  documentCount: number;
  datasetPath: string;
  record: InsuranceClaimRecord;
}> = [
  {
    id: "SIN-2026-0847",
    status: "Investigation",
    risk: "78/100",
    photoCount: 3,
    documentCount: 6,
    datasetPath: "data/raw/data3a/validation/02-moderate/0001.JPEG",
    record: {
      policyState: "MI",
      policyDeductible: 500,
      policyAnnualPremium: 1342.5,
      insuredAge: 45,
      insuredSex: "MALE",
      insuredEducationLevel: "College",
      insuredOccupation: "Manager",
      insuredHobbies: "camping",
      incidentDate: "2024-11-03",
      incidentType: "Multi-vehicle Collision",
      collisionType: "Front",
      incidentSeverity: "Total Loss",
      authoritiesContacted: "Fire",
      incidentState: "MI",
      incidentCity: "Detroit",
      incidentHourOfTheDay: 14,
      numberOfVehiclesInvolved: 2,
      bodilyInjuries: 3,
      witnesses: 2,
      policeReportAvailable: true,
      claimAmount: 22000,
      totalClaimAmount: 28500,
    },
  },
  {
    id: "SIN-2026-0841",
    status: "Validé",
    risk: "18/100",
    photoCount: 2,
    documentCount: 4,
    datasetPath: "data/raw/data3a/validation/01-minor/0001.JPEG",
    record: {
      policyState: "OH",
      policyDeductible: 300,
      policyAnnualPremium: 876.2,
      insuredAge: 33,
      insuredSex: "FEMALE",
      insuredEducationLevel: "High School",
      insuredOccupation: "Clerk",
      insuredHobbies: "reading",
      incidentDate: "2025-01-15",
      incidentType: "Parked Car",
      collisionType: "Side",
      incidentSeverity: "Minor Damage",
      authoritiesContacted: "None",
      incidentState: "OH",
      incidentCity: "Columbus",
      incidentHourOfTheDay: 9,
      numberOfVehiclesInvolved: 1,
      bodilyInjuries: 0,
      witnesses: 1,
      policeReportAvailable: false,
      claimAmount: 1200,
      totalClaimAmount: 1800,
    },
  },
  {
    id: "SIN-2026-0835",
    status: "À analyser",
    risk: "45/100",
    photoCount: 5,
    documentCount: 8,
    datasetPath: "data/raw/data3a/validation/03-severe/0001.JPEG",
    record: {
      policyState: "GA",
      policyDeductible: 400,
      policyAnnualPremium: 1105.75,
      insuredAge: 28,
      insuredSex: "MALE",
      insuredEducationLevel: "College",
      insuredOccupation: "Sales",
      insuredHobbies: "paintball",
      incidentDate: "2025-02-20",
      incidentType: "Single Vehicle Collision",
      collisionType: "Rear",
      incidentSeverity: "Major Damage",
      authoritiesContacted: "Police",
      incidentState: "GA",
      incidentCity: "Atlanta",
      incidentHourOfTheDay: 23,
      numberOfVehiclesInvolved: 1,
      bodilyInjuries: 1,
      witnesses: 0,
      policeReportAvailable: false,
      claimAmount: 8500,
      totalClaimAmount: 11200,
    },
  },
  {
    id: "SIN-2026-0829",
    status: "En revue",
    risk: "62/100",
    photoCount: 3,
    documentCount: 5,
    datasetPath: "data/raw/data3a/training/01-minor/0001.JPEG",
    record: {
      policyState: "IL",
      policyDeductible: 600,
      policyAnnualPremium: 950,
      insuredAge: 52,
      insuredSex: "MALE",
      insuredEducationLevel: "High School",
      insuredOccupation: "Manager",
      insuredHobbies: "chess",
      incidentDate: "2024-09-10",
      incidentType: "Vehicle Theft",
      collisionType: "Unknown",
      incidentSeverity: "Total Loss",
      authoritiesContacted: "None",
      incidentState: "IL",
      incidentCity: "Chicago",
      incidentHourOfTheDay: 2,
      numberOfVehiclesInvolved: 1,
      bodilyInjuries: 0,
      witnesses: 0,
      policeReportAvailable: false,
      claimAmount: 18000,
      totalClaimAmount: 18000,
    },
  },
];

export const demoClaims: DemoClaim[] = claimRecords.map((item) =>
  buildClaim(item.id, item.status, item.risk, item.photoCount, item.documentCount, item.datasetPath, item.record),
);

export function getDemoClaimById(claimId: string): DemoClaim {
  const claim = demoClaims.find((item) => item.id === claimId);

  if (!claim) {
    throw new Error(`Unknown demo claim: ${claimId}`);
  }

  return claim;
}
