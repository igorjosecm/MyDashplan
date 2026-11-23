/**
 * Motor financeiro da aba "Meu Futuro".
 *
 * Implementação própria (clean-room) das equações de SPEC_DASHPLAN_CLEANROOM.md §4:
 *  - Motor P ("patrimônios"): patrimônio necessário (PN_VR, PN_CP) e parcela mensal (P_VR, P_CP).
 *  - Motor F ("projeção"): série mensal saldo / principal / consumo / acumulado / fluxo de projetos.
 *
 * TypeScript puro: sem DOM, sem banco, sem dependências. Valores monetários em REAIS (number);
 * a conversão de/para centavos fica na borda (API / UI).
 *
 * Dois modos:
 *  - modoCompatibilidadeDashplan = true  → reproduz o comportamento observado, inclusive Q1/Q2
 *    (E_P = 90 no Motor P, E_F = 101 no Motor F, mês de aposentadoria divergente). Usado pela
 *    suíte de regressão (§5).
 *  - padrão (false) → versão corrigida (§4.10 e L11): uma única expectativa de vida, um único
 *    critério de mês de aposentadoria, taxa 0% segura (Q4), P_CP exibido com piso 0 (Q7),
 *    mês/idade de independência financeira (L9) e opção nominal + IPCA via Fisher (L10).
 *
 * Só sintaxe TypeScript "apagável" (sem enums/namespaces), para rodar também com `node file.ts`.
 */

// ───────────────────────────── tipos ─────────────────────────────

export type YM = { y: number; m: number }; // m = 1..12
export type DataCivil = { y: number; m: number; d: number };

export const TIPOS_PROJETO = [
  'viagem',
  'familia',
  'veiculo',
  'casa',
  'hobby',
  'eletronico',
  'educacao',
  'outro',
  'profissional',
  'saude',
  'ajuste_meta',
  'aporte_financeiro',
] as const;
export type TipoProjeto = (typeof TIPOS_PROJETO)[number];

export interface ProjetoMotor {
  id?: number | string;
  nome?: string;
  tipo: TipoProjeto;
  /** Valor total em reais (sempre positivo). Para "ajuste_meta" é o novo aporte mensal. */
  valor: number;
  /** Mês inicial: 'AAAA-MM-DD', 'AAAA-MM' ou {y, m}. */
  inicio: YM | string;
  /** 0 ou 1 = à vista; N ≥ 2 = valor/N por mês durante N meses a partir do mês inicial. */
  parcelas?: number;
}

export type ModoTaxa = 'real' | 'nominal';

export interface MotorEntrada {
  /** Mês corrente: 'AAAA-MM-DD', 'AAAA-MM' ou {y, m}. */
  hoje: YM | string;
  /** Data de nascimento 'AAAA-MM-DD'. */
  nascimento: string;
  idadeAposentadoria: number;
  /** R_des: renda mensal desejada na aposentadoria (R$ de hoje). */
  rendaDesejada: number;
  /** R_out: outras rendas mensais na aposentadoria. */
  outrasRendas: number;
  /** A_meta: aporte mensal planejado. */
  metaAporte: number;
  /** PL: patrimônio investível inicial. */
  pl: number;
  /** S: patrimônio de sucessão (valor a deixar). */
  sucessao?: number;
  /** Taxas ANUAIS (0.04 = 4% a.a.). Reais por padrão; nominais se modoTaxa = 'nominal'. */
  taxaAcumulacao: number;
  taxaAposentadoria: number;
  modoTaxa?: ModoTaxa;
  /** Inflação anual (IPCA) usada apenas quando modoTaxa = 'nominal'. */
  inflacao?: number;
  /** Expectativa de vida do Motor P (duração da renda). Compat: 90. Padrão: 90. */
  expectativaVidaMeta?: number;
  /** Horizonte do gráfico (Motor F). Compat: 101. Padrão: igual a expectativaVidaMeta. */
  expectativaVidaGrafico?: number;
  modoCompatibilidadeDashplan?: boolean;
  /** A_rec: aporte "recomendado" da série não plotada. Default 5000 (Q5). */
  aporteRecomendado?: number;
  projetos?: ProjetoMotor[];
}

