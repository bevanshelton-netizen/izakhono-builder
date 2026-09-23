export async function GET() {
  return Response.json({
    ok: true,
    service: 'CONNECTA',
    version: '0.1.0',
    tracking: false,
  });
}
