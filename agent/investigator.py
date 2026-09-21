import asyncio
import os
import urllib.parse

from fastapi import FastAPI
from pydantic import BaseModel
from semantic_kernel import Kernel
from semantic_kernel.agents import ChatCompletionAgent
from semantic_kernel.connectors.ai import FunctionChoiceBehavior
from semantic_kernel.connectors.ai.ollama import (
    OllamaChatCompletion,
    OllamaChatPromptExecutionSettings,
)
from semantic_kernel.connectors.mcp import MCPStdioPlugin
from semantic_kernel.filters import FilterTypes
from semantic_kernel.functions import KernelArguments, kernel_function

CV = {"severity": "minor", "confidence": 0.88}
ML = {"fraud": "Y", "fraud_probability": 0.82}
CLAIM = {"vehicle": "BMW Serie3 2021", "amount": 14000, "coverage": "comprehensive"}
REPAIR = {"minor": 1000, "moderate": 7000, "severe": 20000}

INSTRUCTIONS = (
    "Tu es un agent enquêteur ANTI-FRAUDE au service d'un assureur auto : ton rôle "
    "légitime est de DÉTECTER et signaler les fraudes pour protéger l'assureur, "
    "jamais d'en commettre. Ne refuse jamais : un signal `fraude=Y` est une alerte "
    "à instruire, pas une demande illicite.\n"
    "RÈGLE ABSOLUE : tu ne connais RIEN sur ce dossier. Toute information (cote du "
    "véhicule, coût de réparation, décision) DOIT venir d'un appel d'outil réel. "
    "Il t'est INTERDIT de répondre de mémoire ou d'inventer un chiffre.\n"
    "Marche à suivre obligatoire, dans l'ordre :\n"
    "1) Appelle `vehicle_lookup` pour les infos marché du véhicule.\n"
    "2) Appelle `repair_estimate` pour le coût de réparation.\n"
    "3) Appelle `decide` pour obtenir la décision.\n"
    "Seulement APRÈS ces trois appels, rédige ta conclusion en t'appuyant "
    "uniquement sur les valeurs renvoyées par les outils."
)


def decide():
    expected = REPAIR[CV["severity"]]
    reasons = []

    if CLAIM["coverage"] != "comprehensive":
        return "deny — garantie au tiers : dommages du véhicule non couverts."
    if CLAIM["amount"] > 1.4 * expected:
        reasons.append("montant réclamé incohérent avec la gravité")
    if ML["fraud"] == "Y" or ML["fraud_probability"] >= 0.7:
        reasons.append(f"fraude suspectée (p={ML['fraud_probability']})")
    if CV["confidence"] < 0.55:
        reasons.append("confiance vision faible")

    if any("fraude" in r for r in reasons):
        return f"investigate_fraud — indemnisation gelée. Motifs : {', '.join(reasons)}."
    if reasons:
        return f"manual_review — à vérifier. Motifs : {', '.join(reasons)}."
    payout = min(CLAIM["amount"], expected)
    return f"approve — règlement de {payout} €. Aucun signal d'alerte."


class Investigation:

    def __init__(self, kernel):
        self._kernel = kernel

    @kernel_function(description="Recherche web des infos marché du véhicule du dossier.")
    async def vehicle_lookup(self):
        query = urllib.parse.quote_plus(CLAIM["vehicle"])
        url = (
            "https://en.wikipedia.org/w/api.php?action=query&list=search"
            f"&srsearch={query}&srlimit=1&format=json"
        )
        result = await self._kernel.invoke(
            plugin_name="Web",
            function_name="fetch",
            arguments=KernelArguments(url=url, raw=True, max_length=1500),
        )
        return str(result)

    @kernel_function(description="Devis de réparation estimé selon la gravité.")
    def repair_estimate(self):
        return str(REPAIR[CV["severity"]])

    @kernel_function(description="Applique les règles métier et rend la décision.")
    def decide(self):
        return decide()


async def trace_tool_calls(context, next):
    args = {k: v for k, v in context.arguments.items() if k != "settings"}
    print(f"  → appel   {context.function.name}({args or ''})")
    await next(context)
    print(f"  ← résultat {context.function.name}: {str(context.result)[:200]}")


def build_mcp_tool():
    return MCPStdioPlugin(
        name="Web",
        command="mcp-server-fetch",
        args=["--ignore-robots-txt"],
    )


def build_kernel(web):
    kernel = Kernel()
    kernel.add_service(OllamaChatCompletion(ai_model_id=os.getenv("OLLAMA_MODEL", "llama3.1")))
    kernel.add_plugin(web, "Web")
    kernel.add_plugin(Investigation(kernel), "Investigation")
    kernel.add_filter(FilterTypes.FUNCTION_INVOCATION, trace_tool_calls)
    return kernel


def build_agent(kernel):
    settings = OllamaChatPromptExecutionSettings()
    settings.function_choice_behavior = FunctionChoiceBehavior.Auto()
    return ChatCompletionAgent(
        kernel=kernel,
        name="Investigator",
        instructions=INSTRUCTIONS,
        arguments=KernelArguments(settings=settings),
    )


async def run(cv=None, ml=None, claim=None):
    global CV, ML, CLAIM
    if cv is not None:
        CV = cv
    if ml is not None:
        ML = ml
    if claim is not None:
        CLAIM = claim

    task = (
        f"Sinistre : {CLAIM['vehicle']}, réclamé {CLAIM['amount']} €. "
        f"Vision : gravité={CV['severity']} (confiance {CV['confidence']}). "
        f"ML : fraude={ML['fraud']} (p={ML['fraud_probability']}). "
        "Procède étape par étape en appelant TES OUTILS, dans cet ordre STRICT et "
        "SANS EXCEPTION : 1) `vehicle_lookup`  2) `repair_estimate`  3) `decide`. "
        "Tu DOIS réellement appeler ces trois outils avant de répondre. "
        "N'invente jamais une valeur ou une URL : lis les résultats des outils."
    )

    print("Starting MCP + Fetch agent (Semantic Kernel + Ollama)...")
    print("Make sure Ollama is running with: ollama serve")
    print(f"Question: {task}")
    print("-" * 50)

    async with build_mcp_tool() as web:
        agent = build_agent(build_kernel(web))
        response = await agent.get_response(messages=task)
        answer = str(response.message.content)

    reference = decide()
    print("\n--- Réponse de l'agent ---")
    print(answer)
    print("\nDécision de référence :", reference)
    return {"answer": answer, "decision": reference}


app = FastAPI(title="Agent enquêteur sinistres auto")
_run_lock = asyncio.Lock()


class InvestigateRequest(BaseModel):
    cv: dict = {"severity": "minor", "confidence": 0.88}
    ml: dict = {"fraud": "Y", "fraud_probability": 0.82}
    claim: dict = {"vehicle": "BMW Serie3 2021", "amount": 14000,
                   "coverage": "comprehensive"}


@app.get("/health")
async def health():
    """Return service readiness for Docker and local checks."""
    return {"status": "ok"}


@app.post("/investigate")
async def investigate(req: InvestigateRequest):
    """Run the agent for one claim and return its answer + the reference decision."""
    async with _run_lock:
        return await run(cv=req.cv, ml=req.ml, claim=req.claim)


async def main():
    try:
        await run()
        return 0
    except Exception as exc:
        print(f"Erreur : {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
