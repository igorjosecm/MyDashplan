/**
 * Ponte entre as linhas do banco (centavos) e o motor (reais). Usada pelo worker e pela UI,
 * garantindo que os dois calculem exatamente a mesma coisa.
 */
import { calcularMeuFuturo, type MotorEntrada, type MotorResultado, type ProjetoMotor } from './finance-engine.ts';
import type { Plano, ProjetoVida } from './types.ts';

export const centavosParaReais = (c: number): number => c / 100;
export const reaisParaCentavos = (r: number): number => Math.round(r * 100);

type PlanoMotor = Pick<
  Plano,
  | 'modo_taxa'
  | 'taxa_real_anual_acumulacao'
  | 'taxa_real_anual_aposentadoria'
  | 'taxa_nominal_anual_acumulacao'
  | 'taxa_nominal_anual_aposentadoria'
  | 'inflacao_anual'
  | 'idade_aposentadoria'
  | 'expectativa_vida'
  | 'renda_desejada_centavos'
  | 'outras_rendas_centavos'
  | 'meta_aporte_mensal_centavos'
  | 'patrimonio_sucessao_centavos'
>;

export interface ArgsEntrada {
  hoje: string;
  nascimento: string;
  plano: PlanoMotor;
  projetos: Pick<ProjetoVida, 'id' | 'nome' | 'tipo' | 'valor_centavos' | 'data_inicial' | 'parcelas' | 'ativo'>[];
  plCentavos: number;
}

export function entradaDoPlano(a: ArgsEntrada): MotorEntrada {
  const p = a.plano;
  const nominal = p.modo_taxa === 'nominal';
  const projetos: ProjetoMotor[] = a.projetos
    .filter((x) => x.ativo === 1)
    .map((x) => ({
      id: x.id,
      nome: x.nome,
      tipo: x.tipo,
      valor: centavosParaReais(x.valor_centavos),
      inicio: x.data_inicial,
      parcelas: x.parcelas,
    }));
  return {
    hoje: a.hoje,
    nascimento: a.nascimento,
    idadeAposentadoria: p.idade_aposentadoria,
    rendaDesejada: centavosParaReais(p.renda_desejada_centavos),
    outrasRendas: centavosParaReais(p.outras_rendas_centavos),
    metaAporte: centavosParaReais(p.meta_aporte_mensal_centavos),
    pl: centavosParaReais(a.plCentavos),
    sucessao: centavosParaReais(p.patrimonio_sucessao_centavos),
    modoTaxa: nominal ? 'nominal' : 'real',
    inflacao: p.inflacao_anual,
    taxaAcumulacao: nominal ? p.taxa_nominal_anual_acumulacao : p.taxa_real_anual_acumulacao,
    taxaAposentadoria: nominal ? p.taxa_nominal_anual_aposentadoria : p.taxa_real_anual_aposentadoria,
    expectativaVidaMeta: p.expectativa_vida,
    expectativaVidaGrafico: p.expectativa_vida,
    modoCompatibilidadeDashplan: false,
    projetos,
  };
}

export function rodarMeuFuturo(a: ArgsEntrada): MotorResultado {
  return calcularMeuFuturo(entradaDoPlano(a));
}

/** data_final = data_ini + parcelas meses (§4.6); à vista: data_final = data_ini. */
export function dataFinalProjeto(dataInicial: string, parcelas: number): string {
  return parcelas <= 0 ? dataInicial : somarMesesData(dataInicial, parcelas);
}

/** Soma k meses a uma data 'AAAA-MM-DD', limitando o dia ao último dia do mês. */
export function somarMesesData(data: string, k: number): string {
  const [y, m, d] = data.split('-').map(Number);
  const t = y * 12 + (m - 1) + k;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  const ult = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
}

/** Diferença em meses entre duas datas (ignora o dia). */
export function difMesesData(de: string, ate: string): number {
  const [y1, m1] = de.split('-').map(Number);
  const [y2, m2] = ate.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function ultimoDiaDoMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mes}-${String(d).padStart(2, '0')}`;
}

export function mesAnterior(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function mesSeguinte(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Dias entre duas datas civis (b − a). */
export function diasEntre(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86_400_000);
}

export const LIMITE_FRESCOR_DIAS = 35;
