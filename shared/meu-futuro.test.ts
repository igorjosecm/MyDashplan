import { describe, expect, it } from 'vitest';
import { entradaDoPlano, rodarMeuFuturo } from './meu-futuro.ts';

const plano = {
  modo_taxa: 'real' as const,
  taxa_real_anual_acumulacao: 0.04,
  taxa_real_anual_aposentadoria: 0.035,
  taxa_nominal_anual_acumulacao: 0.09,
  taxa_nominal_anual_aposentadoria: 0.08,
  inflacao_anual: 0.045,
  idade_aposentadoria: 65,
  expectativa_vida: 90,
  renda_desejada_centavos: 10_000_00,
  outras_rendas_centavos: 2_500_00,
  meta_aporte_mensal_centavos: 3_000_00,
  patrimonio_sucessao_centavos: 0,
};
const projetos = [
  { id: 1, nome: 'Carro', tipo: 'veiculo' as const, valor_centavos: 80_000_00, data_inicial: '2030-03-01', parcelas: 0, ativo: 1 as const },
  { id: 2, nome: 'Inativo', tipo: 'casa' as const, valor_centavos: 1_00, data_inicial: '2030-03-01', parcelas: 0, ativo: 0 as const },
];

describe('entradaDoPlano (centavos → motor)', () => {
  it('converte centavos, usa modo corrigido e repassa só projetos ativos', () => {
    const e = entradaDoPlano({ hoje: '2026-11-23', nascimento: '1991-06-15', plano, projetos, plCentavos: 100_000_00 });
    expect(e).toMatchObject({ rendaDesejada: 10000, outrasRendas: 2500, metaAporte: 3000, pl: 100000, taxaAcumulacao: 0.04, modoCompatibilidadeDashplan: false });
    expect(e.projetos).toEqual([{ id: 1, nome: 'Carro', tipo: 'veiculo', valor: 80000, inicio: '2030-03-01', parcelas: 0 }]);
    const r = rodarMeuFuturo({ hoje: '2026-11-23', nascimento: '1991-06-15', plano, projetos, plCentavos: 100_000_00 });
    expect(r.serie.find((l) => l.y === 2030 && l.m === 3)!.fp).toBe(80000);
  });

  it('modo nominal usa as taxas nominais + inflação', () => {
    const e = entradaDoPlano({ hoje: '2026-11', nascimento: '1991-06-15', plano: { ...plano, modo_taxa: 'nominal' }, projetos: [], plCentavos: 0 });
    expect(e).toMatchObject({ modoTaxa: 'nominal', taxaAcumulacao: 0.09, taxaAposentadoria: 0.08, inflacao: 0.045 });
  });
});
