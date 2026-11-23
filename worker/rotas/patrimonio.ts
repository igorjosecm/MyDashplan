import { Hono } from 'hono';
import { z } from 'zod';
import type { Conta, Snapshot } from '../../shared/types.ts';
import { agoraISO, atualizarCachesPlano, calcularPatrimonio, hojeLocal, lerBens, lerContas, lerDividas, perguntaOnb1, type DB } from '../repo.ts';
import { idParam, naoEncontrado, requisicaoInvalida, stmtAjuste, stmtSnapshot, stmtUpdate } from '../util.ts';
import { corpo, zBem, zBemParcial, zCentavos, zConta, zContaParcial, zData, zDivida, zDividaParcial, zSnapshot } from '../validacao.ts';

export const rotasPatrimonio = new Hono<{ Bindings: Env }>();

/** Após mudar saldos: recalcula caches do Meu Futuro e informa se ONB-1 deve perguntar. */
async function posMudancaSaldo(db: DB) {
  const hoje = hojeLocal();
  await atualizarCachesPlano(db, hoje);
  return perguntaOnb1(db, hoje);
}

rotasPatrimonio.get('/patrimony', async (c) => {
  const hoje = hojeLocal();
  const data = c.req.query('data');
  if (data && !zData.safeParse(data).success) requisicaoInvalida('Data inválida.');
  return c.json(await calcularPatrimonio(c.env.DB, data ?? hoje, hoje));
});

// ─────────────────────────── Contas ───────────────────────────

async function idInstituicao(db: DB, nome: string | null | undefined): Promise<number | null> {
  const n = nome?.trim();
  if (!n) return null;
  const ex = await db.prepare('SELECT id FROM institutions WHERE lower(nome) = lower(?)').bind(n).first<{ id: number }>();
  if (ex) return ex.id;
  const r = await db.prepare('INSERT INTO institutions (nome) VALUES (?) RETURNING id').bind(n).first<{ id: number }>();
  return r!.id;
}

async function lerConta(db: DB, id: number): Promise<Conta> {
  const c = (await lerContas(db, hojeLocal())).find((x) => x.id === id);
  return c ?? naoEncontrado('Conta');
}

rotasPatrimonio.get('/accounts', async (c) => c.json(await lerContas(c.env.DB, hojeLocal())));

rotasPatrimonio.post('/accounts', corpo(zConta), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  const cartao = b.tipo === 'cartao';
  const investe = b.tipo === 'investimento' || b.tipo === 'previdencia' || b.tipo === 'poupanca';
  // Defaults de §3.1: detalhado p/ corrente e cartão; so_saldo p/ investimentos. Cartão nunca entra no PL.
  const modo = cartao ? 'detalhado' : (b.modo_controle ?? (investe ? 'so_saldo' : 'detalhado'));
  const noPl = cartao ? 0 : (b.conta_no_pl ?? (investe ? 1 : 0));
  const inst = await idInstituicao(db, b.instituicao_nome);
  const r = await db
    .prepare(
      `INSERT INTO accounts (institution_id, nome, tipo, modo_controle, conta_no_pl, saldo_inicial_centavos, data_ancora,
         proprietario, dia_fechamento, dia_vencimento, limite_centavos, ordem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT IFNULL(MAX(ordem), 0) + 1 FROM accounts)) RETURNING id`,
    )
    .bind(
      inst,
      b.nome,
      b.tipo,
      modo,
      noPl,
      b.saldo_inicial_centavos,
      b.data_ancora ?? hojeLocal(),
      b.proprietario,
      cartao ? (b.dia_fechamento ?? null) : null,
      cartao ? (b.dia_vencimento ?? null) : null,
      cartao ? (b.limite_centavos ?? null) : null,
    )
    .first<{ id: number }>();
  const onb1 = await posMudancaSaldo(db);
  return c.json({ conta: await lerConta(db, r!.id), onb1 }, 201);
});

