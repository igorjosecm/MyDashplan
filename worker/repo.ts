/**
 * Acesso ao D1. Toda regra de cálculo fica em ./shared; aqui só lemos/gravamos linhas.
 */
import { resumirResultado, taxaMensal, taxaRealFisher } from '../shared/finance-engine.ts';
import { rodarMeuFuturo } from '../shared/meu-futuro.ts';
import { consolidarPatrimonio, frescorPL, valorNaData, type PontoSaldo } from '../shared/patrimonio.ts';
import type { Bem, Conta, Divida, Fechamento, Onb1Pergunta, Patrimonio, Perfil, Plano, ProjetoVida } from '../shared/types.ts';

export type DB = D1Database;

/** Data civil de hoje no fuso de São Paulo ('AAAA-MM-DD'). */
export function hojeLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export const agoraISO = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export async function garantirLinhasBase(db: DB): Promise<void> {
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO client_profile (id) VALUES (1)'),
    db.prepare('INSERT OR IGNORE INTO financial_plans (id) VALUES (1)'),
  ]);
}

export async function lerPerfil(db: DB): Promise<Perfil> {
  await garantirLinhasBase(db);
  return (await db
    .prepare(
      'SELECT nome, data_nascimento, onboarding_concluido, modo_pl_manual, pl_manual_centavos, pl_manual_data, onb1_respondido, preferencias_json FROM client_profile WHERE id = 1',
    )
    .first<Perfil>())!;
}

export async function lerPlano(db: DB): Promise<Plano> {
  await garantirLinhasBase(db);
  const p = await db.prepare('SELECT * FROM financial_plans WHERE id = 1').first<Plano & { id: number; atualizado_em: string }>();
  const { id: _id, atualizado_em: _a, ...plano } = p!;
  return plano as Plano;
}

export async function lerProjetos(db: DB): Promise<ProjetoVida[]> {
  const r = await db
    .prepare(
      `SELECT id, nome, tipo, valor_centavos, data_inicial, data_final, parcelas, prazo, estagio, ativo, repetindo,
              cod_projeto, repeticao_intervalo_meses, repeticao_indice, observacao
         FROM life_projects ORDER BY data_inicial, id`,
    )
    .all<ProjetoVida>();
  return r.results;
}

// ─────────────────────────── saldos ───────────────────────────

async function pontosPorAlvo(db: DB, alvo: 'conta' | 'bem' | 'divida', ate: string): Promise<Map<number, PontoSaldo[]>> {
  const r = await db
    .prepare('SELECT alvo_id, data, valor_centavos FROM balance_snapshots WHERE alvo_tipo = ? AND data <= ? ORDER BY data')
    .bind(alvo, ate)
    .all<{ alvo_id: number; data: string; valor_centavos: number }>();
  const m = new Map<number, PontoSaldo[]>();
  for (const s of r.results) {
    const l = m.get(s.alvo_id) ?? [];
    l.push({ data: s.data, valor_centavos: s.valor_centavos });
    m.set(s.alvo_id, l);
  }
  return m;
}

type LinhaConta = Omit<Conta, 'saldo_centavos' | 'saldo_data'>;

