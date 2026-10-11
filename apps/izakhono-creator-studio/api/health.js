export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: 'izakhono-creator-studio',
    controlPlane: 'IZAKHONO PROVISIONER',
    deploymentModel: 'owned-first',
    version: '1.0.0'
  });
}