rotasPatrimonio.put('/accounts/:id', corpo(zContaParcial), async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  const atual = await lerConta(db, id);
  const { instituicao_nome, ...b } = c.req.valid('json');
  const campos: Record<string, unknown> = { ...b };
  if (instituicao_nome !== undefined) campos.institution_id = await idInstituicao(db, instituicao_nome);
  if (atual.tipo === 'cartao') {
    campos.conta_no_pl = 0;
    campos.modo_controle = 'detalhado';
  }
  const st = stmtUpdate(
    db,
    'accounts',
    campos,
    ['nome', 'institution_id', 'modo_controle', 'conta_no_pl', 'ativa', 'proprietario', 'dia_fechamento', 'dia_vencimento', 'limite_centavos'],
    'id = ?',
    [id],
    [`atualizado_em = '${agoraISO()}'`],
  );
  if (st) await st.run();
  const onb1 = await posMudancaSaldo(db);
  return c.json({ conta: await lerConta(db, id), onb1 });
});

rotasPatrimonio.delete('/accounts/:id', async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  await lerConta(db, id);
  await db.batch([
    db.prepare("DELETE FROM balance_snapshots WHERE alvo_tipo = 'conta' AND alvo_id = ?").bind(id),
    db.prepare('DELETE FROM accounts WHERE id = ?').bind(id),
  ]);
  await posMudancaSaldo(db);
  return c.json({ ok: true });
});

/**
 * Atualizar/conferir saldo de uma conta (§3.3):
 *  - so_saldo  → grava SaldoSnapshot;
 *  - detalhado → cria lançamento de ajuste "Não rastreado" com a diferença.
 */
rotasPatrimonio.post(
  '/accounts/:id/saldo',
  corpo(z.object({ saldo_centavos: zCentavos, data: zData.optional() }).strict()),
  async (c) => {
    const db = c.env.DB;
    const id = idParam(c.req.param('id'));
    const { saldo_centavos, data } = c.req.valid('json');
    const hoje = hojeLocal();
    const d = data ?? hoje;
    if (d > hoje) requisicaoInvalida('Saldo não pode ter data futura.');
    const conta = (await lerContas(db, d)).find((x) => x.id === id) ?? naoEncontrado('Conta');
    if (d < conta.data_ancora) requisicaoInvalida(`Data anterior à abertura da conta (${conta.data_ancora}).`);
    let diferenca = 0;
    if (conta.modo_controle === 'so_saldo') {
      await stmtSnapshot(db, 'conta', id, d, saldo_centavos, 'manual').run();
    } else {
      diferenca = saldo_centavos - conta.saldo_centavos;
      if (diferenca !== 0) await stmtAjuste(db, id, d, diferenca, `Ajuste de conferência de saldo — ${conta.nome}`, null).run();
    }
    const onb1 = await posMudancaSaldo(db);
    return c.json({ conta: await lerConta(db, id), diferenca_centavos: diferenca, onb1 });
  },
);

// ─────────────────────────── Bens ───────────────────────────

rotasPatrimonio.get('/assets', async (c) => c.json(await lerBens(c.env.DB, hojeLocal())));

rotasPatrimonio.post('/assets', corpo(zBem), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  const r = await db
    .prepare('INSERT INTO assets (nome, classe, categoria, proprietario, atualizar_mensalmente) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(b.nome, b.classe, b.categoria, b.proprietario, b.atualizar_mensalmente)
    .first<{ id: number }>();
  await stmtSnapshot(db, 'bem', r!.id, b.data ?? hojeLocal(), b.valor_centavos, 'manual').run();
  await posMudancaSaldo(db);
  return c.json((await lerBens(db, hojeLocal())).find((x) => x.id === r!.id), 201);
});

rotasPatrimonio.put('/assets/:id', corpo(zBemParcial), async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  const st = stmtUpdate(db, 'assets', c.req.valid('json'), ['nome', 'classe', 'categoria', 'proprietario', 'atualizar_mensalmente', 'ativo'], 'id = ?', [id]);
  if (st) {
    const r = await st.run();
    if (!r.meta.changes) naoEncontrado('Bem');
  }
  await posMudancaSaldo(db);
  return c.json((await lerBens(db, hojeLocal())).find((x) => x.id === id) ?? naoEncontrado('Bem'));
});

rotasPatrimonio.delete('/assets/:id', async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  await db.batch([
    db.prepare("DELETE FROM balance_snapshots WHERE alvo_tipo = 'bem' AND alvo_id = ?").bind(id),
    db.prepare('DELETE FROM assets WHERE id = ?').bind(id),
  ]);
  await posMudancaSaldo(db);
  return c.json({ ok: true });
});

// ─────────────────────────── Dívidas ───────────────────────────

