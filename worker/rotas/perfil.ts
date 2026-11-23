import { Hono } from 'hono';
import { z } from 'zod';
import { agoraISO, atualizarCachesPlano, hojeLocal, lerPerfil, perguntaOnb1 } from '../repo.ts';
import { stmtUpdate } from '../util.ts';
import { corpo, zOnboarding, zPerfilParcial } from '../validacao.ts';

export const rotasPerfil = new Hono<{ Bindings: Env }>();

const COLS_PERFIL = ['nome', 'data_nascimento', 'modo_pl_manual', 'pl_manual_centavos', 'onb1_respondido'] as const;

rotasPerfil.get('/profile', async (c) => c.json(await lerPerfil(c.env.DB)));

rotasPerfil.put('/profile', corpo(zPerfilParcial), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  await lerPerfil(db); // garante a linha
  const extras = [`atualizado_em = '${agoraISO()}'`];
  if (b.pl_manual_centavos !== undefined) extras.push(`pl_manual_data = '${hojeLocal()}'`);
  const st = stmtUpdate(db, 'client_profile', b, COLS_PERFIL, 'id = 1', [], extras);
  if (st) await st.run();
  await atualizarCachesPlano(db, hojeLocal());
  return c.json(await lerPerfil(db));
});

/** Onboarding nível 0 (SPEC_ENTRADA_MANUAL §2). Todos os passos podem ser pulados. */
rotasPerfil.post('/onboarding', corpo(zOnboarding), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  const hoje = hojeLocal();
  await lerPerfil(db);

  const perfil: Record<string, unknown> = { onboarding_concluido: 1 };
  if (b.nome !== undefined && b.nome !== null) perfil.nome = b.nome;
  if (b.data_nascimento) perfil.data_nascimento = b.data_nascimento;

  const plano: Record<string, unknown> = {};
  if (b.idade_aposentadoria != null) plano.idade_aposentadoria = b.idade_aposentadoria;
  if (b.renda_desejada_centavos != null) plano.renda_desejada_centavos = b.renda_desejada_centavos;
  if (b.outras_rendas_centavos != null) plano.outras_rendas_centavos = b.outras_rendas_centavos;
  if (b.meta_aporte_mensal_centavos != null) plano.meta_aporte_mensal_centavos = b.meta_aporte_mensal_centavos;

  const stmts: D1PreparedStatement[] = [];
  if (b.pl?.modo === 'total') {
    // Opção A: PL manual (ONB-1 pergunta depois, quando a primeira conta do PL receber saldo).
    Object.assign(perfil, { modo_pl_manual: 1, pl_manual_centavos: b.pl.valor_centavos, pl_manual_data: hoje, onb1_respondido: 0 });
  } else {
    // Opção B (contas rápidas) ou passo pulado: PL vem da soma das contas.
    Object.assign(perfil, { modo_pl_manual: 0, onb1_respondido: 1 });
    if (b.pl?.modo === 'contas') {
      for (const ct of b.pl.contas) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO accounts (nome, tipo, modo_controle, conta_no_pl, saldo_inicial_centavos, data_ancora)
               VALUES (?, ?, 'so_saldo', 1, ?, ?)`,
            )
            .bind(ct.nome, ct.tipo, ct.saldo_centavos, hoje),
        );
      }
    }
  }

  const cols = Object.keys(perfil);
  stmts.push(
    db
      .prepare(`UPDATE client_profile SET ${cols.map((k) => `${k} = ?`).join(', ')}, atualizado_em = ? WHERE id = 1`)
      .bind(...cols.map((k) => perfil[k]), agoraISO()),
  );
  const colsP = Object.keys(plano);
  if (colsP.length) {
    stmts.push(db.prepare(`UPDATE financial_plans SET ${colsP.map((k) => `${k} = ?`).join(', ')} WHERE id = 1`).bind(...colsP.map((k) => plano[k])));
  }
  await db.batch(stmts);
  await atualizarCachesPlano(db, hoje);
  return c.json({ ok: true, perfil: await lerPerfil(db) });
});

/** Resposta à pergunta ONB-1: substituir o PL informado pela soma das contas? */
rotasPerfil.post('/onboarding/onb1', corpo(z.object({ substituir: z.boolean() }).strict()), async (c) => {
  const db = c.env.DB;
  const { substituir } = c.req.valid('json');
  await db
    .prepare('UPDATE client_profile SET onb1_respondido = 1, modo_pl_manual = CASE WHEN ? THEN 0 ELSE modo_pl_manual END, atualizado_em = ? WHERE id = 1')
    .bind(substituir ? 1 : 0, agoraISO())
    .run();
  const hoje = hojeLocal();
  await atualizarCachesPlano(db, hoje);
  return c.json({ perfil: await lerPerfil(db), onb1: await perguntaOnb1(db, hoje) });
});