export async function lerContas(db: DB, ate: string): Promise<Conta[]> {
  const contas = (
    await db
      .prepare(
        `SELECT a.id, a.institution_id, i.nome AS instituicao_nome, a.nome, a.tipo, a.modo_controle, a.conta_no_pl,
                a.saldo_inicial_centavos, a.data_ancora, a.ativa, a.proprietario, a.dia_fechamento, a.dia_vencimento, a.limite_centavos
           FROM accounts a LEFT JOIN institutions i ON i.id = a.institution_id
          ORDER BY a.ativa DESC, a.ordem, a.id`,
      )
      .all<LinhaConta>()
  ).results;
  const snaps = await pontosPorAlvo(db, 'conta', ate);
  const tx = new Map<number, { soma: number; ultima: string | null }>();
  const rtx = await db
    .prepare(
      `SELECT t.account_id, SUM(t.valor_centavos) AS soma, MAX(t.data) AS ultima
         FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE t.status = 'realizado' AND t.excluido_em IS NULL AND t.data > a.data_ancora AND t.data <= ?
        GROUP BY t.account_id`,
    )
    .bind(ate)
    .all<{ account_id: number; soma: number; ultima: string | null }>();
  for (const r of rtx.results) tx.set(r.account_id, { soma: r.soma, ultima: r.ultima });

  return contas.map((c) => {
    if (c.data_ancora > ate) return { ...c, saldo_centavos: 0, saldo_data: c.data_ancora };
    if (c.modo_controle === 'so_saldo') {
      const ponto = valorNaData([{ data: c.data_ancora, valor_centavos: c.saldo_inicial_centavos }, ...(snaps.get(c.id) ?? [])], ate)!;
      return { ...c, saldo_centavos: ponto.valor_centavos, saldo_data: ponto.data };
    }
    const t = tx.get(c.id);
    const ultima = t?.ultima && t.ultima > c.data_ancora ? t.ultima : c.data_ancora;
    return { ...c, saldo_centavos: c.saldo_inicial_centavos + (t?.soma ?? 0), saldo_data: ultima };
  });
}

export async function lerBens(db: DB, ate: string): Promise<Bem[]> {
  const bens = (
    await db
      .prepare('SELECT id, nome, classe, categoria, ativo, proprietario, atualizar_mensalmente FROM assets WHERE rascunho = 0 ORDER BY ativo DESC, id')
      .all<Omit<Bem, 'valor_centavos' | 'valor_data'>>()
  ).results;
  const snaps = await pontosPorAlvo(db, 'bem', ate);
  return bens.map((b) => {
    const p = valorNaData(snaps.get(b.id) ?? [], ate);
    return { ...b, valor_centavos: p?.valor_centavos ?? 0, valor_data: p?.data ?? null };
  });
}

export async function lerDividas(db: DB, ate: string): Promise<Divida[]> {
  const dividas = (
    await db
      .prepare(
        'SELECT id, nome, tipo, asset_id, total_tomado_centavos, taxa_juros_anual, ativo, proprietario, atualizar_mensalmente FROM debts ORDER BY ativo DESC, id',
      )
      .all<Omit<Divida, 'saldo_devedor_centavos' | 'saldo_data'>>()
  ).results;
  const snaps = await pontosPorAlvo(db, 'divida', ate);
  return dividas.map((d) => {
    const p = valorNaData(snaps.get(d.id) ?? [], ate);
    return { ...d, saldo_devedor_centavos: p?.valor_centavos ?? 0, saldo_data: p?.data ?? null };
  });
}

export async function calcularPatrimonio(db: DB, ate: string, hoje: string): Promise<Patrimonio> {
  const [perfil, contas, bens, dividas] = await Promise.all([lerPerfil(db), lerContas(db, ate), lerBens(db, ate), lerDividas(db, ate)]);
  return consolidarPatrimonio({ data: ate, hoje, contas, bens, dividas, perfil });
}

// ─────────────────────────── ONB-1 ───────────────────────────

export async function perguntaOnb1(db: DB, hoje: string): Promise<Onb1Pergunta> {
  const perfil = await lerPerfil(db);
  const contas = await lerContas(db, hoje);
  const f = frescorPL(contas, perfil, hoje);
  const temContaPL = contas.some((c) => c.ativa === 1 && c.conta_no_pl === 1);
  return {
    perguntar: perfil.modo_pl_manual === 1 && perfil.onb1_respondido === 0 && temContaPL,
    pl_manual_centavos: perfil.pl_manual_centavos,
    pl_contas_centavos: f.pl_contas_centavos,
  };
}

// ─────────────────────────── Meu Futuro (server-side) ───────────────────────────

export function taxaMensalAcumulacao(plano: Plano): number {
  const real =
    plano.modo_taxa === 'nominal' ? taxaRealFisher(plano.taxa_nominal_anual_acumulacao, plano.inflacao_anual) : plano.taxa_real_anual_acumulacao;
  return taxaMensal(real);
}

