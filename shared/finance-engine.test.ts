import { describe, expect, it } from 'vitest';
import {
  calcularMeuFuturo,
  ganhoMesesIF,
  idadeDia1,
  idadeNoMes,
  parseDataCivil,
  projetosPorAno,
  resumirResultado,
  taxaMensal,
  taxaRealFisher,
  type MotorEntrada,
  type MotorResultado,
} from './finance-engine.ts';

// ───────────── Cenários da §5 de SPEC_DASHPLAN_CLEANROOM.md ─────────────

const base = {
  hoje: '2026-11',
  nascimento: '1991-06-15',
  idadeAposentadoria: 65,
  expectativaVidaMeta: 90,
  expectativaVidaGrafico: 101,
  sucessao: 0,
  aporteRecomendado: 5000,
  modoCompatibilidadeDashplan: true,
} satisfies Partial<MotorEntrada>;

const A: MotorEntrada = { ...base, rendaDesejada: 8000, outrasRendas: 2000, pl: 50000, metaAporte: 2000, taxaAcumulacao: 0.03, taxaAposentadoria: 0.025 };
const B: MotorEntrada = { ...base, rendaDesejada: 10000, outrasRendas: 2500, pl: 100000, metaAporte: 3000, taxaAcumulacao: 0.04, taxaAposentadoria: 0.035 };
const C: MotorEntrada = {
  ...B,
  projetos: [
    { id: 1, nome: 'Veículo à vista', tipo: 'veiculo', inicio: '2030-03-01', parcelas: 0, valor: 80000 },
    { id: 2, nome: 'Casa 24x', tipo: 'casa', inicio: '2032-01-01', parcelas: 24, valor: 120000 },
    { id: 3, nome: 'Aporte financeiro', tipo: 'aporte_financeiro', inicio: '2035-01-01', parcelas: 0, valor: 50000 },
    { id: 4, nome: 'Ajuste da meta', tipo: 'ajuste_meta', inicio: '2036-01-01', valor: 4000 },
  ],
};

const mes = (r: MotorResultado, k: number) => r.serie[k - 1];
const noMes = (r: MotorResultado, y: number, m: number) => r.serie.find((l) => l.y === y && l.m === m)!;
const pct6 = (x: number) => (x * 100).toFixed(6);
const lbl = (x: { y: number; m: number; idade: number } | null) =>
  x ? `${String(x.m).padStart(2, '0')}/${x.y} (${x.idade})` : 'não atinge';

type Esperado = {
  iAcc: string; iRet: string;
  pnVR: number; pnCP: number; pVR: number; pCP: number;
  saldo12: number; saldo60: number; saldo120: number; principal120: number;
  saldo72: number; somaFPs72: number; somaAcum72: number;
  saldoAoAposentar: number; saldo90: number; saldoFinal: number; consumoFinal: number;
  ifCP: string; ifVR: string; zera: string;
};

const tabela: Record<'A' | 'B' | 'C', [MotorEntrada, Esperado]> = {
  A: [A, {
    iAcc: '0.246627', iRet: '0.205984',
    pnVR: 2912852.87, pnCP: 1341687.45, pVR: 4907.5, pCP: 2146.53,
    saldo12: 75828.24, saldo60: 187125.63, saldo120: 346091.81, principal120: 290000,
    saldo72: 217067.64, somaFPs72: 0, somaAcum72: 167067.64,
    saldoAoAposentar: 1254892.22, saldo90: -231281.26, saldoFinal: -1062519.24, consumoFinal: -862166.07,
    ifCP: 'não atinge', ifVR: 'não atinge', zera: '05/2079 (87)',
  }],
  B: [B, {
    iAcc: '0.327374', iRet: '0.287090',
    pnVR: 2612422.36, pnCP: 1506983.7, pVR: 3409.11, pCP: 1765.1,
    saldo12: 140655.33, saldo60: 320202.36, saldo120: 588112.2, principal120: 460000,
    saldo72: 369665.78, somaFPs72: 0, somaAcum72: 269665.78,
    saldoAoAposentar: 2336544.71, saldo90: 1939568.76, saldoFinal: 1679481.96, consumoFinal: -1136591.66,
    ifCP: '12/2048 (57)', ifVR: 'não atinge', zera: 'não atinge',
  }],
  C: [C, {
    iAcc: '0.327374', iRet: '0.287090',
    pnVR: 2612422.36, pnCP: 1506983.7, pVR: 3409.11, pCP: 1765.1,
    saldo12: 140655.33, saldo60: 235076.91, saldo120: 408968.74, principal120: 320000,
    saldo72: 230392.25, somaFPs72: 130000, somaAcum72: 260392.25,
    saldoAoAposentar: 2304173.46, saldo90: 1860616.7, saldoFinal: 1570011.53, consumoFinal: -1136591.66,
    ifCP: '12/2049 (58)', ifVR: 'não atinge', zera: 'não atinge',
  }],
};

