import { Hono } from 'hono';
import { ganhoMesesIF } from '../../shared/finance-engine.ts';
import { mesAnterior, mesSeguinte, ultimoDiaDoMes } from '../../shared/meu-futuro.ts';
import { aporteEstimado, consolidarPatrimonio, frescorPL } from '../../shared/patrimonio.ts';
import type { PrepararFechamentoResposta, ResultadoFechamento } from '../../shared/types.ts';
import {
  agoraISO,
  atualizarCachesPlano,
  fechamentoAnterior,
  hojeLocal,
  lerBens,
  lerContas,
  lerDividas,
  lerFechamento,
  lerPerfil,
  lerPlano,
  lerProjetos,
  listarFechamentos,
  resumoParaFechamento,
  taxaMensalAcumulacao,
  type DB,
} from '../repo.ts';
import { idParam, naoEncontrado, requisicaoInvalida, stmtAjuste, stmtSnapshot } from '../util.ts';
import { corpo, zFechamento, zMes } from '../validacao.ts';

export const rotasFechamentos = new Hono<{ Bindings: Env }>();

/** Data de referência: último dia do mês, ou hoje se o mês está em andamento. */
function dataReferencia(mes: string, hoje: string): string {
  const fim = ultimoDiaDoMes(mes);
  return fim > hoje ? hoje : fim;
}

/** PL das contas (conta_no_pl) ao fim do mês anterior, a partir dos snapshots. null se não havia contas. */
async function plContasFimMesAnterior(db: DB, mes: string, hoje: string): Promise<number | null> {
  const ate = ultimoDiaDoMes(mesAnterior(mes));
  const contas = (await lerContas(db, ate)).filter((c) => c.ativa === 1 && c.conta_no_pl === 1 && c.data_ancora <= ate);
  if (!contas.length) return null;
  return frescorPL(contas, { modo_pl_manual: 0, pl_manual_centavos: 0, pl_manual_data: null }, hoje).pl_contas_centavos;
}

rotasFechamentos.get('/closings', async (c) => c.json(await listarFechamentos(c.env.DB)));

/** Itens do fluxo guiado (§7, passos 3, 4 e 6 na F1). Sugere o mês anterior se ainda não foi fechado. */
rotasFechamentos.get('/closings/preparar', async (c) => {
  const db = c.env.DB;
  const hoje = hojeLocal();
  const mesHoje = hoje.slice(0, 7);
  let mes = c.req.query('mes');
  if (mes && !zMes.safeParse(mes).success) requisicaoInvalida('Mês inválido (AAAA-MM).');
  if (mes && mes > mesHoje) requisicaoInvalida('Não é possível fechar um mês futuro.');
  if (!mes) mes = (await lerFechamento(db, mesAnterior(mesHoje))) ? mesHoje : mesAnterior(mesHoje);
  const dataRef = dataReferencia(mes, hoje);
  const [contas, bens, dividas, existente, anterior, plano] = await Promise.all([
    lerContas(db, dataRef),
    lerBens(db, dataRef),
    lerDividas(db, dataRef),
    lerFechamento(db, mes),
    fechamentoAnterior(db, mes),
    lerPlano(db),
  ]);
  const resp: PrepararFechamentoResposta = {
    hoje,
    mes,
    data_referencia: dataRef,
    ja_existe: !!existente,
    contas: contas.filter((x) => x.ativa === 1 && x.data_ancora <= dataRef),
    bens: bens.filter((x) => x.ativo === 1),
    dividas: dividas.filter((x) => x.ativo === 1),
    anterior,
    pl_anterior_centavos: await plContasFimMesAnterior(db, mes, hoje),
    taxa_mensal_acumulacao: taxaMensalAcumulacao(plano),
  };
  return c.json(resp);
});

