export interface Env {
  DB?: D1Database;
}

type Booking = {
  id: string;
  businessId: string;
  serviceId: string;
  customerName: string;
  customerEmail: string;
  startsAt: string;
  endsAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, product: 'IZAKHONO BOOKING', release_candidate: true, public_live: false });
    }

    if (request.method === 'POST' && url.pathname === '/api/bookings') {
      const body = await request.json<Partial<Booking>>();
      const required = ['businessId', 'serviceId', 'customerName', 'customerEmail', 'startsAt', 'endsAt'];
      const missing = required.filter((key) => !body[key as keyof Booking]);
      if (missing.length) return json({ error: 'missing_fields', fields: missing }, 400);

      const booking: Booking = {
        id: crypto.randomUUID(),
        businessId: body.businessId!,
        serviceId: body.serviceId!,
        customerName: body.customerName!,
        customerEmail: body.customerEmail!,
        startsAt: body.startsAt!,
        endsAt: body.endsAt!,
        status: 'pending'
      };

      if (env.DB) {
        await env.DB.prepare(`INSERT INTO bookings (id,business_id,service_id,customer_name,customer_email,starts_at,ends_at,status) VALUES (?,?,?,?,?,?,?,?)`)
          .bind(booking.id, booking.businessId, booking.serviceId, booking.customerName, booking.customerEmail, booking.startsAt, booking.endsAt, booking.status)
          .run();
      }
      return json({ booking }, 201);
    }

    if (request.method === 'GET' && url.pathname === '/api/dashboard/summary') {
      if (!env.DB) return json({ bookings: 0, confirmed: 0, pending: 0, revenue: 0, source: 'no-database' });
      const row = await env.DB.prepare(`SELECT COUNT(*) bookings, SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) confirmed, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending FROM bookings`).first<Record<string, number>>();
      return json({ ...row, revenue: 0, source: 'd1' });
    }

    return new Response('IZAKHONO BOOKING', { status: 404 });
  }
};
