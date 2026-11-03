#!/usr/bin/env python3
"""Regression test for tenant-scoped Provisioner idempotency."""

from state_machine import Provisioner


def main() -> None:
    provisioner = Provisioner()

    first = provisioner.create("tenant-a", "order-001")
    same = provisioner.create("tenant-a", "order-001")
    other_tenant = provisioner.create("tenant-b", "order-001")

    assert same is first, "repeated tenant + key must return the existing job"
    assert other_tenant is not first, "the same idempotency key must be isolated by tenant"
    assert first.job_id != other_tenant.job_id

    print("PROVISIONER_TENANT_IDEMPOTENCY_SCOPE: PASS")


if __name__ == "__main__":
    main()