/** Recalcula os caches de financial_plans (§2.2). Sem data de nascimento, limpa-os. */
export async function atualizarCachesPlano(db: DB, hoje: string): Promise<void> {
  const [perfil, plano, projetos, contas] = await Promise.all([lerPerfil(db), lerPlano(db), lerProjetos(db), lerContas(db, hoje)]);
  if (!perfil.data_nascimento) {
    await db.prepare('UPDATE financial_plans SET cache_atualizado_em = NULL WHERE id = 1').run();
    return;
  }
  const pl = frescorPL(contas, perfil, hoje).pl_centavos;
  const r = rodarMeuFuturo({ hoje, nascimento: perfil.data_nascimento, plano, projetos, plCentavos: pl });
  const c = (x: number | null) => (x === null ? null : Math.round(x * 100));
  const ifm = r.marcos.independenciaCP;
  await db
    .prepare(
      `UPDATE financial_plans SET
         patrimonio_necessario_consumo_centavos = ?, valor_aposentadoria_real_centavos = ?,
         patrimonio_projetado_aposentadoria_centavos = ?, saldo_real_longo_prazo_centavos = ?,
         acumulado_projetos_longo_prazo_centavos = ?, acumulo_investimentos_longo_prazo_centavos = ?,
         mes_independencia = ?, cache_atualizado_em = ?
       WHERE id = 1`,
    )
    .bind(
      c(r.metas.pnCP),
      c(r.metas.pCP),
      c(r.marcos.saldoAoAposentar),
      c(r.marcos.saldo72),
      c(r.marcos.somaFPs72),
      c(r.marcos.somaAcum72),
      ifm ? `${ifm.y}-${String(ifm.m).padStart(2, '0')}` : null,
      agoraISO(),
    )
    .run();
}

export function resumoParaFechamento(args: {
  mesSeguinte: string;
  nascimento: string | null;
  plano: Plano;
  projetos: ProjetoVida[];
  plCentavos: number;
}) {
  if (!args.nascimento) return null;
  const r = rodarMeuFuturo({ hoje: args.mesSeguinte, nascimento: args.nascimento, plano: args.plano, projetos: args.projetos, plCentavos: args.plCentavos });
  return resumirResultado(args.mesSeguinte, args.plCentavos / 100, r);
}

// ─────────────────────────── Fechamentos ───────────────────────────

type LinhaFechamento = Omit<Fechamento, 'resultado'> & { resultado_meu_futuro_json: string | null };

const COLS_FECHAMENTO = `id, mes, data_referencia, status, concluido_em, pl_centavos, ativos_centavos, passivos_centavos,
  patrimonio_liquido_centavos, aporte_real_centavos, aporte_fonte, nao_rastreado_centavos, resultado_meu_futuro_json`;

function paraFechamento(l: LinhaFechamento): Fechamento {
  const { resultado_meu_futuro_json, ...resto } = l;
  return { ...resto, resultado: resultado_meu_futuro_json ? JSON.parse(resultado_meu_futuro_json) : null };
}

export async function listarFechamentos(db: DB): Promise<Fechamento[]> {
  const r = await db.prepare(`SELECT ${COLS_FECHAMENTO} FROM monthly_closings ORDER BY mes DESC`).all<LinhaFechamento>();
  return r.results.map(paraFechamento);
}

export async function lerFechamento(db: DB, mes: string): Promise<Fechamento | null> {
  const l = await db.prepare(`SELECT ${COLS_FECHAMENTO} FROM monthly_closings WHERE mes = ?`).bind(mes).first<LinhaFechamento>();
  return l ? paraFechamento(l) : null;
}

export async function fechamentoAnterior(db: DB, mes: string): Promise<Fechamento | null> {
  const l = await db
    .prepare(`SELECT ${COLS_FECHAMENTO} FROM monthly_closings WHERE mes < ? ORDER BY mes DESC LIMIT 1`)
    .bind(mes)
    .first<LinhaFechamento>();
  return l ? paraFechamento(l) : null;
}
