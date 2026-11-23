import { useState } from 'react';
import type { MotorResultado } from '../../shared/finance-engine.ts';
import type { PlanoEditavel } from '../../shared/types.ts';
import { IconeAlerta, IconeCheck, IconeLapis } from '../components/icones.tsx';
import { Botao, CampoDinheiro, Modal, Segmentado, Selo } from '../components/ui.tsx';
import { fmtBRL, fmtCentavos, fmtMesCurto } from '../lib/format.ts';
import type { Mudar } from './Premissas.tsx';

/** Mensagem de recomendação (§4.8) + comparação com a meta de aporte. */
export function CardRecomendacao({ r, plano }: { r: MotorResultado; plano: PlanoEditavel }) {
  const { pCP, pnCP } = r.metas;
  const meta = plano.meta_aporte_mensal_centavos / 100;
  const I = plano.idade_aposentadoria;
  let texto: React.ReactNode;
  if (r.premissas.jaAposentado) {
    texto = (
      <>
        Você já está na fase de aposentadoria. Para sustentar a renda até os {plano.expectativa_vida} anos, o ideal é ter{' '}
        <strong>{fmtBRL(pnCP)}</strong> hoje.
      </>
    );
  } else if (pnCP < 1) {
    texto = <>Suas outras rendas já cobrem a renda desejada: não é preciso acumular patrimônio para a aposentadoria.</>;
  } else if (pCP > 0) {
    texto = (
      <>
        Invista <strong className="text-brand-700">{fmtBRL(pCP)}/mês</strong> até os {I} anos para atingir <strong>{fmtBRL(pnCP)}</strong>.
      </>
    );
  } else {
    texto = (
      <>
        Seu patrimônio atual já cresce até o necessário sem novos aportes. Mantenha <strong>{fmtBRL(pnCP)}</strong> acumulados até os {I} anos.
      </>
    );
  }
  const falta = pCP - meta;
  return (
    <div className="card border-brand-100 bg-brand-50/60 p-4 sm:p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-700">Recomendação</p>
      <p className="mt-1.5 text-[16px] leading-snug text-ink">{texto}</p>
      {!r.premissas.jaAposentado && pCP > 0 && (
        <div className="mt-3">
          {falta <= 0.005 ? (
            <Selo tom="ok" icone={<IconeCheck tamanho={14} />}>
              Sua meta de {fmtBRL(meta)} cobre o recomendado
            </Selo>
          ) : (
            <Selo tom="aviso" icone={<IconeAlerta tamanho={14} />}>
              Faltam {fmtBRL(falta)}/mês na sua meta de {fmtBRL(meta)}
            </Selo>
          )}
        </div>
      )}
    </div>
  );
}

/** Card "Independência" (PN_CP, com opção de ver PN_VR) + mês/idade de IF (L9). */
export function CardIndependencia({ r, plano, modo, setModo }: { r: MotorResultado; plano: PlanoEditavel; modo: 'cp' | 'vr'; setModo: (m: 'cp' | 'vr') => void }) {
  const pn = modo === 'cp' ? r.metas.pnCP : r.metas.pnVR;
  const ifm = modo === 'cp' ? r.marcos.independenciaCP : r.marcos.independenciaVR;
  const apos = r.marcos.mesAposentadoria;
  const antes = ifm && apos ? apos.t - ifm.t : null;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Independência financeira</h2>
        <Segmentado
          rotulo="Critério de independência"
          valor={modo}
          aoMudar={setModo}
          opcoes={[
            { valor: 'cp', rotulo: 'Consumir patrimônio' },
            { valor: 'vr', rotulo: 'Viver de renda' },
          ]}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <div>
          <p className="text-[13px] text-ink-2">Patrimônio necessário</p>
          <p className="mt-0.5 text-[24px] font-semibold tracking-tight">{pn === null ? '—' : fmtBRL(pn < 1 ? 0 : pn)}</p>
          <p className="mt-1 text-[12px] leading-snug text-ink-3">
            {modo === 'cp'
              ? `Sustenta ${fmtCentavos(Math.max(0, plano.renda_desejada_centavos - plano.outras_rendas_centavos))}/mês até os ${plano.expectativa_vida} anos${
                  plano.patrimonio_sucessao_centavos ? `, deixando ${fmtCentavos(plano.patrimonio_sucessao_centavos)}` : ''
                }.`
              : pn === null
                ? 'Com taxa real ≤ 0% não é possível viver só dos rendimentos.'
                : 'Vive só dos rendimentos, sem consumir o principal.'}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-ink-2">Você chega lá em</p>
          {ifm ? (
            <>
              <p className="mt-0.5 text-[24px] font-semibold tracking-tight">
                {fmtMesCurto(ifm.y, ifm.m)}{' '}
                <span className="whitespace-nowrap text-[15px] font-medium text-ink-2">· aos {ifm.idade} anos</span>
              </p>
              <p className="mt-1 text-[12px] text-ink-3">
                {ifm.t === 1
                  ? 'Você já atingiu esse patrimônio.'
                  : antes !== null && antes > 0
                    ? `${Math.floor(antes / 12)} ano(s) e ${antes % 12} mês(es) antes da aposentadoria planejada.`
                    : 'Primeiro mês em que o patrimônio projetado alcança o necessário.'}
              </p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-[20px] font-semibold text-ink-2">Não atinge</p>
              <p className="mt-1 text-[12px] text-ink-3">Aumente a meta de aporte, adie a aposentadoria ou revise a renda desejada.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CardReserva({ plano, mudar }: { plano: PlanoEditavel; mudar: Mudar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(plano.colchao_seguranca_centavos);
  const v = plano.colchao_seguranca_centavos;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Reserva de emergência</h2>
        <button
          type="button"
          className="rounded-md p-1.5 text-ink-2 hover:bg-sunken"
          onClick={() => {
            setValor(v);
            setEditando(true);
          }}
          aria-label="Editar reserva de emergência"
        >
          <IconeLapis tamanho={16} />
        </button>
      </div>
      {v >= 100 ? (
        <>
          <p className="mt-2 text-[24px] font-semibold tracking-tight">{fmtCentavos(v)}</p>
          <p className="mt-1 text-[12px] text-ink-3">Meta de colchão para imprevistos (fora do plano de aposentadoria).</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[14px] text-ink-2">Você ainda não definiu sua reserva.</p>
          <Botao tamanho="sm" variante="secundario" className="mt-3" onClick={() => setEditando(true)}>
            Criar reserva
          </Botao>
        </>
      )}
      <Modal
        aberto={editando}
        aoFechar={() => setEditando(false)}
        titulo="Reserva de emergência"
        largura="max-w-sm"
        rodape={
          <Botao
            onClick={() => {
              mudar({ colchao_seguranca_centavos: Math.max(0, valor), colchao_customizado: 1 });
              setEditando(false);
            }}
          >
            Salvar
          </Botao>
        }
      >
        <CampoDinheiro
          rotulo="Valor da reserva"
          valor={valor}
          aoMudar={setValor}
          autoFocus
          ajuda="Referência comum: 6× suas despesas obrigatórias. O cálculo automático a partir do orçamento chega na Etapa 3."
        />
      </Modal>
    </div>
  );
}
