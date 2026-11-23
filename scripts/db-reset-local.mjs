// Zera o banco LOCAL (D1/miniflare) para testar o Onboarding do zero:
// aplica migrações pendentes e apaga todos os dados do usuário (mantém a taxonomia de categorias).
import { spawnSync } from 'node:child_process';

const run = (args) => {
  // Comando único (sem args separados) — evita o aviso DEP0190 do Node com shell: true.
  const r = spawnSync(`npx wrangler ${args.join(' ')}`, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run(['d1', 'migrations', 'apply', 'DB', '--local']);
run(['d1', 'execute', 'DB', '--local', '--file=./scripts/sql/reset_local.sql']);
console.log('\n✔ Banco local zerado. Rode `npm run dev` e abra http://localhost:5173 para ver o Onboarding.');
