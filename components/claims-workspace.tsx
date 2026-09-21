"use client";

import Image from "next/image";
import {
  Pulse as Activity,
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Brain,
  Briefcase,
  Camera,
  CaretDown,
  ChartLineUp,
  Check,
  CheckCircle,
  CirclesThreePlus,
  Clock,
  Database,
  FileText,
  Funnel,
  Gauge,
  House,
  Info,
  Link as LinkIcon,
  ListChecks,
  MagnifyingGlass,
  MicrosoftExcelLogo,
  Robot,
  ShieldCheck,
  SidebarSimple,
  SlidersHorizontal,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  AgentResult,
  FraudResult,
  VisionResult,
  mockFraudScore,
} from "@/lib/mock-services";
import { DEFAULT_DEMO_CLAIM_ID, demoClaims, getDemoClaimById } from "@/lib/demo-claims";
import type { DemoClaim } from "@/lib/demo-claims";

type View = "dashboard" | "claims" | "ai" | "project";
type ServiceState<T> = { status: "idle" | "loading" | "success" | "error"; data?: T };
type VisionProvider = "docker" | "azure";

function fraudLevelColor(level: FraudResult["level"]): string {
  if (level === "Élevé") return "#be123c";
  if (level === "Modéré") return "#b45309";
  return "#15803d";
}

async function analyzeVehicleDamage(claimId: string, provider: VisionProvider): Promise<VisionResult> {
  const response = await fetch("/api/vision/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claimId, provider }),
  });

  if (!response.ok) {
    throw new Error("Vision analyser unavailable");
  }

  return response.json();
}

async function investigateClaim(claimId: string, vision: VisionResult, fraud: FraudResult): Promise<AgentResult> {
  const response = await fetch("/api/agent/investigate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claimId, vision, fraud }),
  });

  if (!response.ok) {
    throw new Error("Agent service unavailable");
  }

  return response.json();
}

function StatusPill({ children }: { children: React.ReactNode }) {
  const text = String(children);
  const color =
    text === "Validé"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : text === "Investigation"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : text === "En revue"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-sky-50 text-sky-700 border-sky-200";
  return <span className={`status-pill ${color}`}>{children}</span>;
}

function ServiceButton({
  loading,
  done,
  onClick,
  children,
}: {
  loading: boolean;
  done: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="service-button" onClick={onClick} disabled={loading}>
      {loading ? <ArrowsClockwise className="animate-spin" size={17} /> : done ? <Check size={17} /> : <Sparkle size={17} />}
      {loading ? "Analyse en cours…" : done ? "Relancer l’analyse" : children}
    </button>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-3 py-2" aria-label="Chargement">
      <div className="skeleton h-4 w-4/5" />
      <div className="skeleton h-4 w-3/5" />
      <div className="skeleton h-12 w-full" />
    </div>
  );
}