rotasPatrimonio.get('/debts', async (c) => c.json(await lerDividas(c.env.DB, hojeLocal())));

rotasPatrimonio.post('/debts', corpo(zDivida), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  const r = await db
    .prepare(
      `INSERT INTO debts (nome, tipo, asset_id, total_tomado_centavos, taxa_juros_anual, proprietario, atualizar_mensalmente)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(b.nome, b.tipo, b.asset_id ?? null, b.total_tomado_centavos ?? null, b.taxa_juros_anual ?? null, b.proprietario, b.atualizar_mensalmente)
    .first<{ id: number }>();
  await stmtSnapshot(db, 'divida', r!.id, b.data ?? hojeLocal(), b.saldo_devedor_centavos, 'manual').run();
  await posMudancaSaldo(db);
  return c.json((await lerDividas(db, hojeLocal())).find((x) => x.id === r!.id), 201);
});

rotasPatrimonio.put('/debts/:id', corpo(zDividaParcial), async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  const st = stmtUpdate(
    db,
    'debts',
    c.req.valid('json'),
    ['nome', 'tipo', 'asset_id', 'total_tomado_centavos', 'taxa_juros_anual', 'proprietario', 'atualizar_mensalmente', 'ativo'],
    'id = ?',
    [id],
  );
  if (st) {
    const r = await st.run();
    if (!r.meta.changes) naoEncontrado('Dívida');
  }
  await posMudancaSaldo(db);
  return c.json((await lerDividas(db, hojeLocal())).find((x) => x.id === id) ?? naoEncontrado('Dívida'));
});

rotasPatrimonio.delete('/debts/:id', async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  await db.batch([
    db.prepare("DELETE FROM balance_snapshots WHERE alvo_tipo = 'divida' AND alvo_id = ?").bind(id),
    db.prepare('DELETE FROM debts WHERE id = ?').bind(id),
  ]);
  await posMudancaSaldo(db);
  return c.json({ ok: true });
});

// ─────────────────────────── Snapshots ───────────────────────────

const TABELA_ALVO = { conta: 'accounts', bem: 'assets', divida: 'debts' } as const;

rotasPatrimonio.get('/snapshots', async (c) => {
  const tipo = c.req.query('alvo_tipo');
  const id = c.req.query('alvo_id');
  let q = 'SELECT id, alvo_tipo, alvo_id, data, valor_centavos, origem, closing_id, observacao FROM balance_snapshots';
  const args: unknown[] = [];
  if (tipo) {
    q += ' WHERE alvo_tipo = ?';
    args.push(tipo);
    if (id) {
      q += ' AND alvo_id = ?';
      args.push(idParam(id));
    }
  }
  q += ' ORDER BY data DESC, id DESC LIMIT 500';
  const r = await c.env.DB.prepare(q).bind(...args).all<Snapshot>();
  return c.json(r.results);
});

rotasPatrimonio.post('/snapshots', corpo(zSnapshot), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  const hoje = hojeLocal();
  const data = b.data ?? hoje;
  if (data > hoje) requisicaoInvalida('Snapshot não pode ter data futura.');
  const alvo = await db.prepare(`SELECT * FROM ${TABELA_ALVO[b.alvo_tipo]} WHERE id = ?`).bind(b.alvo_id).first<Record<string, unknown>>();
  if (!alvo) naoEncontrado('Item');
  if (b.alvo_tipo === 'conta' && alvo!.modo_controle !== 'so_saldo') {
    requisicaoInvalida('Conta em modo detalhado: use POST /api/accounts/:id/saldo (gera ajuste).');
  }
  if (b.alvo_tipo === 'divida' && b.valor_centavos < 0) requisicaoInvalida('Saldo devedor não pode ser negativo.');
  await stmtSnapshot(db, b.alvo_tipo, b.alvo_id, data, b.valor_centavos, 'manual', null, b.observacao ?? null).run();
  const onb1 = await posMudancaSaldo(db);
  return c.json({ ok: true, onb1 }, 201);
});

rotasPatrimonio.delete('/snapshots/:id', async (c) => {
  const db = c.env.DB;
  const r = await db.prepare('DELETE FROM balance_snapshots WHERE id = ?').bind(idParam(c.req.param('id'))).run();
  if (!r.meta.changes) naoEncontrado('Snapshot');
  await posMudancaSaldo(db);
  return c.json({ ok: true });
});
