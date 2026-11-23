import { useEffect, useMemo, useState } from 'react';
import type { MotorResultado } from '../../shared/finance-engine.ts';
import { mesAnterior, rodarMeuFuturo } from '../../shared/meu-futuro.ts';
import { CAMPOS_PLANO_EDITAVEIS, type FuturoResposta, type PlanoEditavel } from '../../shared/types.ts';
import { IconeAjustes, IconeAlerta, IconeFechamento, IconeRelogio, IconeSeta } from '../components/icones.tsx';
import { Botao, Cabecalho, Card, Carregando, MensagemErro, Selo, useUI } from '../components/ui.tsx';
import { CardIndependencia, CardRecomendacao, CardReserva } from '../futuro/CardsFuturo.tsx';
import { GraficoFuturo } from '../futuro/GraficoFuturo.tsx';
import { IndicadorSalvar, ModalPremissas, SlidersPremissas } from '../futuro/Premissas.tsx';
import { BarrasProjetos, ListaProjetos } from '../futuro/Projetos.tsx';
import { api, mensagemErro } from '../lib/api.ts';
import { fmtBRL, fmtCentavos, fmtData, fmtMesLongo } from '../lib/format.ts';
import { useRecurso, useSalvarComDebounce } from '../lib/hooks.ts';
import { useOnb1 } from '../lib/onb1.tsx';

const editavel = (p: FuturoResposta['plano']): PlanoEditavel =>
  Object.fromEntries(CAMPOS_PLANO_EDITAVEIS.map((k) => [k, p[k]])) as PlanoEditavel;

