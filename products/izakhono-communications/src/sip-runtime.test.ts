import { OwnedSipRuntimeCarrier, SimulatorSipRuntime } from "./sip-runtime";

async function run() {
  const runtime = new SimulatorSipRuntime();
  const carrier = new OwnedSipRuntimeCarrier(
    runtime,
    async (query) => [`+270100${query.replace(/\D/g, "").slice(-4).padStart(4, "0")}`],
    {
      reserve: async () => undefined,
      release: async () => undefined,
    },
  );

  const numbers = await carrier.searchNumbers("0111234567");
  if (numbers.length !== 1 || numbers[0] !== "+2701004567") throw new Error("number_search_failed");

  const credential = await carrier.createSipCredential("1001");
  if (credential.username !== "ext-1001") throw new Error("credential_username_failed");

  await carrier.configureInboundRoute("+2701004567", "ext:1001");
  await carrier.configureOutboundRoute("ext:1001", "pstn");

  const health = await carrier.healthCheck();
  if (!health.healthy) throw new Error("runtime_health_failed");

  console.log("owned SIP runtime bridge test: PASS");
}

void run();
