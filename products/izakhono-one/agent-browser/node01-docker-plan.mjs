import { createHash } from "node:crypto";

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;
const SHA256_IMAGE = /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/;

function id(value, field) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new TypeError(`invalid_${field}`);
  return value;
}
function int(value, min, max, field) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`invalid_${field}`);
  return value;
}
function linuxAbsolutePath(value, field) {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\0") ||
      value.split("/").includes("..") || value.length > 240) throw new TypeError(`invalid_${field}`);
  return value;
}
function containerName(sessionId, runtimeId) {
  const suffix = createHash("sha256").update(`${sessionId}:${runtimeId}`).digest("hex").slice(0, 40);
  return `iz1-browser-${suffix}`;
}

/**
 * Produces argv-only Docker Engine commands for NODE01's WSL2 Ubuntu host.
 * No shell string is generated and no Docker command is executed here.
 * The caller must use spawn(file, argv, { shell:false }) and a trusted Docker
 * socket/CLI boundary. Network and seccomp prerequisites must be attested
 * before create/start is allowed.
 */
export function buildNode01DockerPlan({
  sessionId,
  runtimeInstanceId,
  imageReference,
  isolatedNetworkName,
  proxyHost,
  proxyPort = 3128,
  seccompProfilePath = "/etc/izakhono/seccomp/browser-v1.json",
  memoryBytes = 1024 * 1024 * 1024,
  cpuQuotaMicros = 100000,
  cpuPeriodMicros = 100000,
  pidsLimit = 128,
  tmpfsBytes = 128 * 1024 * 1024
} = {}) {
  id(sessionId, "session_id");
  id(runtimeInstanceId, "runtime_instance_id");
  id(isolatedNetworkName, "isolated_network_name");
  id(proxyHost, "proxy_host");
  linuxAbsolutePath(seccompProfilePath, "seccomp_profile_path");
  if (typeof imageReference !== "string" || !SHA256_IMAGE.test(imageReference)) {
    throw new TypeError("browser_image_must_be_digest_pinned");
  }
  int(proxyPort, 1, 65535, "proxy_port");
  int(memoryBytes, 256 * 1024 * 1024, 4 * 1024 * 1024 * 1024, "memory_bytes");
  int(cpuQuotaMicros, 10000, 400000, "cpu_quota");
  int(cpuPeriodMicros, 100000, 1000000, "cpu_period");
  int(pidsLimit, 32, 512, "pids_limit");
  int(tmpfsBytes, 16 * 1024 * 1024, 512 * 1024 * 1024, "tmpfs_bytes");

  const name = containerName(sessionId, runtimeInstanceId);
  const labels = [
    "izakhono.managed=true",
    "izakhono.component=one-browser",
    `izakhono.session=${sessionId}`,
    `izakhono.runtime=${runtimeInstanceId}`
  ];
  const create = [
    "create", "--name", name,
    "--pull=never",
    "--label", labels[0], "--label", labels[1], "--label", labels[2], "--label", labels[3],
    "--read-only",
    "--user", "10001:10001",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--security-opt", `seccomp=${seccompProfilePath}`,
    "--pids-limit", String(pidsLimit),
    "--memory", String(memoryBytes),
    "--cpu-period", String(cpuPeriodMicros),
    "--cpu-quota", String(cpuQuotaMicros),
    "--tmpfs", `/tmp:rw,nosuid,nodev,size=${tmpfsBytes}`,
    "--tmpfs", `/home/browser:rw,nosuid,nodev,size=${tmpfsBytes}`,
    "--tmpfs", `/dev/shm:rw,nosuid,nodev,size=${tmpfsBytes}`,
    "--ipc", "private",
    "--cgroupns", "private",
    "--network", isolatedNetworkName,
    "--restart", "no",
    "--init",
    "--stop-timeout", "2",
    "--log-driver", "none",
    "--env", "HOME=/home/browser",
    "--env", "LANG=C.UTF-8",
    "--env", "TZ=UTC",
    imageReference,
    "/usr/bin/chromium",
    "--headless=new",
    "--remote-debugging-pipe",
    `--proxy-server=http://${proxyHost}:${proxyPort}`,
    "--disable-quic",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ];

  return Object.freeze({
    platform: "NODE01-WINDOWS-WSL2-UBUNTU-DOCKER-ENGINE",
    containerName: name,
    networkPrerequisite: Object.freeze({
      networkName: isolatedNetworkName,
      mustBeInternal: true,
      onlyPeer: "approved-egress-proxy",
      proxyHost,
      proxyPort,
      directInternetFromBrowser: false,
      directDnsFromBrowser: false,
      independentlyAttested: true
    }),
    seccompPrerequisite: Object.freeze({ profilePath: seccompProfilePath, mustBeInstalledAndReviewed: true }),
    daemonPrerequisite: Object.freeze({ userNamespaceRemapping: "rootless-or-userns-remap", cgroupVersion: "v2", seccompEnabled: true }),
    createArgv: Object.freeze(create),
    startArgv: Object.freeze(["start", name]),
    inspectArgv: Object.freeze(["inspect", "--format", "{{.State.Running}}", name]),
    killArgv: Object.freeze(["kill", name]),
    removeArgv: Object.freeze(["rm", "--force", name]),
    executionRules: Object.freeze({
      executable: "docker",
      shell: false,
      timeoutMs: 15000,
      retries: 0,
      captureStdoutBytes: 4096,
      captureStderrBytes: 4096
    })
  });
}

