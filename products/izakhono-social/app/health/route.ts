export async function GET() {
  return Response.json({
    ok: true,
    service: 'IZAKHONO SOCIAL',
    version: '0.1.0',
    tracking: false,
  });
}
