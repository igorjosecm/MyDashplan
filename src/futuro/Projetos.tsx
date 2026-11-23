import { useMemo, useState } from 'react';
import { projetosPorAno, TIPOS_PROJETO, type TipoProjeto } from '../../shared/finance-engine.ts';
import type { EstagioProjeto, ProjetoVida } from '../../shared/types.ts';
import { EChart, type OpcaoGrafico } from '../components/EChart.tsx';
import { IconeLapis, IconeLixeira, IconeMais } from '../components/icones.tsx';
import { Alternador, Botao, CampoDinheiro, CampoNumero, Modal, Segmentado, Selo, useUI } from '../components/ui.tsx';
import { api, mensagemErro } from '../lib/api.ts';
import { fmtCentavos, fmtCompacto, fmtMesIso } from '../lib/format.ts';
import { ehEspecial, ESTAGIOS, INTERVALOS_REPETICAO, TIPOS } from './tiposProjeto.ts';

/** Barras "Projetos 1 a 5 anos" (§4.8). Uma série → uma cor. */
export function BarrasProjetos({ projetos, hoje }: { projetos: ProjetoVida[]; hoje: string }) {
  const faixas = useMemo(
    () =>
      projetosPorAno(
        projetos.filter((p) => p.ativo === 1).map((p) => ({ tipo: p.tipo, valor: p.valor_centavos / 100, inicio: p.data_inicial })),
        hoje,
      ),
    [projetos, hoje],
  );
  const opcao = useMemo<OpcaoGrafico>(
    () => ({
      animation: false,
      textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
      grid: { left: 4, right: 4, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#e1e0d9',
        textStyle: { color: '#0b0b0b', fontSize: 12 },
        formatter: (p: { name: string; value: number }) => `${p.name}: <b>${fmtCompacto(p.value)}</b>`,
      },
      xAxis: {
        type: 'category',
        data: ['1º ano', '2º ano', '3º ano', '4º ano', '5º+'],
        axisLine: { lineStyle: { color: '#c3c2b7' } },
        axisTick: { show: false },
        axisLabel: { color: '#6f6e69', fontSize: 11, interval: 0 },
      },
      yAxis: { type: 'value', show: false, max: Math.max(...faixas, 1) * 1.15 },
      series: [
        {
          type: 'bar',
          data: faixas,
          barMaxWidth: 40,
          itemStyle: { color: '#2a78d6', borderRadius: [4, 4, 0, 0] },
          label: {
            show: true,
            position: 'top',
            color: '#52514e',
            fontSize: 11,
            formatter: (p: { value: number }) => (p.value > 0 ? fmtCompacto(p.value) : ''),
          },
        },
      ],
    }),
    [faixas],
  );
  if (!faixas.some((v) => v > 0)) {
    return <p className="py-6 text-center text-[13px] text-ink-3">Nenhum projeto (com saída de dinheiro) nos próximos anos.</p>;
  }
  return <EChart opcao={opcao} altura={190} rotulo="Valor dos projetos de vida por faixa de anos a partir de hoje" />;
}

type Form = {
  nome: string;
  tipo: TipoProjeto;
  valor_centavos: number;
  mes: string; // AAAA-MM
  parcelado: boolean;
  parcelas: number;
  estagio: EstagioProjeto;
  ativo: boolean;
  repetir: boolean;
  intervalo: number;
  ocorrencias: number;
};

const vazio = (hoje: string): Form => ({
  nome: '',
  tipo: 'viagem',
  valor_centavos: 0,
  mes: hoje.slice(0, 7),
  parcelado: false,
  parcelas: 12,
  estagio: 'desejo',
  ativo: true,
  repetir: false,
  intervalo: 12,
  ocorrencias: 3,
});