describe('Regressão §5 — modo compatibilidade Dashplan', () => {
  for (const [nome, [entrada, esp]] of Object.entries(tabela)) {
    describe(`Cenário ${nome}`, () => {
      const r = calcularMeuFuturo(entrada);

      it('premissas comuns: n_acc, n_ret, T, primeiro e último mês', () => {
        expect(r.modo).toBe('compatibilidade');
        expect(r.premissas.nAcc).toBe(356);
        expect(r.premissas.nRet).toBe(300);
        expect(r.premissas.idadeAtual).toBe(35);
        expect(r.serie).toHaveLength(782);
        expect(lbl(r.serie[0])).toBe('11/2026 (35)');
        expect(lbl(r.serie[781])).toBe('12/2091 (100)');
        expect(r.premissas.mesAposentadoriaMeta).toEqual({ y: 2056, m: 6 }); // Motor P (Q2)
        expect(lbl(r.marcos.mesAposentadoria)).toBe('07/2056 (65)'); // Motor F (Q2)
      });

      it('taxas mensais equivalentes', () => {
        expect(pct6(r.premissas.iAcc)).toBe(esp.iAcc);
        expect(pct6(r.premissas.iRet)).toBe(esp.iRet);
      });

      it('Motor P: PN_VR, PN_CP, P_VR, P_CP', () => {
        expect(r.metas.pnVR).toBe(esp.pnVR);
        expect(r.metas.pnCP).toBe(esp.pnCP);
        expect(r.metas.pVR).toBe(esp.pVR);
        expect(r.metas.pCP).toBe(esp.pCP);
      });

      it('Motor F: marcos dos meses 12, 60, 72 e 120', () => {
        expect(mes(r, 12)).toMatchObject({ y: 2027, m: 10, saldo: esp.saldo12 });
        expect(mes(r, 60)).toMatchObject({ y: 2031, m: 10, saldo: esp.saldo60 });
        expect(mes(r, 120)).toMatchObject({ y: 2036, m: 10, saldo: esp.saldo120, principal: esp.principal120 });
        expect(r.marcos.saldo72).toBe(esp.saldo72);
      });

      it('valores gravados (72 meses)', () => {
        expect(r.marcos.somaFPs72).toBe(esp.somaFPs72);
        expect(r.marcos.somaAcum72).toBe(esp.somaAcum72);
      });

      it('saldo ao aposentar, aos 90 anos e final; consumo final', () => {
        expect(r.marcos.saldoAoAposentar).toBe(esp.saldoAoAposentar);
        // Primeiro mês com idade 90 pela regra de idade do Motor F (dia 1º): 06/2082 no mês do
        // aniversário só conta para quem nasce no dia 1 → linha 06/2082 tem idade 90.
        expect(noMes(r, 2082, 6)).toMatchObject({ idade: 90, saldo: esp.saldo90 });
        expect(r.marcos.saldoFinal).toBe(esp.saldoFinal);
        expect(r.marcos.consumoFinal).toBe(esp.consumoFinal);
      });

      it('independência financeira (L9) e esgotamento', () => {
        expect(lbl(r.marcos.independenciaCP)).toBe(esp.ifCP);
        expect(lbl(r.marcos.independenciaVR)).toBe(esp.ifVR);
        expect(lbl(r.marcos.zeraPatrimonio)).toBe(esp.zera);
      });
    });
  }

  it('C: distribuição dos projetos (à vista, 24x, aporte financeiro, ajuste da meta)', () => {
    const r = calcularMeuFuturo(C);
    expect(noMes(r, 2030, 3)).toMatchObject({ fp: 80000, fps: 80000 });
    expect(noMes(r, 2030, 4)).toMatchObject({ fp: 0 });
    expect(noMes(r, 2032, 1)).toMatchObject({ fp: 5000 });
    expect(noMes(r, 2033, 12)).toMatchObject({ fp: 5000 });
    expect(noMes(r, 2034, 1)).toMatchObject({ fp: 0 });
    expect(noMes(r, 2035, 1)).toMatchObject({ fp: -50000, fps: 0 });
    expect(noMes(r, 2035, 12).aporte).toBe(3000);
    expect(noMes(r, 2036, 1).aporte).toBe(4000);
    expect(noMes(r, 2040, 5).aporte).toBe(4000); // ajuste persiste
    expect(noMes(r, 2056, 7).aporte).toBe(-7500); // ao aposentar vira saque A_apos = R_out − R_des
    expect(r.marcos.projetos.map((p) => [p.projetoId, p.y, p.m])).toEqual([
      [1, 2030, 3], [2, 2032, 1], [3, 2035, 1], [4, 2036, 1],
    ]);
  });
});

