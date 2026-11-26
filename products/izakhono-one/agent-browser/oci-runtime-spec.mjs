const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const DEFAULT_LIMITS = Object.freeze({ memoryBytes: 1024 * 1024 * 1024, cpuQuotaMicros: 100000, cpuPeriodMicros: 100000, pids: 128, wallClockMs: 120000 });

function requireId(value, field) {
  if (typeof value !== "string" || !ID.test(value)) throw new TypeError(`invalid_${field}`);
  return value;
}

function boundedInteger(value, min, max, field) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`invalid_${field}`);
  return value;
}

/**
 * Produces a deterministic hardened OCI launch specification.
 * This does not invoke Docker/Podman/containerd or prove host enforcement.
 * The platform adapter must translate every required field exactly and fail
 * closed when the runtime cannot enforce a requested control.
 */
export function buildBrowserOciSpec({
  sessionId,
  runtimeInstanceId,
  imageDigest,
  egressNetworkId,
  seccompProfileRef,
  limits = {}
} = {}) {
  requireId(sessionId, "session_id");
  requireId(runtimeInstanceId, "runtime_instance_id");
  requireId(egressNetworkId, "egress_network_id");
  requireId(seccompProfileRef, "seccomp_profile_ref");
  if (typeof imageDigest !== "string" || !DIGEST.test(imageDigest)) throw new TypeError("image_must_be_pinned_sha256_digest");

  const resourceLimits = {
    memoryBytes: boundedInteger(limits.memoryBytes ?? DEFAULT_LIMITS.memoryBytes, 256 * 1024 * 1024, 4 * 1024 * 1024 * 1024, "memory_limit"),
    cpuQuotaMicros: boundedInteger(limits.cpuQuotaMicros ?? DEFAULT_LIMITS.cpuQuotaMicros, 10000, 400000, "cpu_quota"),
    cpuPeriodMicros: boundedInteger(limits.cpuPeriodMicros ?? DEFAULT_LIMITS.cpuPeriodMicros, 100000, 1000000, "cpu_period"),
    pids: boundedInteger(limits.pids ?? DEFAULT_LIMITS.pids, 32, 512, "pids_limit"),
    wallClockMs: boundedInteger(limits.wallClockMs ?? DEFAULT_LIMITS.wallClockMs, 1000, 300000, "wall_clock_limit")
  };

  return Object.freeze({
    version: "izakhono.browser.oci.v1",
    identity: Object.freeze({ sessionId, runtimeInstanceId }),
    image: Object.freeze({ digest: imageDigest, pullPolicy: "never-unpinned" }),
    process: Object.freeze({
      user: Object.freeze({ uid: 10001, gid: 10001, additionalGids: Object.freeze([]) }),
      args: Object.freeze(["/usr/bin/chromium", "--headless=new", "--remote-debugging-pipe", "about:blank"]),
      env: Object.freeze(["LANG=C.UTF-8", "HOME=/home/browser"]),
      noNewPrivileges: true,
      terminal: false
    }),
    root: Object.freeze({ readOnly: true }),
    mounts: Object.freeze([
      Object.freeze({ type: "tmpfs", destination: "/tmp", sizeBytes: 128 * 1024 * 1024, options: Object.freeze(["nosuid", "nodev"]) }),
      Object.freeze({ type: "tmpfs", destination: "/home/browser", sizeBytes: 128 * 1024 * 1024, options: Object.freeze(["nosuid", "nodev"]) }),
      Object.freeze({ type: "tmpfs", destination: "/dev/shm", sizeBytes: 128 * 1024 * 1024, options: Object.freeze(["nosuid", "nodev"]) })
    ]),
    namespaces: Object.freeze(["mount", "pid", "ipc", "uts", "user", "network"]),
    network: Object.freeze({
      mode: "isolated-proxy-only",
      networkId: egressNetworkId,
      directEgress: false,
      directDns: false,
      proxyOnly: true
    }),
    linux: Object.freeze({
      capabilities: Object.freeze({ bounding: Object.freeze([]), effective: Object.freeze([]), inheritable: Object.freeze([]), permitted: Object.freeze([]), ambient: Object.freeze([]) }),
      noNewPrivileges: true,
      seccompProfileRef,
      maskedPaths: Object.freeze(["/proc/kcore", "/proc/keys", "/proc/timer_list"]),
      readOnlyPaths: Object.freeze(["/proc/bus", "/proc/fs", "/proc/irq", "/proc/sys", "/proc/sysrq-trigger"])
    }),
    resources: Object.freeze(resourceLimits),
    lifecycle: Object.freeze({
      uniqueProfilePerSession: true,
      killEntireProcessTree: true,
      destroyWritableMountsOnExit: true,
      closeBridgeOnExit: true,
      quarantineOnUnconfirmedCleanup: true,
      retries: 0
    })
  });
}

export function validateBrowserOciSpec(spec) {
  if (!spec || spec.version !== "izakhono.browser.oci.v1") return { ok: false, reason: "unsupported_spec_version" };
  if (spec.root?.readOnly !== true || spec.process?.noNewPrivileges !== true ||
      spec.linux?.noNewPrivileges !== true || spec.network?.directEgress !== false ||
      spec.network?.directDns !== false || spec.network?.proxyOnly !== true ||
      spec.network?.mode !== "isolated-proxy-only") return { ok: false, reason: "required_isolation_control_missing" };
  if (spec.process?.user?.uid === 0 || spec.process?.user?.gid === 0) return { ok: false, reason: "root_user_forbidden" };
  if (!Array.isArray(spec.mounts) || spec.mounts.some(mount => mount.type !== "tmpfs" ||
      typeof mount.destination !== "string" || !mount.destination.startsWith("/"))) {
    return { ok: false, reason: "host_mount_forbidden" };
  }
  if (!Array.isArray(spec.namespaces) || !["mount", "pid", "ipc", "uts", "user", "network"].every(ns => spec.namespaces.includes(ns))) {
    return { ok: false, reason: "namespace_isolation_incomplete" };
  }
  if (!Array.isArray(spec.linux?.capabilities?.bounding) || spec.linux.capabilities.bounding.length !== 0 ||
      !Array.isArray(spec.linux?.capabilities?.effective) || spec.linux.capabilities.effective.length !== 0) {
    return { ok: false, reason: "capabilities_must_be_dropped" };
  }
  if (!DIGEST.test(spec.image?.digest ?? "") || spec.image.pullPolicy !== "never-unpinned") {
    return { ok: false, reason: "image_digest_not_pinned" };
  }
  if (spec.lifecycle?.retries !== 0 || spec.lifecycle?.killEntireProcessTree !== true ||
      spec.lifecycle?.destroyWritableMountsOnExit !== true || spec.lifecycle?.quarantineOnUnconfirmedCleanup !== true) {
    return { ok: false, reason: "unsafe_runtime_lifecycle" };
  }
  return { ok: true };
}
