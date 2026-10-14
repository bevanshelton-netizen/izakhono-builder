import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from izakhono_factory_runtime import STAGES, brief_id, build_plan, infer_capability


def test_brief_id_is_stable():
    assert brief_id("Build a school app") == brief_id("  Build a school app  ")


def test_capability_inference():
    assert infer_capability("Build a payment API") == "code"
    assert infer_capability("Create a promotional video") == "video"
    assert infer_capability("Build a voice assistant") == "audio"


def test_plan_fails_closed_for_empty_brief():
    try:
        build_plan("")
    except ValueError:
        return
    raise AssertionError("empty briefs must fail closed")


def test_plan_has_all_execution_stages():
    plan = build_plan("Build a customer web app", available_only=False)
    assert [stage["id"] for stage in plan["stages"]] == list(STAGES)
    assert plan["public_live"] is False
    assert plan["gates"]["owner_authorized"] is False


def test_deploy_and_revenue_are_side_effect_stages():
    plan = build_plan("Build a customer web app", available_only=False)
    stages = {stage["id"]: stage for stage in plan["stages"]}
    assert stages["deploy"]["side_effect"] is True
    assert stages["revenue"]["side_effect"] is True