export function ListaProjetos({ projetos, hoje, aoMudar }: { projetos: ProjetoVida[]; hoje: string; aoMudar: (lista: ProjetoVida[]) => void }) {
  const { toast, confirmar } = useUI();
  const [form, setForm] = useState<Form | null>(null);
  const [editando, setEditando] = useState<ProjetoVida | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | EstagioProjeto>('todos');

  const abrirNovo = () => {
    setEditando(null);
    setForm(vazio(hoje));
  };
  const abrirEdicao = (p: ProjetoVida) => {
    setEditando(p);
    setForm({
      nome: p.nome,
      tipo: p.tipo,
      valor_centavos: p.valor_centavos,
      mes: p.data_inicial.slice(0, 7),
      parcelado: p.parcelas > 0,
      parcelas: p.parcelas || 12,
      estagio: p.estagio,
      ativo: p.ativo === 1,
      repetir: false,
      intervalo: p.repeticao_intervalo_meses ?? 12,
      ocorrencias: 3,
    });
  };

  async function salvar() {
    if (!form) return;
    if (!form.nome.trim()) return toast('Dê um nome ao projeto.', 'erro');
    const ajuste = form.tipo === 'ajuste_meta';
    const corpo = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      valor_centavos: form.valor_centavos,
      data_inicial: `${form.mes}-01`,
      prazo: !ajuste && form.parcelado ? 'a_prazo' : 'a_vista',
      parcelas: !ajuste && form.parcelado ? form.parcelas : 0,
      estagio: form.estagio,
      ativo: form.ativo ? 1 : 0,
    };
    let escopo = 'este';
    if (editando?.repetindo) {
      const r = await confirmar({
        titulo: 'Projeto repetido',
        texto: 'Este projeto faz parte de uma repetição. Aplicar a alteração só nele ou em todas as ocorrências? (Mudar o mês em "todos" desloca todas as datas igualmente.)',
        opcoes: [
          { rotulo: 'Só este', valor: 'este', variante: 'secundario' },
          { rotulo: 'Todos', valor: 'todos' },
        ],
      });
      if (!r) return;
      escopo = r;
    }
    setSalvando(true);
    try {
      const lista = editando
        ? await api.put<ProjetoVida[]>(`/future/projects/${editando.id}?escopo=${escopo}`, corpo)
        : await api.post<ProjetoVida[]>('/future/projects', {
            ...corpo,
            repeticao: form.repetir ? { intervalo_meses: form.intervalo, ocorrencias: form.ocorrencias } : null,
          });
      aoMudar(lista);
      setForm(null);
      toast(editando ? 'Projeto atualizado.' : form.repetir ? `${form.ocorrencias} ocorrências criadas.` : 'Projeto criado.');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(p: ProjetoVida) {
    const r = await confirmar({
      titulo: `Excluir "${p.nome}"?`,
      texto: p.repetindo ? 'Este projeto se repete. Excluir só esta ocorrência ou todas?' : 'O projeto sai do plano e do gráfico.',
      opcoes: p.repetindo
        ? [
            { rotulo: 'Só este', valor: 'este', variante: 'secundario' },
            { rotulo: 'Todos', valor: 'todos', variante: 'perigo' },
          ]
        : [{ rotulo: 'Excluir', valor: 'este', variante: 'perigo' }],
    });
    if (!r) return;
    try {
      aoMudar(await api.del<ProjetoVida[]>(`/future/projects/${p.id}?escopo=${r}`));
      toast('Projeto excluído.');
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  const visiveis = projetos.filter((p) => filtro === 'todos' || p.estagio === filtro);
  const totalOcorr = (cod: string) => projetos.filter((x) => x.cod_projeto === cod).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmentado
          rotulo="Filtrar por prioridade"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[{ valor: 'todos', rotulo: 'Todos' }, ...ESTAGIOS.map((e) => ({ valor: e.valor, rotulo: e.rotulo }))]}
        />
        <Botao tamanho="sm" onClick={abrirNovo}>
          <IconeMais tamanho={16} /> Novo projeto
        </Botao>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong py-8 text-center text-[14px] text-ink-3">
          Nenhum projeto ainda. Viagens, carro, casa, estudos — e também entradas extras (bônus, herança) ou mudanças na meta de aporte.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {visiveis.map((p) => {
            const t = TIPOS[p.tipo];
            const especial = ehEspecial(p.tipo);
            return (
              <li key={p.id} className={`flex items-center gap-3 py-3 ${p.ativo ? '' : 'opacity-55'}`}>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[19px] ${
                    p.tipo === 'aporte_financeiro' ? 'bg-entrada-bg' : p.tipo === 'ajuste_meta' ? 'bg-meta-bg' : 'bg-sunken'
                  }`}
                  aria-hidden="true"
                >
                  {t.icone}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[14px] font-medium">{p.nome}</span>
                    {p.tipo === 'aporte_financeiro' && <Selo tom="entrada">＋ Entrada no patrimônio</Selo>}
                    {p.tipo === 'ajuste_meta' && <Selo tom="meta">↻ Nova meta de aporte</Selo>}
                    {!especial && <Selo>{ESTAGIOS.find((e) => e.valor === p.estagio)?.rotulo}</Selo>}
                    {p.repetindo === 1 && (
                      <Selo tom="marca">
                        Repete a cada {p.repeticao_intervalo_meses} m · {p.repeticao_indice + 1}/{totalOcorr(p.cod_projeto)}
                      </Selo>
                    )}
                    {!p.ativo && <Selo>Inativo</Selo>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    {fmtMesIso(p.data_inicial.slice(0, 7))}
                    {p.tipo === 'ajuste_meta'
                      ? ` · aporte passa a ${fmtCentavos(p.valor_centavos)}/mês`
                      : p.parcelas > 0
                        ? ` · ${p.parcelas}× de ${fmtCentavos(Math.round(p.valor_centavos / p.parcelas))}`
                        : ' · à vista'}
                  </p>
                  <p className={`tnum mt-0.5 text-[14px] font-semibold sm:hidden ${p.tipo === 'aporte_financeiro' ? 'text-entrada' : ''}`}>
                    {p.tipo === 'aporte_financeiro' ? '+' : p.tipo === 'ajuste_meta' ? '' : '−'}
                    {fmtCentavos(p.valor_centavos)}
                  </p>
                </div>
                <span className={`tnum hidden text-right text-[14px] font-semibold sm:block ${p.tipo === 'aporte_financeiro' ? 'text-entrada' : ''}`}>
                  {p.tipo === 'aporte_financeiro' ? '+' : p.tipo === 'ajuste_meta' ? '' : '−'}
                  {fmtCentavos(p.valor_centavos)}
                </span>
                <div className="flex shrink-0">
                  <button type="button" className="rounded-md p-2 text-ink-2 hover:bg-sunken" onClick={() => abrirEdicao(p)} aria-label={`Editar ${p.nome}`}>
                    <IconeLapis tamanho={16} />
                  </button>
                  <button type="button" className="rounded-md p-2 text-ink-2 hover:bg-sunken hover:text-critical" onClick={() => excluir(p)} aria-label={`Excluir ${p.nome}`}>
                    <IconeLixeira tamanho={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        aberto={!!form}
        aoFechar={() => setForm(null)}
        titulo={editando ? 'Editar projeto de vida' : 'Novo projeto de vida'}
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setForm(null)}>
              Cancelar
            </Botao>
            <Botao onClick={salvar} carregando={salvando}>
              Salvar
            </Botao>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <label className="rotulo" htmlFor="pj-nome">
                Nome
              </label>
              <input id="pj-nome" className="campo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Viagem de férias" autoFocus />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo" htmlFor="pj-tipo">
                  Tipo
                </label>
                <select id="pj-tipo" className="campo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoProjeto })}>
                  {TIPOS_PROJETO.map((t) => (
                    <option key={t} value={t}>
                      {TIPOS[t].icone} {TIPOS[t].rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="rotulo" htmlFor="pj-mes">
                  {form.tipo === 'ajuste_meta' ? 'A partir de' : 'Mês de início'}
                </label>
                <input id="pj-mes" type="month" className="campo" value={form.mes} onChange={(e) => e.target.value && setForm({ ...form, mes: e.target.value })} />
              </div>
            </div>
            {form.tipo === 'aporte_financeiro' && (
              <p className="rounded-lg bg-entrada-bg px-3 py-2 text-[13px] text-entrada">Entrada de dinheiro (bônus, herança, venda): soma ao patrimônio no mês.</p>
            )}
            {form.tipo === 'ajuste_meta' && (
              <p className="rounded-lg bg-meta-bg px-3 py-2 text-[13px] text-meta">A partir deste mês, a meta de aporte passa a ser o valor abaixo — e continua assim nos meses seguintes.</p>
            )}
            <CampoDinheiro
              rotulo={form.tipo === 'ajuste_meta' ? 'Novo aporte mensal' : form.parcelado ? 'Valor total' : 'Valor'}
              valor={form.valor_centavos}
              aoMudar={(v) => setForm({ ...form, valor_centavos: Math.max(0, v) })}
            />
            {form.tipo !== 'ajuste_meta' && (
              <div className="space-y-3">
                <Alternador rotulo="Parcelado" ativo={form.parcelado} aoMudar={(v) => setForm({ ...form, parcelado: v })} ajuda="O valor é dividido igualmente por mês a partir do mês de início." />
                {form.parcelado && (
                  <div className="grid grid-cols-2 items-end gap-3">
                    <CampoNumero rotulo="Número de parcelas" valor={form.parcelas} aoMudar={(v) => setForm({ ...form, parcelas: Math.round(v) })} min={2} max={360} />
                    <p className="pb-2 text-[13px] text-ink-2">
                      {form.parcelas}× de <strong className="tnum">{fmtCentavos(Math.round(form.valor_centavos / Math.max(1, form.parcelas)))}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}
            {!ehEspecial(form.tipo) && (
              <div>
                <p className="rotulo">Prioridade</p>
                <Segmentado rotulo="Prioridade" valor={form.estagio} aoMudar={(v) => setForm({ ...form, estagio: v })} opcoes={ESTAGIOS} />
              </div>
            )}
            <Alternador rotulo="Ativo no plano" ativo={form.ativo} aoMudar={(v) => setForm({ ...form, ativo: v })} ajuda="Projetos inativos ficam salvos, mas não entram no cálculo." />
            {!editando && (
              <div className="space-y-3 rounded-xl border border-line p-3">
                <Alternador rotulo="Repetir este projeto" ativo={form.repetir} aoMudar={(v) => setForm({ ...form, repetir: v })} ajuda="Cria cópias ligadas entre si (editar/excluir só uma ou todas)." />
                {form.repetir && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="rotulo" htmlFor="pj-int">
                        A cada
                      </label>
                      <select id="pj-int" className="campo" value={form.intervalo} onChange={(e) => setForm({ ...form, intervalo: Number(e.target.value) })}>
                        {INTERVALOS_REPETICAO.map((m) => (
                          <option key={m} value={m}>
                            {m === 1 ? '1 mês' : m % 12 === 0 ? `${m / 12} ano(s)` : `${m} meses`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <CampoNumero rotulo="Total de vezes" valor={form.ocorrencias} aoMudar={(v) => setForm({ ...form, ocorrencias: Math.round(v) })} min={2} max={60} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
