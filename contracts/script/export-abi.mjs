// Copies ABIs from forge `out/` to web/src/chain/abi/. Falls back to the interface ABI until the contract exists.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, '..', 'web', 'src', 'chain', 'abi');
mkdirSync(dest, { recursive: true });

for (const name of ['MonsGame', 'MonsParts', 'MonsCommunity']) {
  const impl = join(root, 'out', `${name}.sol`, `${name}.json`);
  const iface = join(root, 'out', `I${name}.sol`, `I${name}.json`);
  const src = existsSync(impl) ? impl : iface;
  if (!existsSync(src)) throw new Error(`missing build output for ${name}; run forge build`);
  const { abi } = JSON.parse(readFileSync(src, 'utf8'));
  writeFileSync(join(dest, `${name}.json`), JSON.stringify(abi, null, 2) + '\n');
  console.log(`${name}.json <- ${src === impl ? name : 'I' + name} (${abi.length} items)`);
}
