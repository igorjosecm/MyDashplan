/**
 * Worker único: API Hono em /api/* + Static Assets (build do Vite) para o resto.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { rotasBackup } from './rotas/backup.ts';
import { rotasFechamentos } from './rotas/fechamentos.ts';
import { rotasFuturo } from './rotas/futuro.ts';
import { rotasPatrimonio } from './rotas/patrimonio.ts';
import { rotasPerfil } from './rotas/perfil.ts';
import { hojeLocal } from './repo.ts';

const api = new Hono<{ Bindings: Env }>();

api.get('/health', (c) => c.json({ ok: true, hoje: hojeLocal() }));
api.route('/', rotasPerfil);
api.route('/', rotasFuturo);
api.route('/', rotasPatrimonio);
api.route('/', rotasFechamentos);
api.route('/', rotasBackup);

api.notFound((c) => c.json({ erro: 'Rota não encontrada.' }, 404));

api.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ erro: err.message }, err.status);
  if (err instanceof RangeError) return c.json({ erro: err.message }, 400);
  console.error(err);
  const msg = String((err as Error).message ?? err);
  if (/no such table/i.test(msg)) {
    return c.json({ erro: 'Banco sem schema. Rode `npm run db:migrate:local` (ou db:seed:local).' }, 500);
  }
  return c.json({ erro: 'Erro interno.', detalhe: msg }, 500);
});

const app = new Hono<{ Bindings: Env }>();
app.route('/api', api);

export default app;