export interface LinhaProjecao {
  /** Índice 1-based do mês na série (1 = mês corrente). */
  t: number;
  y: number;
  m: number;
  idade: number;
  aposentado: boolean;
  aporte: number;
  retorno: number;
  /** Patrimônio total projetado. */
  saldo: number;
  /** Patrimônio principal investido. */
  principal: number;
  /** Aposentadoria ideal. */
  consumo: number;
  recomendado: number;
  /** aporte + rendimento do mês. */
  acum: number;
  /** Fluxo de projetos (saídas positivas; aportes financeiros entram negativos). */
  fp: number;
  /** Fluxo de projetos sem "Aportes financeiros". */
  fps: number;
}

export interface MarcoMes {
  t: number;
  y: number;
  m: number;
  idade: number;
}

export interface MarcadorProjeto extends MarcoMes {
  projetoId?: number | string;
  nome?: string;
  tipo: TipoProjeto;
}

export interface MotorResultado {
  modo: 'compatibilidade' | 'corrigido';
  premissas: {
    taxaRealAcumulacao: number;
    taxaRealAposentadoria: number;
    iAcc: number;
    iRet: number;
    expectativaVidaMeta: number;
    expectativaVidaGrafico: number;
    nAcc: number;
    nRet: number;
    jaAposentado: boolean;
    /** Mês de aposentadoria usado pelo Motor P. */
    mesAposentadoriaMeta: YM;
    idadeAtual: number;
  };
  metas: {
    /** Perpetuidade; null quando não existe (taxa de aposentadoria ≤ 0 com necessidade > 0). */
    pnVR: number | null;
    pnCP: number;
    pVR: number | null;
    pCP: number;
    /** Valores sem piso (Q7), para diagnóstico. */
    pVRBruto: number | null;
    pCPBruto: number;
  };
  serie: LinhaProjecao[];
  marcos: {
    mesAposentadoria: MarcoMes | null;
    saldoAoAposentar: number | null;
    saldo72: number | null;
    somaFPs72: number;
    somaAcum72: number;
    saldoFinal: number | null;
    consumoFinal: number | null;
    independenciaCP: MarcoMes | null;
    independenciaVR: MarcoMes | null;
    zeraPatrimonio: MarcoMes | null;
    projetos: MarcadorProjeto[];
  };
}

// ───────────────────────────── calendário ─────────────────────────────

const RE_DATA = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

export function parseDataCivil(s: string): DataCivil {
  const r = RE_DATA.exec(s);
  if (!r) throw new RangeError(`Data inválida (use AAAA-MM-DD): ${s}`);
  const y = Number(r[1]);
  const m = Number(r[2]);
  const d = r[3] ? Number(r[3]) : 1;
  if (m < 1 || m > 12 || d < 1 || d > diasNoMes(y, m)) throw new RangeError(`Data inválida: ${s}`);
  return { y, m, d };
}

export function toYM(v: YM | string): YM {
  if (typeof v === 'string') {
    const { y, m } = parseDataCivil(v);
    return { y, m };
  }
  if (!Number.isInteger(v.y) || !Number.isInteger(v.m) || v.m < 1 || v.m > 12) {
    throw new RangeError(`Mês inválido: ${JSON.stringify(v)}`);
  }
  return { y: v.y, m: v.m };
}

export function diasNoMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const indiceMes = (v: YM): number => v.y * 12 + (v.m - 1);
export const mesDoIndice = (k: number): YM => ({ y: Math.floor(k / 12), m: (((k % 12) + 12) % 12) + 1 });
export const somarMeses = (v: YM, k: number): YM => mesDoIndice(indiceMes(v) + k);
/** Δm(a, b) = 12·(ano_b − ano_a) + (mês_b − mês_a), ignorando dias, com piso 0 (§4.3). */
export const difMeses = (a: YM, b: YM): number => Math.max(0, indiceMes(b) - indiceMes(a));
export const rotuloMes = (v: YM): string => `${String(v.m).padStart(2, '0')}/${v.y}`;
export const isoMes = (v: YM): string => `${v.y}-${String(v.m).padStart(2, '0')}`;