export function ClaimsWorkspace() {
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeClaimId, setActiveClaimId] = useState(DEFAULT_DEMO_CLAIM_ID);
  const [visionProvider, setVisionProvider] = useState<VisionProvider>("docker");
  const [vision, setVision] = useState<ServiceState<VisionResult>>({ status: "idle" });
  const [fraud, setFraud] = useState<ServiceState<FraudResult>>({ status: "idle" });
  const [agent, setAgent] = useState<ServiceState<AgentResult>>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const activeClaim = getDemoClaimById(activeClaimId);

  const analysisProgress = useMemo(
    () => [vision, fraud, agent].filter((item) => item.status === "success").length,
    [vision, fraud, agent],
  );

  const runVision = async () => {
    setVision({ status: "loading" });
    try {
      setVision({ status: "success", data: await analyzeVehicleDamage(activeClaimId, visionProvider) });
    } catch {
      setVision({ status: "error" });
    }
  };

  const selectVisionProvider = (provider: VisionProvider) => {
    setVisionProvider(provider);
    setVision({ status: "idle" });
  };

  const selectClaim = (claimId: string) => {
    setActiveClaimId(claimId);
    setVision({ status: "idle" });
    setFraud({ status: "idle" });
    setAgent({ status: "idle" });
    setView("ai");
    setSidebarOpen(false);
  };

  const runFraud = async () => {
    setFraud({ status: "loading" });
    try {
      setFraud({ status: "success", data: await mockFraudScore(activeClaimId) });
    } catch {
      setFraud({ status: "error" });
    }
  };

  const runAgent = async () => {
    if (vision.status !== "success" || fraud.status !== "success" || !vision.data || !fraud.data) {
      setNotice("L’analyse visuelle et le score de fraude doivent être terminés.");
      window.setTimeout(() => setNotice(null), 3200);
      return;
    }
    setAgent({ status: "loading" });
    try {
      setAgent({ status: "success", data: await investigateClaim(activeClaimId, vision.data, fraud.data) });
    } catch {
      setAgent({ status: "error" });
    }
  };

  const navItems = [
    { id: "dashboard" as const, label: "Vue d’ensemble", icon: House },
    { id: "claims" as const, label: "Dossiers sinistres", icon: Briefcase, count: demoClaims.length },
    { id: "ai" as const, label: "Centre d’analyse IA", icon: CirclesThreePlus },
    { id: "project" as const, label: "Projet & données", icon: FileText },
  ];

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Fermer le menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={22} weight="fill" /></div>
          <div>
            <strong>VigiClaim</strong>
            <span>AI operations</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Fermer"><X size={20} /></button>
        </div>

        <nav className="main-nav" aria-label="Navigation principale">
          <p className="nav-label">Espace de travail</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                setSidebarOpen(false);
              }}
              className={view === item.id ? "nav-item active" : "nav-item"}
            >
              <item.icon size={19} weight={view === item.id ? "fill" : "regular"} />
              <span>{item.label}</span>
              {item.count && <em>{item.count}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="service-health">
          <div className="health-heading"><Activity size={17} /><span>Services Azure</span></div>
          {[
            { name: "Computer Vision", state: visionProvider === "azure" ? "Azure" : "Docker" },
            { name: "Machine Learning", state: "Mock" },
            { name: "Agent Framework", state: "API" },
          ].map((service) => (
            <div className="health-row" key={service.name}><i />{service.name}<span>{service.state}</span></div>
          ))}
        </div>
        <div className="profile">
          <div className="avatar">AD</div>
          <div><strong>Amaury Delille</strong><span>Gestionnaire sinistres</span></div>
          <CaretDown size={16} />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu"><SidebarSimple size={22} /></button>
          <div className="global-search">
            <MagnifyingGlass size={18} />
            <input aria-label="Rechercher" placeholder="Rechercher un dossier, assuré, véhicule…" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-actions">
            <span className="environment"><i /> Environnement démo</span>
            <button className="icon-button" aria-label="Paramètres"><SlidersHorizontal size={19} /></button>
            <button className="new-claim" onClick={() => setNotice("Le formulaire de création sera connecté au backend ultérieurement.")}>Nouveau dossier</button>
          </div>
        </header>

        {view === "project" ? (
          <ProjectView />
        ) : view === "claims" ? (
          <ClaimsView activeClaimId={activeClaimId} onSelect={selectClaim} />
        ) : (
          <DashboardView
            compact={view === "ai"}
            activeClaim={activeClaim}
            vision={vision}
            fraud={fraud}
            agent={agent}
            visionProvider={visionProvider}
            setVisionProvider={selectVisionProvider}
            runVision={runVision}
            runFraud={runFraud}
            runAgent={runAgent}
            analysisProgress={analysisProgress}
            openClaims={() => setView("claims")}
            selectClaim={selectClaim}
          />
        )}
      </main>

      {notice && (
        <div className="toast" role="status">
          <Info size={19} weight="fill" />
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Fermer"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

type DashboardProps = {
  compact: boolean;
  activeClaim: DemoClaim;
  vision: ServiceState<VisionResult>;
  fraud: ServiceState<FraudResult>;
  agent: ServiceState<AgentResult>;
  visionProvider: VisionProvider;
  setVisionProvider: (provider: VisionProvider) => void;
  runVision: () => void;
  runFraud: () => void;
  runAgent: () => void;
  analysisProgress: number;
  openClaims: () => void;
  selectClaim: (claimId: string) => void;
};

function DashboardView(props: DashboardProps) {
  return (
    <div className="content-page animate-in">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span>Opérations</span><ArrowRight size={12} /><span>{props.compact ? "Centre d’analyse IA" : "Vue d’ensemble"}</span></div>
          <h1>{props.compact ? "Analyse augmentée du dossier" : "Bonjour Amaury."}</h1>
          <p>{props.compact ? "Trois signaux complémentaires pour une décision explicable." : "Voici les dossiers qui requièrent votre attention aujourd’hui."}</p>
        </div>
        <div className="heading-date"><Clock size={16} /><span>Mercredi 24 juin</span><strong>09:42</strong></div>
      </section>

      {!props.compact && (
        <>
          <section className="metrics-strip">
            <Metric label="Dossiers ouverts" value="128" delta="+8 cette semaine" icon={<Briefcase size={20} />} />
            <Metric label="À analyser" value="12" delta="4 prioritaires" icon={<ListChecks size={20} />} accent />
            <Metric label="Délai moyen" value="2,4 j" delta="-0,6 j vs mai" icon={<Clock size={20} />} />
            <Metric label="Fraude évitée" value="86,7 k€" delta="+12,8% ce mois" icon={<ChartLineUp size={20} />} />
          </section>

          <section className="queue-section">
            <div className="section-heading">
              <div><h2>Dossiers prioritaires</h2><p>Classés par urgence opérationnelle et niveau de risque.</p></div>
              <button className="text-button" onClick={props.openClaims}>Voir les {demoClaims.length} dossiers <ArrowRight size={16} /></button>
            </div>
            <div className="claim-table-wrap">
              <table className="claim-table">
                <thead><tr><th>Dossier</th><th>Assuré / véhicule</th><th>Déclaration</th><th>Montant</th><th>Risque</th><th>Statut</th><th /></tr></thead>
                <tbody>
                  {demoClaims.slice(0, 3).map((claim) => (
                    <tr key={claim.id}>
                      <td><strong>{claim.id}</strong></td>
                      <td><strong>{claim.claimant}</strong><span>{claim.vehicle}</span></td>
                      <td>{claim.date}</td>
                      <td><strong>{claim.amount}</strong></td>
                      <td><span className="risk-score">{claim.risk}</span></td>
                      <td><StatusPill>{claim.status}</StatusPill></td>
                      <td><button className="row-action" onClick={() => props.selectClaim(claim.id)} aria-label={`Ouvrir ${claim.id}`}><ArrowRight size={17} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className={props.compact ? "analysis-section analysis-full" : "analysis-section"}>
        <div className="section-heading">
          <div>
            <div className="live-label"><i /> Dossier actif</div>
            <h2>{props.activeClaim.id} · {props.activeClaim.vehicle}</h2>
            <p>{props.activeClaim.incident}</p>
          </div>
          <div className="progress-chip"><span>{props.analysisProgress}/3 analyses</span><div><i style={{ transform: `scaleX(${props.analysisProgress / 3})` }} /></div></div>
        </div>

        <div className="evidence-layout">
          <article className="evidence-panel">
            <div className="panel-topline">
              <div><Camera size={18} /><strong>Pièces du dossier</strong></div>
              <span>{props.activeClaim.photoCount} photos · {props.activeClaim.documentCount} documents</span>
            </div>
            <div className="damage-photo">
              <Image src={`/api/claims/${props.activeClaim.id}/photo`} fill sizes="(max-width: 900px) 100vw, 45vw" alt={props.activeClaim.photoAlt} priority unoptimized />
              <div className="photo-counter">01 / 03</div>
              <button className="photo-nav prev" aria-label="Photo précédente"><ArrowLeft size={17} /></button>
              <button className="photo-nav next" aria-label="Photo suivante"><ArrowRight size={17} /></button>
            </div>
            <div className="claim-facts">
              <div><span>Assuré</span><strong>{props.activeClaim.claimant}</strong></div>
              <div><span>Contrat</span><strong>{props.activeClaim.contract}</strong></div>
              <div><span>Montant déclaré</span><strong>{props.activeClaim.amount}</strong></div>
              <div><span>Garage</span><strong>{props.activeClaim.garage}</strong></div>
            </div>
          </article>

          <div className="analysis-stack">
            <AnalysisCard icon={<Camera size={19} />} title="Computer Vision" subtitle="Gravité des dommages" state={props.vision.status}>
              <VisionProviderSwitch
                value={props.visionProvider}
                disabled={props.vision.status === "loading"}
                onChange={props.setVisionProvider}
              />
              {props.vision.status === "loading" ? <SkeletonLines /> : props.vision.data ? (
                <div className="result-content">
                  <div className="result-lead"><div><span>Sévérité estimée via {props.visionProvider === "azure" ? "Azure online" : "Docker local"}</span><strong>{props.vision.data.severity}</strong></div><Confidence value={props.vision.data.confidence} /></div>
                </div>
              ) : <EmptyAnalysis text="Analyse les photos pour estimer la gravité des dommages." />}
              <ServiceButton loading={props.vision.status === "loading"} done={props.vision.status === "success"} onClick={props.runVision}>Lancer l’analyse visuelle</ServiceButton>
            </AnalysisCard>

            <AnalysisCard icon={<Gauge size={19} />} title="Machine Learning" subtitle="Score de risque de fraude" state={props.fraud.status}>
              {props.fraud.status === "loading" ? <SkeletonLines /> : props.fraud.data ? (
                <div className="fraud-result" style={{ "--score-color": fraudLevelColor(props.fraud.data.level) } as React.CSSProperties}>
                  <div className="score-gauge" style={{ "--score": `${props.fraud.data.score * 3.6}deg` } as React.CSSProperties}><div><strong>{props.fraud.data.score}</strong><span>/100</span></div></div>
                  <div className="score-copy">
                    <span>Risque {props.fraud.data.level.toLowerCase()}{props.fraud.data.predicted ? " — fraude suspectée" : ""}</span>
                    <p>
                      {props.fraud.data.factors.filter((f) => f.impact === "positif").length} facteur(s) rassurant(s),{" "}
                      {props.fraud.data.factors.filter((f) => f.impact === "négatif").length} point(s) de vigilance.
                    </p>
                  </div>
                </div>
              ) : <EmptyAnalysis text="Calcule le risque depuis le profil, l’historique et les métadonnées." />}
              <ServiceButton loading={props.fraud.status === "loading"} done={props.fraud.status === "success"} onClick={props.runFraud}>Calculer le score fraude</ServiceButton>
            </AnalysisCard>

            <AnalysisCard icon={<Robot size={19} />} title="Agent enquêteur" subtitle="Synthèse et décision motivée" state={props.agent.status} featured>
              {props.agent.status === "loading" ? <SkeletonLines /> : props.agent.data ? (
                <div className="agent-result">
                  <div className="decision-line"><CheckCircle size={22} weight="fill" /><div><span>Recommandation</span><strong>{props.agent.data.decision}</strong></div><Confidence value={props.agent.data.confidence} /></div>
                  <p>{props.agent.data.rationale}</p>
                  <div className="next-actions">{props.agent.data.actions.map((action, index) => <div key={action}><span>{index + 1}</span>{action}</div>)}</div>
                </div>
              ) : (
                <div className="agent-empty"><div className="agent-orbit"><Brain size={25} /><i /><i /></div><p>L’agent croise les analyses, vérifie les règles métier et formule une recommandation explicable.</p></div>
              )}
              <ServiceButton loading={props.agent.status === "loading"} done={props.agent.status === "success"} onClick={props.runAgent}>Générer la recommandation</ServiceButton>
            </AnalysisCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, delta, icon, accent = false }: { label: string; value: string; delta: string; icon: React.ReactNode; accent?: boolean }) {
  return <div className={accent ? "metric accent" : "metric"}><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><p>{delta}</p></div>;
}

function Confidence({ value }: { value: number }) {
  return <div className="confidence"><span>Confiance</span><strong>{value}%</strong></div>;
}

function EmptyAnalysis({ text }: { text: string }) {
  return <div className="empty-analysis"><Sparkle size={20} /><p>{text}</p></div>;
}

function VisionProviderSwitch({ value, disabled, onChange }: { value: VisionProvider; disabled: boolean; onChange: (provider: VisionProvider) => void }) {
  return (
    <div className="provider-switch" aria-label="Source Computer Vision">
      <button type="button" className={value === "docker" ? "active" : ""} disabled={disabled} onClick={() => onChange("docker")}>
        Docker local
      </button>
      <button type="button" className={value === "azure" ? "active" : ""} disabled={disabled} onClick={() => onChange("azure")}>
        Azure online
      </button>
    </div>
  );
}

function AnalysisCard({ icon, title, subtitle, state, featured = false, children }: { icon: React.ReactNode; title: string; subtitle: string; state: string; featured?: boolean; children: React.ReactNode }) {
  return (
    <article className={featured ? "analysis-card featured" : "analysis-card"}>
      <div className="analysis-card-head">
        <div className="service-icon">{icon}</div>
        <div><strong>{title}</strong><span>{subtitle}</span></div>
        <span className={`state-dot ${state}`}><i />{state === "success" ? "Terminé" : state === "loading" ? "En cours" : "En attente"}</span>
      </div>
      {children}
    </article>
  );
}

function ClaimsView({ activeClaimId, onSelect }: { activeClaimId: string; onSelect: (claimId: string) => void }) {
  return (
    <div className="content-page animate-in">
      <section className="page-heading">
        <div><div className="eyebrow"><span>Opérations</span><ArrowRight size={12} /><span>Dossiers sinistres</span></div><h1>File de traitement</h1><p>{demoClaims.length} dossiers de démonstration reliés aux images du dataset.</p></div>
        <button className="new-claim">Nouveau dossier</button>
      </section>
      <div className="filters"><div className="filter-search"><MagnifyingGlass size={17} /><input placeholder="Rechercher dans les dossiers…" /></div><button><Funnel size={17} /> Filtrer <span>3</span></button><button><ArrowsClockwise size={17} /> Actualiser</button></div>
      <section className="claim-table-wrap full-table">
        <table className="claim-table">
          <thead><tr><th>Dossier</th><th>Assuré / véhicule</th><th>Déclaration</th><th>Montant</th><th>Risque</th><th>Statut</th><th /></tr></thead>
          <tbody>{demoClaims.map((claim) => (
            <tr key={claim.id} onClick={() => onSelect(claim.id)} aria-selected={claim.id === activeClaimId}>
              <td><strong>{claim.id}</strong></td><td><strong>{claim.claimant}</strong><span>{claim.vehicle}</span></td><td>{claim.date}</td><td><strong>{claim.amount}</strong></td><td><span className="risk-score">{claim.risk}</span></td><td><StatusPill>{claim.status}</StatusPill></td><td><button className="row-action" aria-label={`Ouvrir ${claim.id}`}><ArrowRight size={17} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}

function ProjectView() {
  const capabilities = [
    { n: "01", title: "Computer Vision", text: "Estimer la gravité des dommages depuis les photographies du véhicule accidenté.", icon: Camera },
    { n: "02", title: "Scoring ML", text: "Évaluer le risque de fraude à partir du montant, de l’historique, du profil et des délais.", icon: ChartLineUp },
    { n: "03", title: "Scénario Edge", text: "Exécuter l’application web localement dans Docker pour démontrer un déploiement edge.", icon: MicrosoftExcelLogo },
    { n: "04", title: "Agent enquêteur", text: "Croiser les signaux, compléter l’enquête, appliquer les règles métier et motiver une décision.", icon: Robot },
  ];
  return (
    <div className="content-page project-page animate-in">
      <section className="project-hero">
        <div>
          <div className="eyebrow"><span>Projet Microsoft Azure</span><ArrowRight size={12} /><span>MVP</span></div>
          <h1>Triage intelligent des sinistres automobiles.</h1>
          <p>Une interface opérationnelle qui transforme les photos, les métadonnées et les règles métier en une recommandation traçable pour le gestionnaire.</p>
          <div className="project-tags"><span>Équipe de 4 à 6</span><span>Présentation 15 min</span><span>5 min Q&amp;A</span></div>
        </div>
        <div className="architecture-mini">
          <div className="arch-source"><span>Dossier sinistre</span><strong>Photos + métadonnées</strong></div>
          <div className="arch-line"><i /></div>
          <div className="arch-services"><span><Camera size={17} /> Vision</span><span><Gauge size={17} /> ML</span><span><Robot size={17} /> Agent</span></div>
          <div className="arch-line"><i /></div>
          <div className="arch-output"><CheckCircle size={20} weight="fill" /><div><span>Sortie</span><strong>Décision motivée</strong></div></div>
        </div>
      </section>

      <section className="project-capabilities">
        <div className="section-heading"><div><h2>Capacités démontrées</h2><p>Quatre briques reliées dans un parcours métier unique.</p></div></div>
        <div className="capability-grid">
          {capabilities.map((item) => <article key={item.n}><span>{item.n}</span><item.icon size={24} /><h3>{item.title}</h3><p>{item.text}</p></article>)}
        </div>
      </section>

      <section className="data-section">
        <div><div className="section-heading"><div><h2>Sources de données</h2><p>Jeux de données publics retenus pour le prototype.</p></div></div>
          <a className="dataset" href="https://www.kaggle.com/datasets/ahluwaliasaksham/car-insurance-fraud-detection-dataset" target="_blank" rel="noreferrer"><div className="dataset-icon"><Database size={21} /></div><div><span>Scoring tabulaire</span><strong>Car Insurance Fraud Detection Dataset</strong><p>Kaggle · Métadonnées de déclarations et labels de fraude</p></div><LinkIcon size={17} /></a>
          <a className="dataset" href="https://www.kaggle.com/datasets/prajwalbhamere/car-damage-severity-dataset" target="_blank" rel="noreferrer"><div className="dataset-icon"><Camera size={21} /></div><div><span>Computer Vision</span><strong>Car Damage Severity Dataset</strong><p>Kaggle · Images classées par niveau de sévérité</p></div><LinkIcon size={17} /></a>
          <div className="dataset muted"><div className="dataset-icon"><Database size={21} /></div><div><span>Alternative CV</span><strong>CarDD — Car Damage Detection</strong><p>Annotations structurées avec masques et bounding boxes</p></div></div>
        </div>
        <div className="brief-slide">
          <div className="slide-label"><FileText size={17} /> Brief original du projet</div>
          <Image src="/images/project-brief.png" width={2048} height={1152} alt="Diapositive de définition du projet Microsoft Azure" />
        </div>
      </section>

      <section className="mvp-strip">
        <div><WarningCircle size={20} /><span>Cadre du MVP</span></div>
        <p>L’analyse Computer Vision peut basculer entre le conteneur Custom Vision local et le endpoint Custom Vision Azure publié. Le score Machine Learning reste simulé, puis l’Agent Framework FastAPI produit la recommandation à partir des résultats Vision et fraude.</p>
      </section>
    </div>
  );
}
