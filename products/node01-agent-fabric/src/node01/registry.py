from .models import AgentSpec, Risk


AGENTS = [
    AgentSpec("research.web", "Web Researcher", "research", frozenset({"research.web", "research.factcheck"}), risks=frozenset({Risk.READ})),
    AgentSpec("research.market", "Market Researcher", "research", frozenset({"research.market"}), risks=frozenset({Risk.READ})),
    AgentSpec("research.data", "Data Analyst", "research", frozenset({"research.data", "analytics"}), risks=frozenset({Risk.READ})),
    AgentSpec("research.docs", "Document Analyst", "research", frozenset({"research.documents"}), risks=frozenset({Risk.READ})),
    AgentSpec("product.strategy", "Product Strategist", "business", frozenset({"product.strategy"}), risks=frozenset({Risk.READ})),
    AgentSpec("product.manager", "Product Manager", "business", frozenset({"product.plan"}), risks=frozenset({Risk.READ})),
    AgentSpec("sales", "Sales Agent", "business", frozenset({"sales.prepare"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("marketing", "Marketing Agent", "business", frozenset({"marketing.plan", "marketing.copy"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("frontend", "Frontend Engineer", "build", frozenset({"build.frontend"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("backend", "Backend Engineer", "build", frozenset({"build.backend", "build.api"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("database", "Database Engineer", "build", frozenset({"build.database"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("devops", "DevOps Engineer", "build", frozenset({"build.ci", "deploy.prepare"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("qa", "QA Engineer", "build", frozenset({"qa.test", "qa.acceptance"}), risks=frozenset({Risk.READ})),
    AgentSpec("ux", "UI/UX Designer", "build", frozenset({"design.ui", "design.ux"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("security.audit", "Security Auditor", "security", frozenset({"security.audit"}), risks=frozenset({Risk.READ})),
    AgentSpec("security.threat", "Threat Analyst", "security", frozenset({"security.threat"}), risks=frozenset({Risk.READ})),
    AgentSpec("security.identity", "Identity Engineer", "security", frozenset({"security.identity"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("ops.provisioner", "Provisioning Agent", "operations", frozenset({"provision.domain", "provision.site", "provision.email", "provision.ssl", "provision.plan"}), risks=frozenset({Risk.READ, Risk.WRITE, Risk.EXTERNAL})),
    AgentSpec("ops.mail", "Mail Operations Agent", "operations", frozenset({"mail.monitor", "mail.prepare", "mail.draft"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("ops.crm", "CRM Operations Agent", "operations", frozenset({"crm.sync", "crm.prepare"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("ops.monitor", "Observability Agent", "operations", frozenset({"observe.health", "observe.alert"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("ops.incident", "Incident Manager", "operations", frozenset({"incident.triage", "incident.plan"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("release", "Release Manager", "operations", frozenset({"release.prepare", "release.verify"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("ai.gateway", "AI Gateway Agent", "operations", frozenset({"ai.gateway"}), risks=frozenset({Risk.READ, Risk.WRITE})),
    AgentSpec("review", "Critical Reviewer", "governance", frozenset({"review.quality", "review.evidence"}), risks=frozenset({Risk.READ})),
]

REGISTRY = {agent.id: agent for agent in AGENTS}


def find_agent(capability: str) -> AgentSpec | None:
    for agent in AGENTS:
        if capability in agent.capabilities:
            return agent
    return None
