import { RuntimeReconciler } from "./runtime-reconciler";
import { SimulatorSipRuntime } from "./sip-runtime";

async function run() {
  const runtime = new SimulatorSipRuntime();
  const reconciler = new RuntimeReconciler(runtime);

  const desired = {
    extensions: [{ extension: "1001", username: "ext-1001", secretRef: "secret://sip/1001" }],
    inboundRoutes: [{ number: "+2701004567", destination: "ext:1001" }],
    outboundRoutes: [{ source: "ext:1001", destination: "pstn" }],
  };

  const first = await reconciler.reconcile(desired);
  if (first.applied !== 3) throw new Error("first_reconcile_failed");

  const second = await reconciler.reconcile(desired);
  if (second.applied !== 3) throw new Error("idempotent_reconcile_failed");

  await assertRejects(
    () => reconciler.reconcile({ ...desired, extensions: [...desired.extensions, desired.extensions[0]] }),
    "duplicate_runtime_extension",
  );

  await assertRejects(
    () => reconciler.reconcile({ ...desired, inboundRoutes: [{ number: "", destination: "ext:1001" }] }),
    "invalid_runtime_inbound_route",
  );

  console.log("runtime reconciliation test: PASS");
}

async function assertRejects(operation: () => Promise<unknown>, expected: string) {
  try {
    await operation();
    throw new Error(`expected_${expected}`);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== expected) throw error;
  }
}

void run();
