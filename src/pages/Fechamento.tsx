import { useEffect, useMemo, useState } from 'react';
import type { Fechamento as TFechamento, FuturoResposta, PrepararFechamentoResposta, ResultadoFechamento } from '../../shared/types.ts';
import { navegar } from '../App.tsx';
import { IconeAlerta, IconeCheck, IconeLixeira, IconeSeta, IconeVoltar } from '../components/icones.tsx';
import { Alternador, Botao, Cabecalho, Card, CampoDinheiro, Carregando, MensagemErro, Selo, useUI } from '../components/ui.tsx';
import { api, mensagemErro } from '../lib/api.ts';
import { fmtCentavos, fmtData, fmtMesIso, fmtMesLongo } from '../lib/format.ts';
import { useRecurso } from '../lib/hooks.ts';
import { useOnb1 } from '../lib/onb1.tsx';

type Chave = `${'conta' | 'bem' | 'divida'}:${number}`;
const PASSOS = ['Contas e investimentos', 'Bens e dívidas', 'Revisão'];

export function Fechamento() {
  const { toast, confirmar } = useUI();
  const perguntarOnb1 = useOnb1();
  const [mes, setMes] = useState<string | null>(null);
  const prep = useRecurso<PrepararFechamentoResposta>(`/closings/preparar${mes ? `?mes=${mes}` : ''}`);
  const historico = useRecurso<TFechamento[]>('/closings');
  const [passo, setPasso] = useState(-1); // -1 = início
  const [valores, setValores] = useState<Record<Chave, number>>({});
  const [conferidos, setConferidos] = useState<Set<Chave>>(new Set());
  const [informarAporte, setInformarAporte] = useState(false);
  const [aporte, setAporte] = useState(0);
  const [todosBens, setTodosBens] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoFechamento | null>(null);

  const d = prep.dados;
  useEffect(() => {
    if (!d) return;
    const v: Record<Chave, number> = {};
    for (const c of d.contas) v[`conta:${c.id}`] = c.tipo === 'cartao' ? -c.saldo_centavos : c.saldo_centavos;
    for (const b of d.bens) v[`bem:${b.id}`] = b.valor_centavos;
    for (const x of d.dividas) v[`divida:${x.id}`] = x.saldo_devedor_centavos;
    setValores(v);
    setConferidos(new Set());
  }, [d]);

  const bensVisiveis = useMemo(() => (d ? d.bens.filter((b) => todosBens || b.atualizar_mensalmente === 1) : []), [d, todosBens]);
  const dividasVisiveis = useMemo(() => (d ? d.dividas.filter((x) => todosBens || x.atualizar_mensalmente === 1) : []), [d, todosBens]);

  const plNovo = useMemo(
    () => (d ? d.contas.filter((c) => c.conta_no_pl === 1).reduce((s, c) => s + (valores[`conta:${c.id}`] ?? c.saldo_centavos), 0) : 0),
    [d, valores],
  );
  const aporteEstimado = d && d.pl_anterior_centavos !== null ? Math.round(plNovo - d.pl_anterior_centavos * (1 + d.taxa_mensal_acumulacao)) : null;

  if (prep.erro) return <MensagemErro erro={prep.erro} tentar={prep.recarregar} />;
  if (!d) return <Carregando />;

  const mudar = (k: Chave, v: number) => {
    setValores((x) => ({ ...x, [k]: v }));
    setConferidos((s) => new Set(s).add(k));
  };

  async function concluir() {
    if (!d) return;
    setEnviando(true);
    try {
      const itens = [
        ...d.contas.map((c) => ({ alvo_tipo: 'conta' as const, alvo_id: c.id, valor_centavos: c.tipo === 'cartao' ? -valores[`conta:${c.id}`] : valores[`conta:${c.id}`] })),
        ...bensVisiveis.map((b) => ({ alvo_tipo: 'bem' as const, alvo_id: b.id, valor_centavos: valores[`bem:${b.id}`] })),
        ...dividasVisiveis.map((x) => ({ alvo_tipo: 'divida' as const, alvo_id: x.id, valor_centavos: valores[`divida:${x.id}`] })),
      ];
      const r = await api.post<ResultadoFechamento>('/closings', {
        mes: d.mes,
        itens,
        aporte_informado_centavos: informarAporte ? aporte : null,
      });
      setResultado(r);
      historico.recarregar();
      toast(`Fechamento de ${fmtMesLongo(d.mes)} concluído.`);
      const futuro = await api.get<FuturoResposta>('/future');
      await perguntarOnb1(futuro.onb1);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function desfazer(f: TFechamento) {
    const r = await confirmar({
      titulo: `Desfazer o fechamento de ${fmtMesLongo(f.mes)}?`,
      texto: 'Remove o registro do fechamento e os saldos/ajustes gravados por ele. Saldos lançados fora do fechamento continuam.',
      opcoes: [{ rotulo: 'Desfazer', valor: 'sim', variante: 'perigo' }],
    });
    if (!r) return;
    try {
      await api.del(`/closings/${f.id}`);
      toast('Fechamento desfeito.');
      historico.recarregar();
      prep.recarregar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  if (resultado) return <Resumo r={resultado} aoNovo={() => (setResultado(null), setPasso(-1), setMes(null), prep.recarregar())} />;

  const mesHoje = d.hoje.slice(0, 7);
  // Função de renderização (não componente): manter o foco do campo enquanto digita.
  const itemValor = ({ k, nome, detalhe, rotulo, anterior, data, negativo }: { k: Chave; nome: string; detalhe: string; rotulo: string; anterior: number; data: string | null; negativo?: boolean }) => {
    const v = valores[k] ?? anterior;
    const ok = conferidos.has(k);
    return (
      <li key={k} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[1fr_12rem_auto] sm:items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-medium">
            {ok && <IconeCheck tamanho={15} className="text-good-ink" aria-label="conferido" />}
            {nome}
          </p>
          <p className="text-[12px] text-ink-3">
            {detalhe} · último: {fmtCentavos(anterior)} {data ? `em ${fmtData(data, true)}` : ''}
          </p>
        </div>
        <CampoDinheiro rotulo={undefined} valor={v} aoMudar={(x) => mudar(k, x)} permitirNegativo={negativo} id={`fc-${k}`} />
        <Botao variante={ok ? 'fantasma' : 'secundario'} tamanho="sm" onClick={() => mudar(k, anterior)} aria-label={`${nome}: mesmo valor`}>
          {rotulo}
        </Botao>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Fechamento do mês" subtitulo="Um ritual rápido: atualize os saldos e veja o efeito no seu futuro." />

      {passo === -1 && (
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="rotulo" htmlFor="fc-mes">
                Mês a fechar
              </label>
              <input
                id="fc-mes"
                type="month"
                className="campo w-auto"
                value={d.mes}
                max={mesHoje}
                onChange={(e) => {
                  if (e.target.value) setMes(e.target.value);
                }}
              />
            </div>
            <p className="pb-2 text-[13px] text-ink-2">
              Saldos na data de referência <strong>{fmtData(d.data_referencia)}</strong>
              {d.mes === mesHoje ? ' (mês em andamento: hoje)' : ''}.
            </p>
          </div>
          {d.ja_existe && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning-bg px-3 py-2 text-[13px] text-warning-ink">
              <IconeAlerta tamanho={16} /> {fmtMesLongo(d.mes)} já foi fechado. Fechar de novo substitui os valores daquele fechamento.
            </p>
          )}
          <ol className="mt-4 grid gap-2 text-[14px] sm:grid-cols-3">
            {[
              [`${d.contas.length} conta(s)`, 'Digite o saldo atual de cada uma, ou toque em "igual".'],
              [`${d.bens.length + d.dividas.length} bem(ns) e dívida(s)`, 'Só os marcados para atualizar todo mês (financiamentos, por exemplo).'],
              ['Resumo', 'Patrimônio, aporte real × meta e o efeito no Meu Futuro.'],
            ].map(([t, x], i) => (
              <li key={i} className="rounded-xl bg-sunken p-3">
                <span className="text-[12px] font-semibold text-brand-700">Passo {i + 1}</span>
                <span className="block font-medium">{t}</span>
                <span className="block text-[12px] text-ink-2">{x}</span>
              </li>
            ))}
          </ol>
          <Botao className="mt-4" onClick={() => setPasso(0)} disabled={d.contas.length + d.bens.length + d.dividas.length === 0}>
            Começar <IconeSeta tamanho={16} />
          </Botao>
          {d.contas.length + d.bens.length + d.dividas.length === 0 && (
            <p className="mt-2 text-[13px] text-ink-3">
              Cadastre contas no <a href="#/patrimonio" className="text-brand-600 underline">Patrimônio</a> primeiro.
            </p>
          )}
        </Card>
      )}

      {passo >= 0 && (
        <>
          <nav aria-label="Progresso" className="flex gap-1.5">
            {PASSOS.map((p, i) => (
              <div key={p} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= passo ? 'bg-brand-500' : 'bg-line'}`} />
                <p className={`mt-1 text-[12px] ${i === passo ? 'font-semibold text-ink' : 'text-ink-3'}`}>{p}</p>
              </div>
            ))}
          </nav>

          {passo === 0 && (
            <Card titulo={`Saldos em ${fmtData(d.data_referencia)}`}>
              {d.contas.length === 0 ? (
                <p className="text-[14px] text-ink-3">Nenhuma conta ativa nesta data.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {d.contas.map((c) =>
                    itemValor({
                      k: `conta:${c.id}`,
                      nome: c.nome,
                      detalhe: `${c.tipo === 'cartao' ? 'Fatura em aberto' : c.modo_controle === 'so_saldo' ? 'Só saldo' : 'Detalhada (diferença vira ajuste)'}${c.conta_no_pl ? ' · no PL' : ''}`,
                      rotulo: 'Igual',
                      anterior: c.tipo === 'cartao' ? -c.saldo_centavos : c.saldo_centavos,
                      data: c.saldo_data,
                      negativo: c.tipo !== 'cartao',
                    }),
                  )}
                </ul>
              )}
              <div className="mt-4 rounded-xl border border-line p-3">
                <Alternador
                  rotulo="Informar quanto apliquei (+) ou resgatei (−) este mês"
                  ativo={informarAporte}
                  aoMudar={setInformarAporte}
                  ajuda={
                    aporteEstimado !== null
                      ? `Se não informar, o app estima ${fmtCentavos(aporteEstimado)} (inclui a variação do mercado).`
                      : 'Se não informar e não houver saldo do mês anterior, o aporte fica sem valor.'
                  }
                />
                {informarAporte && (
                  <div className="mt-3 max-w-xs">
                    <CampoDinheiro rotulo="Aporte líquido do mês" valor={aporte} aoMudar={setAporte} permitirNegativo />
                  </div>
                )}
              </div>
            </Card>
          )}

          {passo === 1 && (
            <Card titulo="Bens e dívidas" acao={<Alternador rotulo="Mostrar todos" ativo={todosBens} aoMudar={setTodosBens} />}>
              {bensVisiveis.length + dividasVisiveis.length === 0 ? (
                <p className="py-4 text-[14px] text-ink-3">Nenhum bem ou dívida marcado para atualização mensal. Ative "Mostrar todos" para revisar os demais.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {bensVisiveis.map((b) =>
                    itemValor({ k: `bem:${b.id}`, nome: b.nome, detalhe: 'Bem · valor estimado', rotulo: 'Igual', anterior: b.valor_centavos, data: b.valor_data }),
                  )}
                  {dividasVisiveis.map((x) =>
                    itemValor({ k: `divida:${x.id}`, nome: x.nome, detalhe: 'Dívida · saldo devedor', rotulo: 'Igual', anterior: x.saldo_devedor_centavos, data: x.saldo_data }),
                  )}
                </ul>
              )}
            </Card>
          )}

          {passo === 2 && (
            <Card titulo={`Revisão — ${fmtMesLongo(d.mes)}`}>
              <dl className="grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-3">
                <div className="rounded-xl bg-sunken p-3">
                  <dt className="text-ink-2">Patrimônio investível (PL)</dt>
                  <dd className="tnum text-[20px] font-semibold">{fmtCentavos(plNovo)}</dd>
                </div>
                <div className="rounded-xl bg-sunken p-3">
                  <dt className="text-ink-2">Aporte do mês</dt>
                  <dd className="tnum text-[20px] font-semibold">
                    {informarAporte ? fmtCentavos(aporte) : aporteEstimado !== null ? fmtCentavos(aporteEstimado) : '—'}
                  </dd>
                  <dd className="text-[12px] text-ink-3">{informarAporte ? 'informado' : aporteEstimado !== null ? 'estimado' : 'sem dados'}</dd>
                </div>
                <div className="rounded-xl bg-sunken p-3">
                  <dt className="text-ink-2">Itens conferidos</dt>
                  <dd className="tnum text-[20px] font-semibold">
                    {conferidos.size} de {d.contas.length + bensVisiveis.length + dividasVisiveis.length}
                  </dd>
                  <dd className="text-[12px] text-ink-3">os demais são gravados com o último valor</dd>
                </div>
              </dl>
            </Card>
          )}

          <div className="flex justify-between gap-2">
            <Botao variante="fantasma" onClick={() => setPasso(passo - 1)}>
              <IconeVoltar tamanho={16} /> Voltar
            </Botao>
            {passo < 2 ? (
              <Botao onClick={() => setPasso(passo + 1)}>
                Próximo <IconeSeta tamanho={16} />
              </Botao>
            ) : (
              <Botao onClick={concluir} carregando={enviando}>
                Concluir fechamento
              </Botao>
            )}
          </div>
        </>
      )}

      <Card titulo="Fechamentos anteriores">
        {!historico.dados?.length ? (
          <p className="text-[14px] text-ink-3">Nenhum fechamento ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tnum w-full min-w-[560px] text-[13px]">
              <thead className="text-left text-[12px] text-ink-2">
                <tr>
                  <th className="py-2 font-medium">Mês</th>
                  <th className="py-2 text-right font-medium">PL investível</th>
                  <th className="py-2 text-right font-medium">Patrimônio líquido</th>
                  <th className="py-2 text-right font-medium">Aporte</th>
                  <th className="py-2 text-right font-medium">Independência</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {historico.dados.map((f) => (
                  <tr key={f.id} className="border-t border-line">
                    <td className="py-2">{fmtMesLongo(f.mes).replace(/^./, (c) => c.toUpperCase())}</td>
                    <td className="py-2 text-right">{fmtCentavos(f.pl_centavos)}</td>
                    <td className="py-2 text-right">{fmtCentavos(f.patrimonio_liquido_centavos)}</td>
                    <td className="py-2 text-right">
                      {f.aporte_real_centavos === null ? '—' : fmtCentavos(f.aporte_real_centavos)}
                      {f.aporte_fonte && <span className="block text-[11px] text-ink-3">{f.aporte_fonte}</span>}
                    </td>
                    <td className="py-2 text-right">
                      {f.resultado?.mesIF ? `${fmtMesIso(f.resultado.mesIF)} (${f.resultado.idadeIF})` : f.resultado ? 'não atinge' : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" className="rounded-md p-1.5 text-ink-3 hover:bg-sunken hover:text-critical" onClick={() => desfazer(f)} aria-label={`Desfazer ${f.mes}`}>
                        <IconeLixeira tamanho={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Passo 6 da §7: a recompensa do ritual. */
function Resumo({ r, aoNovo }: { r: ResultadoFechamento; aoNovo: () => void }) {
  const f = r.fechamento;
  const g = r.efeito.ganho_meses;
  const meta = r.meta_aporte_centavos;
  const aporte = f.aporte_real_centavos;
  let efeito: React.ReactNode;
  if (!f.resultado) efeito = 'Informe sua data de nascimento para calcular o efeito no Meu Futuro.';
  else if (!r.anterior?.resultado) efeito = f.resultado.mesIF ? <>Independência projetada para <strong>{fmtMesIso(f.resultado.mesIF)}</strong> (aos {f.resultado.idadeIF} anos).</> : 'Com estes números, a independência não é atingida no horizonte do plano.';
  else if (g === null) efeito = <>Independência: <strong>{fmtMesIso(r.efeito.mes_if_antes)}</strong> → <strong>{fmtMesIso(r.efeito.mes_if_depois)}</strong>.</>;
  else if (g === 0) efeito = <>Sua independência continua em <strong>{fmtMesIso(r.efeito.mes_if_depois)}</strong>.</>;
  else
    efeito = (
      <>
        Com este mês, sua independência financeira foi de <strong>{fmtMesIso(r.efeito.mes_if_antes)}</strong> para{' '}
        <strong>{fmtMesIso(r.efeito.mes_if_depois)}</strong> — {Math.abs(g)} {Math.abs(g) === 1 ? 'mês' : 'meses'} {g > 0 ? 'antes' : 'depois'}.
      </>
    );

  return (
    <div className="space-y-4">
      <Cabecalho titulo={`${fmtMesLongo(f.mes).replace(/^./, (c) => c.toUpperCase())} fechado`} subtitulo={`Saldos de ${fmtData(f.data_referencia)}.`} />
      <div className={`card p-5 ${g !== null && g > 0 ? 'border-good/40 bg-[#eef8ee]' : g !== null && g < 0 ? 'border-warning/50 bg-warning-bg' : 'border-brand-100 bg-brand-50/60'}`}>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Efeito no Meu Futuro</p>
        <p className="mt-1.5 text-[17px] leading-snug">{efeito}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[13px] text-ink-2">Patrimônio líquido</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight">{fmtCentavos(f.patrimonio_liquido_centavos)}</p>
          {r.delta_patrimonio_liquido_centavos !== null && (
            <p className={`text-[13px] ${r.delta_patrimonio_liquido_centavos >= 0 ? 'text-good-ink' : 'text-critical'}`}>
              {r.delta_patrimonio_liquido_centavos >= 0 ? '▲' : '▼'} {fmtCentavos(Math.abs(r.delta_patrimonio_liquido_centavos))} vs. {fmtMesIso(r.anterior!.mes)}
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-ink-2">Aporte real × meta</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight">{aporte === null ? '—' : fmtCentavos(aporte)}</p>
          <p className="text-[13px] text-ink-2">
            meta {fmtCentavos(meta)} · {f.aporte_fonte ?? 'sem dados'}
          </p>
          {aporte !== null && (
            <div className="mt-1.5">
              {aporte >= meta ? <Selo tom="ok" icone={<IconeCheck tamanho={13} />}>Meta batida</Selo> : <Selo tom="aviso" icone={<IconeAlerta tamanho={13} />}>Abaixo da meta</Selo>}
            </div>
          )}
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-ink-2">Patrimônio investível (PL)</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight">{fmtCentavos(f.pl_centavos)}</p>
          {f.nao_rastreado_centavos !== 0 && <p className="text-[13px] text-ink-2">Não rastreado: {fmtCentavos(f.nao_rastreado_centavos)}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => navegar('futuro')}>
          Ver Meu Futuro <IconeSeta tamanho={16} />
        </Botao>
        <Botao variante="secundario" onClick={aoNovo}>
          Fechar outro mês
        </Botao>
      </div>
    </div>
  );
}