export function MeuFuturo() {
  const { toast } = useUI();
  const recurso = useRecurso<FuturoResposta>('/future');
  const d = recurso.dados;
  const [plano, setPlano] = useState<PlanoEditavel | null>(null);
  const [premissasAbertas, setPremissasAbertas] = useState(false);
  const [modoIF, setModoIF] = useState<'cp' | 'vr'>('cp');
  const perguntarOnb1 = useOnb1();

  useEffect(() => {
    if (d) setPlano(editavel(d.plano));
  }, [d?.plano]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (d?.onb1.perguntar) perguntarOnb1(d.onb1).then((mudou) => mudou && recurso.recarregar());
  }, [d?.onb1.perguntar]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = useSalvarComDebounce<PlanoEditavel>(async (patch) => {
    try {
      await api.put('/future/plan', patch);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
      throw e;
    }
  });
  const mudar = (patch: Partial<PlanoEditavel>) => {
    setPlano((p) => (p ? { ...p, ...patch } : p));
    salvar.agendar(patch);
  };

  // O motor roda no navegador a cada mudança (resposta imediata); a API só persiste.
  const calc = useMemo<{ r: MotorResultado | null; erro: string | null }>(() => {
    if (!d || !plano || !d.perfil.data_nascimento) return { r: null, erro: null };
    try {
      return {
        r: rodarMeuFuturo({ hoje: d.hoje, nascimento: d.perfil.data_nascimento, plano, projetos: d.projetos, plCentavos: d.pl.pl_centavos }),
        erro: null,
      };
    } catch (e) {
      return { r: null, erro: mensagemErro(e) };
    }
  }, [d, plano]);

  if (recurso.erro) return <MensagemErro erro={recurso.erro} tentar={recurso.recarregar} />;
  if (!d || !plano) return <Carregando />;

  const mesPendente = mesAnterior(d.hoje.slice(0, 7));
  const fechamentoPendente = !d.fechamentos.some((f) => f.mes === mesPendente);
  const r = calc.r;

  return (
    <div className="space-y-4">
      <Cabecalho
        titulo="Meu Futuro"
        subtitulo={
          <>
            {d.perfil.nome ? `${d.perfil.nome}, ` : ''}projeção em valores de hoje (descontada a inflação).
          </>
        }
        acoes={
          <>
            <IndicadorSalvar estado={salvar.estado} />
            <Botao variante="secundario" tamanho="sm" onClick={() => setPremissasAbertas(true)}>
              <IconeAjustes tamanho={16} /> Premissas
            </Botao>
          </>
        }
      />

      {fechamentoPendente && (
        <a href="#/fechamento" className="card flex items-center gap-3 border-brand-100 px-4 py-3 hover:bg-brand-50/50">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <IconeFechamento tamanho={20} />
          </span>
          <span className="flex-1 text-[14px]">
            <strong>Fechar {fmtMesLongo(mesPendente)}</strong>
            <span className="block text-[13px] text-ink-2">Atualize seus saldos (~8 min) e veja o efeito no seu futuro.</span>
          </span>
          <IconeSeta tamanho={18} className="text-ink-3" />
        </a>
      )}

      {!d.perfil.data_nascimento ? (
        <DataNascimentoFaltando aoSalvar={recurso.recarregar} />
      ) : calc.erro || !r ? (
        <MensagemErro erro={calc.erro ?? 'Não foi possível calcular.'} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
            <Card
              titulo="Projeção do patrimônio"
              acao={<SeloFrescor pl={d.pl} />}
              className="min-w-0"
            >
              {r.serie.length === 0 ? (
                <p className="py-10 text-center text-[14px] text-ink-2">Sem meses a projetar: sua idade já passou da expectativa de vida configurada.</p>
              ) : (
                <GraficoFuturo r={r} nascimento={d.perfil.data_nascimento} fechamentos={d.fechamentos} modoIF={modoIF} />
              )}
            </Card>
            <div className="flex flex-col gap-4">
              <CardRecomendacao r={r} plano={plano} />
              <Card titulo="Seus números">
                <dl className="space-y-2.5 text-[14px]">
                  <Linha rotulo="Patrimônio investível hoje" valor={fmtCentavos(d.pl.pl_centavos)} />
                  <Linha rotulo={`Projetado ao aposentar (${plano.idade_aposentadoria} anos)`} valor={r.marcos.saldoAoAposentar === null ? '—' : fmtBRL(r.marcos.saldoAoAposentar)} />
                  <Linha rotulo="Meta de aporte" valor={`${fmtCentavos(plano.meta_aporte_mensal_centavos)}/mês`} />
                  {r.marcos.zeraPatrimonio && (
                    <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-[13px] text-warning-ink">
                      <IconeAlerta tamanho={16} className="mt-0.5 shrink-0" />
                      O patrimônio projetado acaba aos {r.marcos.zeraPatrimonio.idade} anos.
                    </div>
                  )}
                </dl>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
            <Card titulo="Ajuste seu plano" acao={<span className="text-[12px] text-ink-3">O gráfico atualiza na hora</span>}>
              <SlidersPremissas plano={plano} mudar={mudar} />
            </Card>
            <div className="flex flex-col gap-4">
              <CardIndependencia r={r} plano={plano} modo={modoIF} setModo={setModoIF} />
              <CardReserva plano={plano} mudar={mudar} />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Card titulo="Projetos nos próximos anos">
          <BarrasProjetos projetos={d.projetos} hoje={d.hoje} />
        </Card>
        <Card titulo="Projetos de vida">
          <ListaProjetos projetos={d.projetos} hoje={d.hoje} aoMudar={(lista) => recurso.setDados({ ...d, projetos: lista })} />
        </Card>
      </div>

      <ModalPremissas aberto={premissasAbertas} aoFechar={() => setPremissasAbertas(false)} plano={plano} mudar={mudar} />
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-2">{rotulo}</dt>
      <dd className="tnum font-semibold">{valor}</dd>
    </div>
  );
}

/** "PL baseado em saldos de dd/mm" — âmbar acima de 35 dias (SPEC_ENTRADA_MANUAL §3.2). */
export function SeloFrescor({ pl }: { pl: FuturoResposta['pl'] }) {
  if (!pl.data_base) return <Selo icone={<IconeRelogio tamanho={13} />}>PL sem saldos ainda</Selo>;
  const texto = `${pl.fonte === 'manual' ? 'PL informado em' : 'PL baseado em saldos de'} ${fmtData(pl.data_base, true)}`;
  return pl.desatualizado ? (
    <a href="#/fechamento" title={`Atualizado há ${pl.dias} dias — atualize no Fechamento do mês`}>
      <Selo tom="aviso" icone={<IconeAlerta tamanho={13} />}>
        {texto} · {pl.dias} dias
      </Selo>
    </a>
  ) : (
    <Selo tom="neutro" icone={<IconeRelogio tamanho={13} />}>
      {texto}
    </Selo>
  );
}

function DataNascimentoFaltando({ aoSalvar }: { aoSalvar: () => void }) {
  const { toast } = useUI();
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);
  return (
    <Card titulo="Falta só a sua data de nascimento">
      <p className="mb-3 text-[14px] text-ink-2">Ela define sua idade em cada mês da projeção.</p>
      <div className="flex flex-wrap items-end gap-2">
        <input type="date" className="campo max-w-[200px]" value={data} onChange={(e) => setData(e.target.value)} min="1920-01-01" aria-label="Data de nascimento" />
        <Botao
          disabled={!data}
          carregando={salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await api.put('/profile', { data_nascimento: data });
              aoSalvar();
            } catch (e) {
              toast(mensagemErro(e), 'erro');
            } finally {
              setSalvando(false);
            }
          }}
        >
          Calcular meu futuro
        </Botao>
      </div>
    </Card>
  );
}
