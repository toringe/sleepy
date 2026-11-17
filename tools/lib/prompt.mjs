// Password prompt without echo. SLEEPY_PASSWORD in the environment skips the prompt.
import { normalizePassword } from '../../js/crypto.js';

function readHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error('No terminal for the password prompt. Set SLEEPY_PASSWORD instead.'));
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const done = (fn, arg) => { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); stdout.write('\n'); fn(arg); };
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(resolve, value);
        if (ch === '\u0003') return done(reject, new Error('Cancelled'));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

export async function askPassword(question, { confirm = false } = {}) {
  if (process.env.SLEEPY_PASSWORD) return normalizePassword(process.env.SLEEPY_PASSWORD);
  const first = normalizePassword(await readHidden(question));
  if (!first) { console.error('Password cannot be empty.'); process.exit(1); }
  if (confirm) {
    const second = normalizePassword(await readHidden('Repeat password: '));
    if (first !== second) { console.error('Passwords do not match.'); process.exit(1); }
  }
  return first;
}
