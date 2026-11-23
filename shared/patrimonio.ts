/**
 * Consolidação do patrimônio (SPEC_DASHPLAN_CLEANROOM §3.5, R-PA1..R-PA5, adaptado por
 * SPEC_ENTRADA_MANUAL §3 e §8: saldos vêm de SaldoSnapshot e o PL usa a flag conta_no_pl).
 * Funções puras em centavos.
 */
import { diasEntre, LIMITE_FRESCOR_DIAS } from './meu-futuro.ts';
import type { Bem, Conta, Divida, FrescorPL, Patrimonio, Perfil } from './types.ts';

export interface PontoSaldo {
  data: string;
  valor_centavos: number;
}

/** Último ponto com data ≤ ate. Em empate de data, o último da lista vence. */
export function valorNaData(pontos: PontoSaldo[], ate: string): PontoSaldo | null {
  let melhor: PontoSaldo | null = null;
  for (const p of pontos) {
    if (p.data > ate) continue;
    if (!melhor || p.data >= melhor.data) melhor = p;
  }
  return melhor;
}

type PerfilPL = Pick<Perfil, 'modo_pl_manual' | 'pl_manual_centavos' | 'pl_manual_data'>;

export function frescorPL(contas: Conta[], perfil: PerfilPL, hoje: string): FrescorPL {
  const doPL = contas.filter((c) => c.ativa === 1 && c.conta_no_pl === 1);
  const plContas = doPL.reduce((s, c) => s + c.saldo_centavos, 0);
  const manual = perfil.modo_pl_manual === 1;
  let dataBase: string | null;
  if (manual) dataBase = perfil.pl_manual_data;
  else dataBase = doPL.length ? doPL.map((c) => c.saldo_data).sort()[0] : null;
  const dias = dataBase ? Math.max(0, diasEntre(dataBase, hoje)) : null;
  return {
    pl_centavos: manual ? perfil.pl_manual_centavos : plContas,
    fonte: manual ? 'manual' : 'contas',
    pl_contas_centavos: plContas,
    data_base: dataBase,
    dias,
    desatualizado: dias !== null && dias > LIMITE_FRESCOR_DIAS,
  };
}

export function consolidarPatrimonio(a: {
  data: string;
  hoje: string;
  contas: Conta[];
  bens: Bem[];
  dividas: Divida[];
  perfil: PerfilPL;
}): Patrimonio {
  let ativos = 0;
  let passivos = 0;
  let gerador = 0;

  for (const c of a.contas) {
    if (c.ativa !== 1) continue;
    // Saldo negativo = valor devido (cartão com fatura em aberto, cheque especial) → passivo.
    if (c.saldo_centavos >= 0) ativos += c.saldo_centavos;
    else passivos += -c.saldo_centavos;
    if (c.conta_no_pl === 1 && c.saldo_centavos > 0) gerador += c.saldo_centavos; // R-PA4
  }
  for (const b of a.bens) {
    if (b.ativo !== 1) continue;
    ativos += b.valor_centavos; // R-PA1
    if (b.categoria === 'investimentos') gerador += b.valor_centavos; // R-PA4
  }
  for (const d of a.dividas) {
    if (d.ativo !== 1) continue;
    passivos += Math.max(0, d.saldo_devedor_centavos); // R-PA2 (financiamentos são dívidas com asset_id)
  }

  return {
    data_referencia: a.data,
    ativos_centavos: ativos,
    passivos_centavos: passivos,
    patrimonio_liquido_centavos: ativos - passivos, // R-PA3
    pct_comprometido: ativos > 0 ? Math.round((passivos / ativos) * 1000) / 10 : null,
    gerador_renda_centavos: gerador,
    uso_pessoal_centavos: ativos - gerador,
    investivel: frescorPL(a.contas, a.perfil, a.hoje), // R-PA5 + conta_no_pl + ONB-1
    contas: a.contas,
    bens: a.bens,
    dividas: a.dividas,
  };
}

/** §7.1 (3): aporte estimado = PL_m − PL_{m−1}·(1 + i_acc). Inclui variação de mercado. */
export function aporteEstimado(plAtual: number, plAnterior: number, iAcc: number): number {
  return Math.round(plAtual - plAnterior * (1 + iAcc));
}
