#!/usr/bin/env python3
import argparse
import json
import os
import urllib.request
from pathlib import Path

CONTROL_URL = os.getenv("IZAKHONO_CONTROL_URL", "http://127.0.0.1:9292")
TOKEN_FILE = Path(os.getenv("IZAKHONO_CONTROL_TOKEN_FILE", "/etc/izakhono/control.owner-token"))


def owner_token():
    token = os.getenv("IZAKHONO_CONTROL_TOKEN", "").strip()
    if token:
        return token
    if not TOKEN_FILE.is_file():
        raise SystemExit(f"Owner token not found: {TOKEN_FILE}")
    token = TOKEN_FILE.read_text().strip()
    if not token:
        raise SystemExit("Owner token file is empty.")
    return token


def request(method, path, payload=None):
    body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode()
    headers = {"Authorization": f"Bearer {owner_token()}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        CONTROL_URL.rstrip("/") + path,
        data=body,
        method=method,
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read())


def command_node(_args):
    print(json.dumps(request("GET", "/v1/node"), indent=2))


def command_status(_args):
    print(json.dumps(request("GET", "/v1/status"), indent=2))


def command_job(args):
    print(json.dumps(request("GET", f"/v1/jobs/{args.job_id}"), indent=2))


def command_deploy(args):
    profile = json.loads(Path(args.profile).read_text())
    if args.ref:
        profile["ref"] = args.ref
    if profile.get("ref") in (None, "", "__REF__"):
        raise SystemExit("A full deployment ref is required. Use --ref <commit-sha>.")
    if args.public_url:
        profile["public_url"] = args.public_url
    if args.staging:
        profile["environment"] = "staging"
    if args.production:
        profile["environment"] = "production"

    if args.dry_run:
        safe = dict(profile)
        print(json.dumps(safe, indent=2))
        return

    result = request("POST", "/v1/deploy", profile)
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser(prog="izakhonoctl", description="Owner CLI for IZAKHONO CONTROL + NODE")
    sub = parser.add_subparsers(dest="command", required=True)

    node = sub.add_parser("node", help="Show NODE identity and capabilities")
    node.set_defaults(func=command_node)

    status = sub.add_parser("status", help="Show recent deployment jobs")
    status.set_defaults(func=command_status)

    job = sub.add_parser("job", help="Show one deployment job")
    job.add_argument("job_id")
    job.set_defaults(func=command_job)

    deploy = sub.add_parser("deploy", help="Submit a deployment profile")
    deploy.add_argument("profile")
    deploy.add_argument("--ref")
    deploy.add_argument("--public-url")
    deploy.add_argument("--staging", action="store_true")
    deploy.add_argument("--production", action="store_true")
    deploy.add_argument("--dry-run", action="store_true")
    deploy.set_defaults(func=command_deploy)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