// ───────────── Modo padrão (corrigido) ─────────────

const padrao = (o: Partial<MotorEntrada> = {}): MotorEntrada => ({
  hoje: '2026-11',
  nascimento: '1991-06-15',
  idadeAposentadoria: 65,
  rendaDesejada: 10000,
  outrasRendas: 2500,
  metaAporte: 3000,
  pl: 100000,
  sucessao: 0,
  taxaAcumulacao: 0.04,
  taxaAposentadoria: 0.035,
  ...o,
});

describe('Modo padrão (correções §4.10 / L9 / L10 / L11)', () => {
  it('idade: regra dia 1º (compat) × mês do aniversário (corrigida)', () => {
    const n = parseDataCivil('1991-06-15');
    expect(idadeDia1(n, 2056, 6)).toBe(64);
    expect(idadeDia1(n, 2056, 7)).toBe(65);
    expect(idadeNoMes(n, 2056, 6)).toBe(65);
    const n1 = parseDataCivil('1991-06-01');
    expect(idadeDia1(n1, 2056, 6)).toBe(65);
  });

  it('expectativa única: série vai até o mês anterior aos 90 anos', () => {
    const r = calcularMeuFuturo(padrao());
    expect(r.modo).toBe('corrigido');
    expect(r.premissas.expectativaVidaMeta).toBe(90);
    expect(r.premissas.expectativaVidaGrafico).toBe(90);
    expect(lbl(r.serie[0])).toBe('11/2026 (35)');
    expect(lbl(r.serie.at(-1)!)).toBe('05/2081 (89)');
  });

  it('critério único de aposentadoria: mesmo mês nos dois motores', () => {
    const r = calcularMeuFuturo(padrao());
    expect(r.premissas.mesAposentadoriaMeta).toEqual({ y: 2056, m: 6 });
    expect(lbl(r.marcos.mesAposentadoria)).toBe('06/2056 (65)');
    expect(r.premissas.nAcc).toBe(355); // 11/2026 .. 05/2056
    expect(r.premissas.nRet).toBe(300); // 06/2056 .. 05/2081
  });

  it('consistência P×F: "Aposentadoria ideal" atinge PN_CP na véspera da aposentadoria e S no fim', () => {
    for (const S of [0, 300000]) {
      const r = calcularMeuFuturo(padrao({ sucessao: S }));
      const apos = r.marcos.mesAposentadoria!.t;
      expect(r.serie[apos - 2].consumo).toBeCloseTo(r.metas.pnCP, 1);
      expect(r.marcos.consumoFinal!).toBeCloseTo(S, 1);
    }
  });

  it('taxa 0% é segura (Q4): sem NaN/Infinity, perpetuidade inexistente', () => {
    const r = calcularMeuFuturo(padrao({ taxaAcumulacao: 0, taxaAposentadoria: 0 }));
    expect(r.metas.pnVR).toBeNull();
    expect(r.metas.pVR).toBeNull();
    expect(r.metas.pnCP).toBe(7500 * 300);
    expect(r.metas.pCP).toBeCloseTo((7500 * 300 - 100000) / 355, 2);
    for (const l of r.serie) expect(Number.isFinite(l.saldo) && Number.isFinite(l.consumo)).toBe(true);
    expect(r.serie[0].retorno).toBe(0);
  });

  it('P_CP com piso 0 quando PL·g > PN_CP (Q7), bruto preservado', () => {
    const r = calcularMeuFuturo(padrao({ pl: 5_000_000 }));
    expect(r.metas.pCPBruto).toBeLessThan(0);
    expect(r.metas.pCP).toBe(0);
    expect(r.marcos.independenciaCP!.t).toBe(1);
  });

  it('mês/idade de independência (L9) para PN_CP e PN_VR', () => {
    const r = calcularMeuFuturo(padrao({ metaAporte: 6000 }));
    const cp = r.marcos.independenciaCP!;
    const vr = r.marcos.independenciaVR!;
    expect(cp).not.toBeNull();
    expect(vr).not.toBeNull();
    expect(vr.t).toBeGreaterThan(cp.t);
    expect(r.serie[cp.t - 1].saldo).toBeGreaterThanOrEqual(r.metas.pnCP);
    expect(r.serie[cp.t - 2].saldo).toBeLessThan(r.metas.pnCP);
  });

  it('nominal + IPCA via Fisher (L10) equivale ao modo real com a taxa real correspondente', () => {
    const pi = 0.045;
    const nomAcc = 1.04 * 1.045 - 1;
    const nomRet = 1.035 * 1.045 - 1;
    expect(taxaRealFisher(nomAcc, pi)).toBeCloseTo(0.04, 12);
    const real = calcularMeuFuturo(padrao());
    const nominal = calcularMeuFuturo(padrao({ modoTaxa: 'nominal', inflacao: pi, taxaAcumulacao: nomAcc, taxaAposentadoria: nomRet }));
    expect(nominal.metas).toEqual(real.metas);
    expect(nominal.marcos.saldoFinal).toBe(real.marcos.saldoFinal);
    // Fisher ≠ subtração simples
    expect(taxaRealFisher(0.1, 0.05)).not.toBeCloseTo(0.05, 4);
  });

  it('já aposentado: sem acumulação, saque desde o 1º mês, consumo parte de PN_CP', () => {
    const r = calcularMeuFuturo(padrao({ nascimento: '1958-03-10', idadeAposentadoria: 65, pl: 2_000_000 }));
    expect(r.premissas.jaAposentado).toBe(true);
    expect(r.premissas.nAcc).toBe(0);
    expect(r.metas.pCP).toBe(0);
    expect(r.marcos.mesAposentadoria).toBeNull();
    expect(r.serie[0].aporte).toBe(-7500);
    expect(r.marcos.consumoFinal!).toBeCloseTo(0, 1);
  });

  it('ajuste da meta anterior a hoje vale desde o início; durante a aposentadoria é ignorado', () => {
    const r = calcularMeuFuturo(padrao({
      projetos: [
        { tipo: 'ajuste_meta', inicio: '2025-01', valor: 3500 },
        { tipo: 'ajuste_meta', inicio: '2060-01', valor: 9999 },
      ],
    }));
    expect(r.serie[0].aporte).toBe(3500);
    expect(noMes(r, 2060, 1).aporte).toBe(-7500);
  });

  it('projetos parcelados que começaram antes de hoje continuam sendo distribuídos', () => {
    const r = calcularMeuFuturo(padrao({ projetos: [{ tipo: 'casa', inicio: '2026-09', parcelas: 4, valor: 4000 }] }));
    expect(r.serie[0].fp).toBe(1000); // 11/2026 = parcela 3
    expect(r.serie[1].fp).toBe(1000); // 12/2026 = parcela 4
    expect(r.serie[2].fp).toBe(0);
  });

  it('valida entradas', () => {
    expect(() => calcularMeuFuturo(padrao({ nascimento: '1991-02-30' }))).toThrow(RangeError);
    expect(() => taxaMensal(-1)).toThrow(RangeError);
  });
});

describe('Utilitários', () => {
  it('projetosPorAno: faixas contíguas, exclui aportes e ajustes', () => {
    const f = projetosPorAno([
      { tipo: 'viagem', inicio: '2026-12', valor: 10 },
      { tipo: 'viagem', inicio: '2027-11', valor: 20 },
      { tipo: 'casa', inicio: '2030-10', valor: 40 },
      { tipo: 'casa', inicio: '2040-01', valor: 50 },
      { tipo: 'aporte_financeiro', inicio: '2027-01', valor: 999 },
      { tipo: 'ajuste_meta', inicio: '2027-01', valor: 999 },
      { tipo: 'veiculo', inicio: '2020-01', valor: 999 },
    ], '2026-11');
    expect(f).toEqual([10, 20, 0, 40, 50]);
  });

  it('resumo e ganho de meses de IF', () => {
    const r = calcularMeuFuturo(padrao());
    const s = resumirResultado('2026-11', 100000, r);
    expect(s.hoje).toBe('2026-11');
    expect(s.mesIF).toMatch(/^\d{4}-\d{2}$/);
    expect(ganhoMesesIF('2048-12', '2048-10')).toBe(2);
    expect(ganhoMesesIF(null, '2048-10')).toBeNull();
  });
});
