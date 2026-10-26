from activation_gates import ActivationEvidence, ActivationStatus, evaluate


def test_provisioned_node_is_not_live_without_public_edge_evidence():
    result = evaluate(ActivationEvidence(
        release_verified=True,
        node_healthy=True,
        deployment_verified=True,
        edge_verified=False,
        tls_verified=False,
        dns_verified=False,
        smoke_test_verified=False,
        rollback_ready=True,
    ))
    assert result.status == ActivationStatus.BLOCKED
    assert not result.may_route_public_traffic
    assert "missing:edge" in result.reasons
    assert "missing:tls" in result.reasons
    assert "missing:dns" in result.reasons


def test_all_gates_are_required_for_live_verified():
    result = evaluate(ActivationEvidence(True, True, True, True, True, True, True, True))
    assert result.status == ActivationStatus.LIVE_VERIFIED
    assert result.may_route_public_traffic
