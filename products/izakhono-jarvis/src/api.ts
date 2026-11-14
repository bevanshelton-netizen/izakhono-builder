export interface JarvisSnapshotDb {
  prepare(sql: string): { all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> };
}

export interface JarvisSnapshotEnv {
  DB: JarvisSnapshotDb;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Read-only first-party portfolio snapshot.
 * Authentication is deliberately delegated to the existing Builder owner guard.
 */
export async function jarvisExecutiveSnapshotRoute(
  req: Request,
  env: JarvisSnapshotEnv,
  ownerAuthorized: () => Promise<boolean>,
): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== "/api/jarvis/executive-snapshot") return null;
  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: "GET", "cache-control": "no-store" },
    });
  }
  if (!(await ownerAuthorized())) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    const result = await env.DB.prepare(
      "SELECT status, COUNT(*) AS total FROM builder_projects GROUP BY status"
    ).all<{ status: string; total: number }>();
    const counts: Record<string, number> = {};
    for (const row of result.results || []) {
      if (typeof row.status === "string" && Number.isFinite(Number(row.total))) {
        counts[row.status] = Number(row.total);
      }
    }
    const totalProjects = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return json({
      ok: true,
      product: "IZAKHONO J.A.R.V.I.S.",
      snapshot: {
        observed_at: new Date().toISOString(),
        source: "IZAKHONO Builder D1",
        source_status: "available",
        portfolio: {
          total_projects: totalProjects,
          by_status: counts,
        },
        financials: {
          revenue_zar: null,
          cash_position_zar: null,
          status: "unavailable",
          reason: "No reconciled finance adapter is connected to this snapshot.",
        },
        integrations: {
          finance: "not-connected",
          email: "not-connected",
          crm: "not-connected",
          manufacturing: "not-connected",
          education: "not-connected",
        },
      },
      access: "owner-read-only",
    });
  } catch {
    return json({
      ok: false,
      error: "Snapshot source unavailable",
      snapshot: { source: "IZAKHONO Builder D1", source_status: "unavailable" },
    }, 503);
  }
}
