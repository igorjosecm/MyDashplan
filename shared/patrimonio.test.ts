import { describe, expect, it } from 'vitest';
import { dataFinalProjeto, diasEntre, mesAnterior, somarMesesData, ultimoDiaDoMes } from './meu-futuro.ts';
import { aporteEstimado, consolidarPatrimonio, frescorPL, valorNaData } from './patrimonio.ts';
import type { Bem, Conta, Divida } from './types.ts';

const conta = (o: Partial<Conta>): Conta => ({
  id: 1, institution_id: null, instituicao_nome: null, nome: 'c', tipo: 'investimento', modo_controle: 'so_saldo',
  conta_no_pl: 1, saldo_inicial_centavos: 0, data_ancora: '2026-01-01', ativa: 1, proprietario: 'eu',
  dia_fechamento: null, dia_vencimento: null, limite_centavos: null, saldo_centavos: 0, saldo_data: '2026-10-31', ...o,
});
const bem = (o: Partial<Bem>): Bem => ({
  id: 1, nome: 'b', classe: 'imovel', categoria: 'residencial', ativo: 1, proprietario: 'eu',
  atualizar_mensalmente: 0, valor_centavos: 0, valor_data: '2026-10-31', ...o,
});
const divida = (o: Partial<Divida>): Divida => ({
  id: 1, nome: 'd', tipo: 'financiamento', asset_id: 1, total_tomado_centavos: null, taxa_juros_anual: null,
  ativo: 1, proprietario: 'eu', atualizar_mensalmente: 1, saldo_devedor_centavos: 0, saldo_data: '2026-10-31', ...o,
});
const perfilContas = { modo_pl_manual: 0 as const, pl_manual_centavos: 0, pl_manual_data: null };

describe('Patrimônio (R-PA1..R-PA5)', () => {
  const p = consolidarPatrimonio({
    data: '2026-10-31',
    hoje: '2026-11-23',
    perfil: perfilContas,
    contas: [
      conta({ id: 1, tipo: 'corrente', conta_no_pl: 0, saldo_centavos: 500_00 }),
      conta({ id: 2, conta_no_pl: 1, saldo_centavos: 100_000_00, saldo_data: '2026-10-31' }),
      conta({ id: 3, tipo: 'previdencia', conta_no_pl: 1, saldo_centavos: 50_000_00, saldo_data: '2026-09-30' }),
      conta({ id: 4, tipo: 'cartao', conta_no_pl: 0, saldo_centavos: -2_000_00 }),
      conta({ id: 5, conta_no_pl: 1, saldo_centavos: 999_00, ativa: 0 }),
    ],
    bens: [bem({ valor_centavos: 600_000_00 }), bem({ id: 2, categoria: 'investimentos', valor_centavos: 300_000_00 })],
    dividas: [divida({ saldo_devedor_centavos: 250_000_00 })],
  });

  it('ativos, passivos, PL líquido e % comprometido', () => {
    expect(p.ativos_centavos).toBe(500_00 + 100_000_00 + 50_000_00 + 600_000_00 + 300_000_00);
    expect(p.passivos_centavos).toBe(250_000_00 + 2_000_00);
    expect(p.patrimonio_liquido_centavos).toBe(p.ativos_centavos - p.passivos_centavos);
    expect(p.pct_comprometido).toBe(Math.round((252_000 / 1_050_500) * 1000) / 10);
  });

  it('gerador de renda × uso pessoal', () => {
    expect(p.gerador_renda_centavos).toBe(100_000_00 + 50_000_00 + 300_000_00);
    expect(p.uso_pessoal_centavos).toBe(p.ativos_centavos - p.gerador_renda_centavos);
  });

  it('patrimônio investível = contas ativas com conta_no_pl; frescor pela data mais antiga', () => {
    expect(p.investivel.pl_centavos).toBe(150_000_00);
    expect(p.investivel.fonte).toBe('contas');
    expect(p.investivel.data_base).toBe('2026-09-30');
    expect(p.investivel.dias).toBe(54);
    expect(p.investivel.desatualizado).toBe(true);
  });

  it('ONB-1: em modo manual o PL é o valor informado', () => {
    const f = frescorPL([conta({ saldo_centavos: 10_00 })], { modo_pl_manual: 1, pl_manual_centavos: 77_00, pl_manual_data: '2026-11-20' }, '2026-11-23');
    expect(f).toMatchObject({ pl_centavos: 77_00, fonte: 'manual', pl_contas_centavos: 10_00, dias: 3, desatualizado: false });
  });
});

describe('Auxiliares de data e saldo', () => {
  it('valorNaData pega o último ponto até a data', () => {
    const pts = [{ data: '2026-08-31', valor_centavos: 1 }, { data: '2026-10-31', valor_centavos: 3 }, { data: '2026-09-30', valor_centavos: 2 }];
    expect(valorNaData(pts, '2026-10-15')?.valor_centavos).toBe(2);
    expect(valorNaData(pts, '2026-01-01')).toBeNull();
  });
  it('datas', () => {
    expect(somarMesesData('2026-01-31', 1)).toBe('2026-02-28');
    expect(dataFinalProjeto('2029-03-01', 24)).toBe('2031-03-01');
    expect(dataFinalProjeto('2029-03-01', 0)).toBe('2029-03-01');
    expect(ultimoDiaDoMes('2028-02')).toBe('2028-02-29');
    expect(mesAnterior('2027-01')).toBe('2026-12');
    expect(diasEntre('2026-10-31', '2026-11-23')).toBe(23);
  });
  it('aporte estimado (§7.1)', () => {
    expect(aporteEstimado(105_000_00, 100_000_00, 0.01)).toBe(4_000_00);
  });
});