/**
 * Idade do Motor F observado (§4.3): anos completos no DIA 1º do mês.
 * Quem nasce no dia 1 "faz anos" no próprio mês; os demais, no mês seguinte ao aniversário.
 */
export function idadeDia1(nasc: DataCivil, y: number, m: number): number {
  let idade = y - nasc.y;
  if (m < nasc.m || (m === nasc.m && nasc.d > 1)) idade -= 1;
  return idade;
}

/** Idade corrigida (L11): a idade é atingida no próprio mês do aniversário. */
export function idadeNoMes(nasc: DataCivil, y: number, m: number): number {
  return y - nasc.y - (m < nasc.m ? 1 : 0);
}

// ───────────────────────────── taxas ─────────────────────────────

/** Equação de Fisher: taxa real a partir de nominal e inflação. Nunca subtração simples. */
export function taxaRealFisher(nominal: number, inflacao: number): number {
  if (!(inflacao > -1)) throw new RangeError('Inflação deve ser maior que -100%.');
  return (1 + nominal) / (1 + inflacao) - 1;
}

/** Conversão composta anual → mensal (§4.2). */
export function taxaMensal(anual: number): number {
  if (!(anual > -1)) throw new RangeError('Taxa anual deve ser maior que -100%.');
  return Math.pow(1 + anual, 1 / 12) - 1;
}

/** Valor presente de uma anuidade postecipada de n pagamentos unitários (seguro para i = 0). */
export function fatorAnuidade(i: number, n: number): number {
  if (n <= 0) return 0;
  if (Math.abs(i) < 1e-12) return n;
  return (1 - Math.pow(1 + i, -n)) / i;
}

/** Parcela para ir de PL a PN em n meses (≡ −PMT(i, n, −PL, PN) do Excel), segura para i = 0. */
export function parcelaNecessaria(i: number, n: number, pl: number, pn: number): number {
  if (n <= 0) return 0;
  if (Math.abs(i) < 1e-12) return (pn - pl) / n;
  const g = Math.pow(1 + i, n);
  return (i * (pn - pl * g)) / (g - 1);
}

const r2 = (x: number): number => {
  const v = Math.round(x * 100) / 100;
  return v === 0 ? 0 : v; // evita -0
};

// ───────────────────────────── projetos ─────────────────────────────

interface ProjetoNorm {
  ref: ProjetoMotor;
  inicio: number; // índice absoluto do mês
  n: number;
}

function normalizarProjetos(lista: ProjetoMotor[] | undefined): ProjetoNorm[] {
  return (lista ?? []).map((p) => {
    if (!(p.valor >= 0) || !Number.isFinite(p.valor)) throw new RangeError(`Valor de projeto inválido: ${p.nome ?? p.id}`);
    return { ref: p, inicio: indiceMes(toYM(p.inicio)), n: Math.max(1, Math.floor(p.parcelas ?? 0)) };
  });
}

/** FP_t (§4.5/§4.6, regra "N meses a partir de data_ini"). */
function fluxoProjetos(projetos: ProjetoNorm[], k: number, incluirAportes: boolean): number {
  let s = 0;
  for (const p of projetos) {
    const tipo = p.ref.tipo;
    if (tipo === 'ajuste_meta') continue;
    if (tipo === 'aporte_financeiro' && !incluirAportes) continue;
    const d = k - p.inicio;
    if (d < 0 || d >= p.n) continue;
    const v = tipo === 'aporte_financeiro' ? -p.ref.valor : p.ref.valor;
    s += v / p.n;
  }
  return s;
}

/**
 * Barras "Projetos 1 a 5 anos" (§4.8), versão corrigida: faixas contíguas [k−1, k) anos a partir
 * do mês corrente; a 5ª faixa é "5+ anos" (≥ 4 anos). Exclui aportes financeiros e ajustes de meta.
 */
