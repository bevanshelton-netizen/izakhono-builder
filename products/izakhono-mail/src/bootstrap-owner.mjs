import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createUser } from './auth.mjs';
import { ensureIdentity } from './mail-core-sqlite.mjs';

const address = (process.env.MAIL_OWNER_IDENTITY || 'bevan@izakhono').toLowerCase();
const displayName = process.env.MAIL_OWNER_DISPLAY_NAME || 'Bevan Shelton';

function readPassword() {
  if (process.env.IZAKHONO_OWNER_PASSWORD) return process.env.IZAKHONO_OWNER_PASSWORD;
  return new Promise(async resolve => {
    const rl = readline.createInterface({ input, output });
    const password = await rl.question(`Create password for ${address}: `, { hideEchoBack: true });
    rl.close();
    resolve(password);
  });
}

try {
  const password = await readPassword();
  if (!password || password.length < 12) throw new Error('Password must be at least 12 characters.');
  ensureIdentity(address);
  const user = createUser({ address, password, displayName });
  console.log(JSON.stringify({ ok: true, address: user.address, next: 'start-webmail-and-sign-in' }));
} catch (error) {
  console.error(`[IZAKHONO MAIL] owner bootstrap failed: ${error.message}`);
  process.exitCode = 1;
}