export function validateNode01DockerPlan(plan) {
  if (!plan || plan.platform !== "NODE01-WINDOWS-WSL2-UBUNTU-DOCKER-ENGINE") {
    return { ok: false, reason: "unsupported_node01_runtime_platform" };
  }
  if (plan.executionRules?.shell !== false || plan.executionRules?.retries !== 0 ||
      plan.executionRules?.executable !== "docker") return { ok: false, reason: "unsafe_command_execution_policy" };
  const argv = plan.createArgv;
  if (!Array.isArray(argv) || argv.some(arg => typeof arg !== "string" || arg.includes("\0"))) {
    return { ok: false, reason: "invalid_docker_argv" };
  }
  for (const required of ["--read-only", "--cap-drop", "ALL", "--user", "10001:10001",
    "--network", plan.networkPrerequisite.networkName, "--pull=never", "--init"]) {
    if (!argv.includes(required)) return { ok: false, reason: "required_docker_hardening_missing" };
  }
  const forbidden = new Set(["-v", "--volume", "--mount", "--privileged", "--cap-add", "--device", "--publish", "-p", "--add-host", "--dns", "--env-file", "--entrypoint", "--network=host", "--pid=host", "--ipc=host", "--uts=host", "--userns=host", "--security-opt=seccomp=unconfined", "--read-only=false"]);
  if (argv.some(arg => arg === "-v" || arg === "--volume" || arg === "--mount" || arg.startsWith("--mount=") || arg.startsWith("--volume="))) {
    return { ok: false, reason: "host_mount_forbidden" };
  }
  if (argv.some(arg => forbidden.has(arg) || arg.startsWith("--device=") || arg.startsWith("--cap-add=") || arg.startsWith("--privileged=") || arg.startsWith("--network=")) ||
      argv.includes("seccomp=unconfined") || argv.includes("no-new-privileges:false")) {
    return { ok: false, reason: "unsafe_container_override" };
  }
  if (argv.filter(arg => arg === "--network").length !== 1 || argv[argv.indexOf("--network") + 1] !== plan.networkPrerequisite.networkName) {
    return { ok: false, reason: "network_argument_mismatch" };
  }
  if (plan.daemonPrerequisite?.userNamespaceRemapping !== "rootless-or-userns-remap" || plan.daemonPrerequisite?.cgroupVersion !== "v2" || plan.daemonPrerequisite?.seccompEnabled !== true) {
    return { ok: false, reason: "daemon_hardening_prerequisite_missing" };
  }
  if (plan.networkPrerequisite.mustBeInternal !== true ||
      plan.networkPrerequisite.onlyPeer !== "approved-egress-proxy" ||
      plan.networkPrerequisite.directInternetFromBrowser !== false ||
      plan.networkPrerequisite.directDnsFromBrowser !== false ||
      plan.networkPrerequisite.independentlyAttested !== true) {
    return { ok: false, reason: "network_prerequisite_not_isolated" };
  }
  return { ok: true };
}
