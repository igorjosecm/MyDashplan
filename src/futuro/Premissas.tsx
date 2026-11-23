import { taxaRealFisher } from '../../shared/finance-engine.ts';
import type { PlanoEditavel } from '../../shared/types.ts';
import { IconeCheck, IconeRelogio } from '../components/icones.tsx';
import { Botao, CampoNumero, CampoSlider, Modal, Segmentado } from '../components/ui.tsx';
import { fmtPct } from '../lib/format.ts';

export type Mudar = (patch: Partial<PlanoEditavel>) => void;
export type EstadoSalvar = 'ocioso' | 'pendente' | 'salvando' | 'salvo' | 'erro';

export function IndicadorSalvar({ estado }: { estado: EstadoSalvar }) {
  if (estado === 'ocioso') return null;
  const m = {
    pendente: ['Alterações pendentes…', <IconeRelogio key="i" tamanho={14} />],
    salvando: ['Salvando…', <IconeRelogio key="i" tamanho={14} />],
    salvo: ['Salvo', <IconeCheck key="i" tamanho={14} />],
    erro: ['Erro ao salvar — tente de novo', null],
  }[estado];
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] ${estado === 'erro' ? 'text-critical' : 'text-ink-3'}`} aria-live="polite">
      {m[1]}
      {m[0]}
    </span>
  );
}

export function SlidersPremissas({ plano, mudar }: { plano: PlanoEditavel; mudar: Mudar }) {
  return (
    <div className="space-y-5">
      <CampoSlider
        rotulo="Idade de aposentadoria"
        valor={plano.idade_aposentadoria}
        aoMudar={(v) => mudar({ idade_aposentadoria: v })}
        min={40}
        max={Math.max(41, Math.min(85, plano.expectativa_vida - 1))}
        sufixo=" anos"
      />
      <CampoSlider rotulo="Renda desejada (por mês, R$ de hoje)" dinheiro valor={plano.renda_desejada_centavos} aoMudar={(v) => mudar({ renda_desejada_centavos: Math.max(0, v) })} min={0} max={50000} passo={100} />
      <CampoSlider rotulo="Outras rendas na aposentadoria (INSS, aluguel…)" dinheiro valor={plano.outras_rendas_centavos} aoMudar={(v) => mudar({ outras_rendas_centavos: Math.max(0, v) })} min={0} max={30000} passo={100} />
      <CampoSlider rotulo="Meta de aporte mensal" dinheiro valor={plano.meta_aporte_mensal_centavos} aoMudar={(v) => mudar({ meta_aporte_mensal_centavos: Math.max(0, v) })} min={0} max={30000} passo={50} />
      <CampoSlider rotulo="Patrimônio de sucessão (deixar como herança)" dinheiro valor={plano.patrimonio_sucessao_centavos} aoMudar={(v) => mudar({ patrimonio_sucessao_centavos: Math.max(0, v) })} min={0} max={3_000_000} passo={10_000} />
    </div>
  );
}

const PADRAO = { taxa_real_anual_acumulacao: 0.04, taxa_real_anual_aposentadoria: 0.035, expectativa_vida: 90, modo_taxa: 'real' as const };

/** Popup "premissas avançadas": taxas (real ou nominal + IPCA), expectativa de vida. */
export function ModalPremissas({ aberto, aoFechar, plano, mudar }: { aberto: boolean; aoFechar: () => void; plano: PlanoEditavel; mudar: Mudar }) {
  const pct = (x: number) => Math.round(x * 10000) / 100;
  const de = (v: number) => v / 100;
  const nominal = plano.modo_taxa === 'nominal';
  const realAcc = nominal ? taxaRealFisher(plano.taxa_nominal_anual_acumulacao, plano.inflacao_anual) : plano.taxa_real_anual_acumulacao;
  const realRet = nominal ? taxaRealFisher(plano.taxa_nominal_anual_aposentadoria, plano.inflacao_anual) : plano.taxa_real_anual_aposentadoria;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Premissas da simulação"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => mudar(PADRAO)}>
            Restaurar padrão
          </Botao>
          <Botao onClick={aoFechar}>Concluir</Botao>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="rotulo">Como você quer informar as taxas?</p>
          <Segmentado
            rotulo="Modo das taxas"
            valor={plano.modo_taxa}
            aoMudar={(v) => mudar({ modo_taxa: v })}
            opcoes={[
              { valor: 'real', rotulo: 'Taxa real (acima da inflação)' },
              { valor: 'nominal', rotulo: 'Nominal + IPCA' },
            ]}
          />
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
            O plano é sempre calculado em termos reais (R$ de hoje). No modo nominal, a taxa real vem da equação de Fisher:
            (1 + nominal) ÷ (1 + IPCA) − 1.
          </p>
        </div>

        {nominal ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CampoNumero rotulo="Rentabilidade até aposentar" sufixo="% a.a." valor={pct(plano.taxa_nominal_anual_acumulacao)} aoMudar={(v) => mudar({ taxa_nominal_anual_acumulacao: de(v) })} min={-50} max={100} />
            <CampoNumero rotulo="Rentabilidade aposentado" sufixo="% a.a." valor={pct(plano.taxa_nominal_anual_aposentadoria)} aoMudar={(v) => mudar({ taxa_nominal_anual_aposentadoria: de(v) })} min={-50} max={100} />
            <CampoNumero rotulo="Inflação (IPCA)" sufixo="% a.a." valor={pct(plano.inflacao_anual)} aoMudar={(v) => mudar({ inflacao_anual: de(v) })} min={-20} max={100} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoNumero rotulo="Taxa real até aposentar" sufixo="% a.a." valor={pct(plano.taxa_real_anual_acumulacao)} aoMudar={(v) => mudar({ taxa_real_anual_acumulacao: de(v) })} min={-50} max={50} ajuda="Padrão: 4% a.a." />
            <CampoNumero rotulo="Taxa real aposentado" sufixo="% a.a." valor={pct(plano.taxa_real_anual_aposentadoria)} aoMudar={(v) => mudar({ taxa_real_anual_aposentadoria: de(v) })} min={-50} max={50} ajuda="Padrão: 3,5% a.a." />
          </div>
        )}
        <div className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-ink-2">
          Taxas reais usadas: <strong className="tnum">{fmtPct(realAcc, 2)}</strong> a.a. acumulando ·{' '}
          <strong className="tnum">{fmtPct(realRet, 2)}</strong> a.a. aposentado
          {(realAcc === 0 || realRet === 0) && <span className="block text-[12px]">Taxa 0% é aceita: o patrimônio só cresce com os aportes.</span>}
        </div>

        <CampoSlider
          rotulo="Expectativa de vida (horizonte do plano e do gráfico)"
          valor={plano.expectativa_vida}
          aoMudar={(v) => mudar({ expectativa_vida: v, ...(plano.idade_aposentadoria >= v ? { idade_aposentadoria: v - 1 } : {}) })}
          min={60}
          max={110}
          sufixo=" anos"
        />
      </div>
    </Modal>
  );
}
