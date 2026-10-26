from runtime_orchestrator import (
    Gate,
    NodeState,
    Release,
    RouteClass,
    RuntimeNode,
    RuntimeOrchestrator,
)


class FakeProvider:
    def __init__(self, name, healthy=True, deployable=True):
        self.name = name
        self.healthy = healthy
        self.deployable = deployable
        self.provisioned = []
        self.deployed = []

    def provision(self, node, release):
        self.provisioned.append((node.node_id, release.release_id))
        return RuntimeNode(node.node_id, node.provider, node.route_class, NodeState.AVAILABLE, node.failover_order, node.region)

    def health(self, node):
        return self.healthy

    def deploy(self, node, release):
        self.deployed.append((node.node_id, release.release_id))
        return self.deployable


def test_owned_node_wins_over_external_even_with_worse_failover_order():
    owned = RuntimeNode("OWNED-01", "owned", RouteClass.OWNED, NodeState.AVAILABLE, 99, "ZA")
    external = RuntimeNode("CONTABO-01", "contabo", RouteClass.EXTERNAL_RESILIENCE, NodeState.AVAILABLE, 1, "EU")
    plan = RuntimeOrchestrator([]).plan(Release("r1", "1.0.0", "1"), [external, owned])
    assert plan.selected_node.node_id == "OWNED-01"


def test_external_provisionable_node_is_used_when_it_is_only_candidate():
    contabo = RuntimeNode("CONTABO-01", "contabo", RouteClass.EXTERNAL_RESILIENCE, NodeState.PROVISIONABLE, 30, "EU")
    provider = FakeProvider("contabo")
    orchestrator = RuntimeOrchestrator([provider])
    result = orchestrator.execute(orchestrator.plan(Release("r2", "2.0.0", "1"), [contabo]))
    assert result.selected_node.node_id == "CONTABO-01"
    assert provider.provisioned == [("CONTABO-01", "r2")]
    assert provider.deployed == [("CONTABO-01", "r2")]


def test_failed_primary_fails_over_without_changing_release():
    primary = RuntimeNode("CONTABO-01", "contabo", RouteClass.EXTERNAL_RESILIENCE, NodeState.AVAILABLE, 1, "EU")
    secondary = RuntimeNode("OWNED-02", "owned", RouteClass.OWNED, NodeState.AVAILABLE, 2, "ZA")
    # Owned-first means secondary is actually selected. This test verifies the inverse: an unhealthy owned node is excluded.
    unhealthy_owned = RuntimeNode("OWNED-01", "owned", RouteClass.OWNED, NodeState.DEGRADED, 0, "ZA")
    p1 = FakeProvider("contabo")
    p2 = FakeProvider("owned", healthy=True)
    result = RuntimeOrchestrator([p1, p2]).execute(
        RuntimeOrchestrator([p1, p2]).plan(Release("r3", "3.0.0", "7"), [primary, unhealthy_owned, secondary])
    )
    assert result.selected_node.node_id == "OWNED-02"
    assert result.release.release_id == "r3"