rotasFechamentos.post('/closings', corpo(zFechamento), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  const hoje = hojeLocal();
  if (b.mes > hoje.slice(0, 7)) requisicaoInvalida('Não é possível fechar um mês futuro.');
  const dataRef = dataReferencia(b.mes, hoje);

  const [perfil, plano, projetos, contas, bens, dividas, existente, anterior] = await Promise.all([
    lerPerfil(db),
    lerPlano(db),
    lerProjetos(db),
    lerContas(db, dataRef),
    lerBens(db, dataRef),
    lerDividas(db, dataRef),
    lerFechamento(db, b.mes),
    fechamentoAnterior(db, b.mes),
  ]);

  // 1) Aplica os valores informados em memória e prepara as gravações.
  const posFechamento: D1PreparedStatement[] = [];
  let naoRastreado = existente?.nao_rastreado_centavos ?? 0;
  for (const it of b.itens) {
    if (it.alvo_tipo === 'conta') {
      const ct = contas.find((x) => x.id === it.alvo_id) ?? naoEncontrado(`Conta ${it.alvo_id}`);
      if (ct.data_ancora > dataRef) requisicaoInvalida(`A conta "${ct.nome}" foi aberta depois de ${dataRef}.`);
      if (ct.modo_controle === 'so_saldo') {
        posFechamento.push(stmtSnapshot(db, 'conta', ct.id, dataRef, it.valor_centavos, 'fechamento', b.mes));
      } else {
        const dif = it.valor_centavos - ct.saldo_centavos;
        if (dif !== 0) {
          posFechamento.push(stmtAjuste(db, ct.id, dataRef, dif, `Ajuste do fechamento ${b.mes} — ${ct.nome}`, b.mes));
          naoRastreado += dif;
        }
      }
      ct.saldo_centavos = it.valor_centavos;
      ct.saldo_data = dataRef;
    } else if (it.alvo_tipo === 'bem') {
      const bm = bens.find((x) => x.id === it.alvo_id) ?? naoEncontrado(`Bem ${it.alvo_id}`);
      if (it.valor_centavos < 0) requisicaoInvalida(`Valor negativo para o bem "${bm.nome}".`);
      posFechamento.push(stmtSnapshot(db, 'bem', bm.id, dataRef, it.valor_centavos, 'fechamento', b.mes));
      bm.valor_centavos = it.valor_centavos;
      bm.valor_data = dataRef;
    } else {
      const dv = dividas.find((x) => x.id === it.alvo_id) ?? naoEncontrado(`Dívida ${it.alvo_id}`);
      if (it.valor_centavos < 0) requisicaoInvalida(`Saldo devedor negativo para "${dv.nome}".`);
      posFechamento.push(stmtSnapshot(db, 'divida', dv.id, dataRef, it.valor_centavos, 'fechamento', b.mes));
      dv.saldo_devedor_centavos = it.valor_centavos;
      dv.saldo_data = dataRef;
    }
  }

  // 2) Patrimônio consolidado na data de referência.
  const pat = consolidarPatrimonio({
    data: dataRef,
    hoje,
    contas: contas.filter((x) => x.data_ancora <= dataRef),
    bens,
    dividas,
    perfil,
  });
  const pl = pat.investivel.pl_centavos;

  // 3) Aporte real do mês (§7.1): detalhado > informado > estimado.
  const det = await db
    .prepare(
      `SELECT COUNT(*) AS n, IFNULL(SUM(-t.valor_centavos), 0) AS total
         FROM transactions t
         JOIN categories cat ON cat.id = t.category_id
         JOIN accounts a ON a.id = t.account_id
        WHERE cat.classificacao_id = 'investimentos' AND a.conta_no_pl = 0
          AND t.status = 'realizado' AND t.excluido_em IS NULL AND t.ignorado = 0
          AND t.data BETWEEN ? AND ?`,
    )
    .bind(`${b.mes}-01`, ultimoDiaDoMes(b.mes))
    .first<{ n: number; total: number }>();
  let aporte: number | null = null;
  let fonte: 'detalhado' | 'informado' | 'estimado' | null = null;
  if (det && det.n > 0) {
    aporte = det.total;
    fonte = 'detalhado';
  } else if (b.aporte_informado_centavos != null) {
    aporte = b.aporte_informado_centavos;
    fonte = 'informado';
  } else {
    const plAnt = await plContasFimMesAnterior(db, b.mes, hoje);
    if (plAnt !== null) {
      aporte = aporteEstimado(pat.investivel.pl_contas_centavos, plAnt, taxaMensalAcumulacao(plano));
      fonte = 'estimado';
    }
  }

  // 4) Efeito no Meu Futuro: roda o motor a partir do mês seguinte com o PL do fechamento.
  const resultado = resumoParaFechamento({ mesSeguinte: mesSeguinte(b.mes), nascimento: perfil.data_nascimento, plano, projetos, plCentavos: pl });

  await db.batch([
    db
      .prepare(
        `INSERT INTO monthly_closings (mes, data_referencia, status, concluido_em, pl_centavos, ativos_centavos, passivos_centavos,
           patrimonio_liquido_centavos, aporte_real_centavos, aporte_fonte, nao_rastreado_centavos, resultado_meu_futuro_json, resumo_json)
         VALUES (?, ?, 'concluido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (mes) DO UPDATE SET
           data_referencia = excluded.data_referencia, status = excluded.status, concluido_em = excluded.concluido_em,
           pl_centavos = excluded.pl_centavos, ativos_centavos = excluded.ativos_centavos, passivos_centavos = excluded.passivos_centavos,
           patrimonio_liquido_centavos = excluded.patrimonio_liquido_centavos, aporte_real_centavos = excluded.aporte_real_centavos,
           aporte_fonte = excluded.aporte_fonte, nao_rastreado_centavos = excluded.nao_rastreado_centavos,
           resultado_meu_futuro_json = excluded.resultado_meu_futuro_json, resumo_json = excluded.resumo_json`,
      )
      .bind(
        b.mes,
        dataRef,
        agoraISO(),
        pl,
        pat.ativos_centavos,
        pat.passivos_centavos,
        pat.patrimonio_liquido_centavos,
        aporte,
        fonte,
        naoRastreado,
        resultado ? JSON.stringify(resultado) : null,
        JSON.stringify({ gerador_renda_centavos: pat.gerador_renda_centavos, pct_comprometido: pat.pct_comprometido }),
      ),
    ...posFechamento,
  ]);
  await atualizarCachesPlano(db, hoje);

  const fechamento = (await lerFechamento(db, b.mes))!;
  const antes = anterior?.resultado?.mesIF ?? null;
  const depois = fechamento.resultado?.mesIF ?? null;
  const resp: ResultadoFechamento = {
    fechamento,
    anterior,
    delta_patrimonio_liquido_centavos: anterior ? fechamento.patrimonio_liquido_centavos - anterior.patrimonio_liquido_centavos : null,
    meta_aporte_centavos: plano.meta_aporte_mensal_centavos,
    efeito: { mes_if_antes: antes, mes_if_depois: depois, ganho_meses: ganhoMesesIF(antes, depois) },
  };
  return c.json(resp, existente ? 200 : 201);
});

/** Desfaz um fechamento: remove o registro, os snapshots e os ajustes gravados por ele. */
rotasFechamentos.delete('/closings/:id', async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  const r = await db.prepare('SELECT id FROM monthly_closings WHERE id = ?').bind(id).first();
  if (!r) naoEncontrado('Fechamento');
  await db.batch([
    db.prepare("DELETE FROM balance_snapshots WHERE closing_id = ? AND origem = 'fechamento'").bind(id),
    db.prepare("DELETE FROM transactions WHERE closing_id = ? AND origem = 'ajuste'").bind(id),
    db.prepare('DELETE FROM monthly_closings WHERE id = ?').bind(id),
  ]);
  await atualizarCachesPlano(db, hojeLocal());
  return c.json({ ok: true });
});