export function projetosPorAno(projetos: ProjetoMotor[], hoje: YM | string): number[] {
  const h = indiceMes(toYM(hoje));
  const faixas = [0, 0, 0, 0, 0];
  for (const p of projetos) {
    if (p.tipo === 'aporte_financeiro' || p.tipo === 'ajuste_meta') continue;
    const d = indiceMes(toYM(p.inicio)) - h;
    if (d < 0) continue;
    faixas[Math.min(4, Math.floor(d / 12))] += p.valor;
  }
  return faixas.map(r2);
}

// ───────────────────────────── motor ─────────────────────────────

export function calcularMeuFuturo(e: MotorEntrada): MotorResultado {
  const compat = e.modoCompatibilidadeDashplan === true;
  const nasc = parseDataCivil(e.nascimento);
  const hoje = toYM(e.hoje);
  const hIdx = indiceMes(hoje);
  const I = e.idadeAposentadoria;
  const S = e.sucessao ?? 0;
  const aRec = e.aporteRecomendado ?? 5000;

  for (const [nome, v] of [
    ['idadeAposentadoria', I],
    ['rendaDesejada', e.rendaDesejada],
    ['outrasRendas', e.outrasRendas],
    ['metaAporte', e.metaAporte],
    ['pl', e.pl],
    ['sucessao', S],
  ] as const) {
    if (!Number.isFinite(v)) throw new RangeError(`${nome} inválido`);
  }

  const eMeta = e.expectativaVidaMeta ?? 90;
  const eGraf = e.expectativaVidaGrafico ?? (compat ? 101 : eMeta);

  // Taxas: real por padrão; nominal + IPCA via Fisher (L10).
  const modoTaxa: ModoTaxa = e.modoTaxa ?? 'real';
  const jAcc = modoTaxa === 'nominal' ? taxaRealFisher(e.taxaAcumulacao, e.inflacao ?? 0) : e.taxaAcumulacao;
  const jRet = modoTaxa === 'nominal' ? taxaRealFisher(e.taxaAposentadoria, e.inflacao ?? 0) : e.taxaAposentadoria;
  const iAcc = taxaMensal(jAcc);
  const iRet = taxaMensal(jRet);

  const idadeF = compat ? idadeDia1 : idadeNoMes;
  const idadeAtual = idadeF(nasc, hoje.y, hoje.m);
  const G = e.rendaDesejada - e.outrasRendas;
  const aApos = e.outrasRendas - e.rendaDesejada; // negativo = saque

  // ── Motor P ──
  let mesApos: YM = { y: nasc.y + I, m: nasc.m }; // mês do aniversário de I anos
  const mesVida: YM = { y: nasc.y + eMeta, m: nasc.m };
  let jaAposentado: boolean;
  let nAcc: number;
  let nRet: number;
  if (compat) {
    jaAposentado = indiceMes(mesApos) < hIdx;
    if (jaAposentado) mesApos = hoje;
    nAcc = difMeses(hoje, mesApos) + 1;
    nRet = difMeses(mesApos, mesVida) + (jaAposentado ? 1 : 0);
  } else {
    // Critério único (L11): aposentado a partir do mês em que a idade I é atingida.
    jaAposentado = indiceMes(mesApos) <= hIdx;
    if (jaAposentado) mesApos = hoje;
    nAcc = jaAposentado ? 0 : indiceMes(mesApos) - hIdx; // meses hoje..(apos − 1)
    nRet = difMeses(mesApos, mesVida); // meses apos..(vida − 1)
  }

  let pnVR: number | null;
  let pnCP: number;
  let pVRBruto: number | null;
  let pCPBruto: number;
  if (compat) {
    pnVR = G / iRet;
    pnCP = G * fatorAnuidade(iRet, nRet) + S * Math.pow(1 + iRet, -nRet);
    pVRBruto = jaAposentado ? 0 : parcelaNecessaria(iAcc, nAcc, e.pl, pnVR);
    pCPBruto = jaAposentado ? 0 : parcelaNecessaria(iAcc, nAcc, e.pl, pnCP);
  } else {
    pnVR = G <= 0 ? 0 : iRet > 1e-12 ? G / iRet : null; // perpetuidade inexistente com taxa ≤ 0 (Q4)
    pnCP = Math.max(0, G * fatorAnuidade(iRet, nRet) + S * Math.pow(1 + iRet, -nRet));
    pVRBruto = pnVR === null ? null : jaAposentado ? 0 : parcelaNecessaria(iAcc, nAcc, e.pl, pnVR);
    pCPBruto = jaAposentado ? 0 : parcelaNecessaria(iAcc, nAcc, e.pl, pnCP);
  }
  const pVR = pVRBruto === null ? null : compat ? pVRBruto : Math.max(0, pVRBruto);
  const pCP = compat ? pCPBruto : Math.max(0, pCPBruto); // Q7

  // ── Motor F ──
  const projetos = normalizarProjetos(e.projetos);
  const ajustes = projetos.filter((p) => p.ref.tipo === 'ajuste_meta');

  // Meses da série.
  const meses: YM[] = [];
  if (compat) {
    const anos = eGraf - idadeAtual; // "anosAtéAposentadoria" = E_F − idade(hoje)
    for (let a = 0; a < anos; a++) {
      for (let m = a === 0 ? hoje.m : 1; m <= 12; m++) meses.push({ y: hoje.y + a, m });
    }
  } else {
    const fim = indiceMes({ y: nasc.y + eGraf, m: nasc.m }); // exclusivo: último mês = idade E − 1
    for (let k = hIdx; k < fim; k++) meses.push(mesDoIndice(k));
  }

  const aposentado0 = compat ? idadeAtual >= I : jaAposentado;
  let aporte = aposentado0 ? aApos : e.metaAporte;
  if (!compat && !aposentado0) {
    // Correção: o último "Ajuste da meta" anterior ao mês corrente já vale no início.
    let melhor: ProjetoNorm | null = null;
    for (const p of ajustes) if (p.inicio < hIdx && (!melhor || p.inicio >= melhor.inicio)) melhor = p;
    if (melhor) aporte = melhor.ref.valor;
  }
  let saldo = e.pl;
  let principal = e.pl;
  let recomendado = e.pl;
  let consumo = aposentado0 ? pnCP : e.pl;
  let aposAnterior = aposentado0;

  const serie: LinhaProjecao[] = [];
  let mesAposentadoria: MarcoMes | null = null;
  let saldoAoAposentar: number | null = null;
  let independenciaCP: MarcoMes | null = null;
  let independenciaVR: MarcoMes | null = null;
  let zeraPatrimonio: MarcoMes | null = null;
  let somaFPs72Bruto = 0;
  let somaAcum72Bruto = 0;

  for (let t = 1; t <= meses.length; t++) {
    const { y, m } = meses[t - 1];
    const k = indiceMes({ y, m });
    const idade = idadeF(nasc, y, m);
    const apos = idade >= I;
    const virou = apos && !aposAnterior;
    const i = apos ? iRet : iAcc;

    if (virou) aporte = aApos;
    for (const p of ajustes) {
      if (p.inicio !== k) continue;
      if (compat || !apos) aporte = p.ref.valor; // corrigido: ajuste não substitui o saque
      break;
    }

    const fp = fluxoProjetos(projetos, k, true);
    const fps = fluxoProjetos(projetos, k, false);
    const retorno = saldo * i;
    saldo = saldo + retorno - fp + aporte;
    principal = Math.max(0, principal - fp + aporte);
    recomendado = recomendado * (1 + i) + (apos ? aApos : aRec);
    consumo = consumo * (1 + i) + (apos ? aApos : pCPBruto);

    if (t <= 72) {
      // Valores gravados de volta (§2.2): somas sobre valores não arredondados.
      somaFPs72Bruto += fps;
      somaAcum72Bruto += aporte + retorno;
    }

    const marco: MarcoMes = { t, y, m, idade };
    if (virou) {
      mesAposentadoria = marco;
      saldoAoAposentar = r2(saldo);
    }
    if (!independenciaCP && saldo >= pnCP) independenciaCP = marco;
    if (!independenciaVR && pnVR !== null && saldo >= pnVR) independenciaVR = marco;
    if (!zeraPatrimonio && apos && saldo <= 0) zeraPatrimonio = marco;

    serie.push({
      t,
      y,
      m,
      idade,
      aposentado: apos,
      aporte: r2(aporte),
      retorno: r2(retorno),
      saldo: r2(saldo),
      principal: r2(principal),
      consumo: r2(consumo),
      recomendado: r2(recomendado),
      acum: r2(aporte + retorno),
      fp: r2(fp),
      fps: r2(fps),
    });
    aposAnterior = apos;
  }

  const primeiro = meses.length ? indiceMes(meses[0]) : hIdx;
  const marcadoresProjetos: MarcadorProjeto[] = [];
  for (const p of projetos) {
    const t = p.inicio - primeiro + 1;
    if (t < 1 || t > meses.length) continue;
    const { y, m } = meses[t - 1];
    marcadoresProjetos.push({ t, y, m, idade: idadeF(nasc, y, m), projetoId: p.ref.id, nome: p.ref.nome, tipo: p.ref.tipo });
  }

  const ultima = serie.length ? serie[serie.length - 1] : null;
  return {
    modo: compat ? 'compatibilidade' : 'corrigido',
    premissas: {
      taxaRealAcumulacao: jAcc,
      taxaRealAposentadoria: jRet,
      iAcc,
      iRet,
      expectativaVidaMeta: eMeta,
      expectativaVidaGrafico: eGraf,
      nAcc,
      nRet,
      jaAposentado,
      mesAposentadoriaMeta: mesApos,
      idadeAtual,
    },
    metas: {
      pnVR: pnVR === null ? null : r2(pnVR),
      pnCP: r2(pnCP),
      pVR: pVR === null ? null : r2(pVR),
      pCP: r2(pCP),
      pVRBruto: pVRBruto === null ? null : r2(pVRBruto),
      pCPBruto: r2(pCPBruto),
    },
    serie,
    marcos: {
      mesAposentadoria,
      saldoAoAposentar,
      saldo72: serie.length >= 72 ? serie[71].saldo : null,
      somaFPs72: r2(somaFPs72Bruto),
      somaAcum72: r2(somaAcum72Bruto),
      saldoFinal: ultima ? ultima.saldo : null,
      consumoFinal: ultima ? ultima.consumo : null,
      independenciaCP,
      independenciaVR,
      zeraPatrimonio,
      projetos: marcadoresProjetos,
    },
  };
}

/** Resumo compacto gravado em `monthly_closings.resultado_meu_futuro_json`. */
export interface ResumoMeuFuturo {
  hoje: string; // AAAA-MM
  pl: number;
  pnCP: number;
  pCP: number;
  saldoAoAposentar: number | null;
  mesIF: string | null; // AAAA-MM
  idadeIF: number | null;
}

export function resumirResultado(hoje: YM | string, pl: number, r: MotorResultado): ResumoMeuFuturo {
  const ifm = r.marcos.independenciaCP;
  return {
    hoje: isoMes(toYM(hoje)),
    pl: r2(pl),
    pnCP: r.metas.pnCP,
    pCP: r.metas.pCP,
    saldoAoAposentar: r.marcos.saldoAoAposentar,
    mesIF: ifm ? isoMes(ifm) : null,
    idadeIF: ifm ? ifm.idade : null,
  };
}

/** Diferença em meses entre dois meses de IF (positivo = IF adiantada). null se algum não atinge. */
export function ganhoMesesIF(antes: string | null, depois: string | null): number | null {
  if (!antes || !depois) return null;
  return indiceMes(toYM(antes)) - indiceMes(toYM(depois));
}
