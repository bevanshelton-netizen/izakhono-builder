#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MANIFEST="$ROOT/infra/node-cluster/connecta-runtime.yaml"
[[ -f "$MANIFEST" ]] || { echo "[BLOCKED] CONNECTA K3s runtime manifest is missing" >&2; exit 1; }
command -v ruby >/dev/null 2>&1 || { echo "[BLOCKED] Ruby is required for YAML validation" >&2; exit 1; }

ruby - "$MANIFEST" <<'RUBY'
require 'yaml'
path = ARGV.fetch(0)
docs = YAML.load_stream(File.read(path)).compact
fail_with = ->(message) { warn "[BLOCKED] #{message}"; exit 1 }

deployments = docs.select { |doc| doc['kind'] == 'Deployment' }
expected = %w[NODE01 NODE02 NODE03 NODE04]
nodes = deployments.map { |doc| doc.dig('metadata', 'labels', 'izakhono.africa/logical-node') }.compact
fail_with.call('exactly four logical node deployments are required') unless nodes.sort == expected.sort

deployments.each do |deployment|
  node = deployment.dig('metadata', 'labels', 'izakhono.africa/logical-node')
  name = node.downcase
  fail_with.call("#{node} must have exactly one replica") unless deployment.dig('spec', 'replicas') == 1
  pod = deployment.dig('spec', 'template', 'spec')
  fail_with.call("#{node} must not bind to a physical host with nodeSelector") if pod.key?('nodeSelector')
  fail_with.call("#{node} must disable service-account token automount") unless pod['automountServiceAccountToken'] == false
  fail_with.call("#{node} must use the CONNECTA service account") unless pod['serviceAccountName'] == 'connecta-engine'
  container = pod.fetch('containers').find { |item| item['name'] == 'engine' }
  fail_with.call("#{node} engine container missing") unless container
  fail_with.call("#{node} image must use the canonical CONNECTA ENGINE release") unless container['image'] == 'ghcr.io/bevanshelton-netizen/connecta-engine:0.3.0'
  env = container.fetch('env').to_h { |item| [item['name'], item] }
  required = %w[DATABASE_URL CONNECTA_OWNER_KEY IZAKHONO_NODE_ID IZAKHONO_CLUSTER_ID IZAKHONO_NODE_HEALTH_TOKEN CONNECTA_STORAGE_DRIVER CONNECTA_S3_ENDPOINT CONNECTA_S3_BUCKET CONNECTA_S3_ACCESS_KEY_ID CONNECTA_S3_SECRET_ACCESS_KEY]
  missing = required.reject { |key| env.key?(key) }
  fail_with.call("#{node} missing environment keys: #{missing.join(', ')}") unless missing.empty?
  fail_with.call("#{node} logical identity is not pinned to its own deployment") unless env.dig('IZAKHONO_NODE_ID', 'value') == node
  fail_with.call("#{node} must use the canonical cluster id") unless env.dig('IZAKHONO_CLUSTER_ID', 'value') == 'izakhono-production'
  fail_with.call("#{node} must use shared S3-compatible storage") unless env.dig('CONNECTA_STORAGE_DRIVER', 'value') == 's3'
  token_key = env.dig('IZAKHONO_NODE_HEALTH_TOKEN', 'valueFrom', 'secretKeyRef', 'key')
  fail_with.call("#{node} must use its own unique health-token secret key") unless token_key == "#{name}-health-token"
  fail_with.call("#{node} must mount a readiness probe") unless container.dig('readinessProbe', 'httpGet', 'path') == '/health'
  fail_with.call("#{node} must use a non-root, read-only container") unless container.dig('securityContext', 'readOnlyRootFilesystem') == true && container.dig('securityContext', 'allowPrivilegeEscalation') == false
  fail_with.call("#{node} must spread across eligible hosts without binding to a host") unless pod['topologySpreadConstraints']&.any? { |constraint| constraint['whenUnsatisfiable'] == 'ScheduleAnyway' }
end

services = docs.select { |doc| doc['kind'] == 'Service' }
expected_services = %w[connecta-engine connecta-node01-health connecta-node02-health connecta-node03-health connecta-node04-health]
service_names = services.map { |doc| doc.dig('metadata', 'name') }
fail_with.call('customer service and all four node-health services are required') unless (expected_services - service_names).empty?
services.each do |service|
  fail_with.call("#{service.dig('metadata','name')} must remain internal ClusterIP") unless service.dig('spec', 'type') == 'ClusterIP'
end

pdb = docs.find { |doc| doc['kind'] == 'PodDisruptionBudget' && doc.dig('metadata','name') == 'connecta-engine' }
fail_with.call('CONNECTA must preserve at least three of four runtime pods during voluntary disruption') unless pdb&.dig('spec','minAvailable') == 3

sa = docs.find { |doc| doc['kind'] == 'ServiceAccount' && doc.dig('metadata','name') == 'connecta-engine' }
fail_with.call('GHCR image pull secret must be configured on the runtime service account') unless sa&.dig('imagePullSecrets')&.any? { |item| item['name'] == 'ghcr-pull-secret' }

fail_with.call('public Ingress resources must be owned by IZAKHONO EDGE, not this node manifest') if docs.any? { |doc| doc['kind'] == 'Ingress' }
puts '[PASS] CONNECTA four-node K3s runtime manifest is structurally valid, internal-only and logically identified.'
RUBY
