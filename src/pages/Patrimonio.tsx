import { useEffect, useState } from 'react';
import { diasEntre, LIMITE_FRESCOR_DIAS } from '../../shared/meu-futuro.ts';
import type { Bem, CategoriaBem, Conta, Divida, Onb1Pergunta, Patrimonio, Snapshot, TipoConta, TipoDivida } from '../../shared/types.ts';
import { IconeAlerta, IconeLapis, IconeLixeira, IconeMais, IconeRelogio } from '../components/icones.tsx';
import { Alternador, Botao, Cabecalho, Card, CampoDinheiro, CampoNumero, Carregando, MensagemErro, Modal, Selo, useUI } from '../components/ui.tsx';
import { api, mensagemErro } from '../lib/api.ts';
import { fmtCentavos, fmtData } from '../lib/format.ts';
import { useRecurso } from '../lib/hooks.ts';
import { useOnb1 } from '../lib/onb1.tsx';
import { SeloFrescor } from './MeuFuturo.tsx';

const TIPOS_CONTA: { valor: TipoConta; rotulo: string }[] = [
  { valor: 'corrente', rotulo: 'Conta corrente' },
  { valor: 'poupanca', rotulo: 'Poupança / conta remunerada' },
  { valor: 'investimento', rotulo: 'Investimentos (corretora, banco)' },
  { valor: 'previdencia', rotulo: 'Previdência privada' },
  { valor: 'cartao', rotulo: 'Cartão de crédito' },
  { valor: 'dinheiro', rotulo: 'Dinheiro em espécie' },
  { valor: 'outro', rotulo: 'Outro' },
];
const CATEGORIAS_BEM: { valor: CategoriaBem; rotulo: string }[] = [
  { valor: 'residencial', rotulo: 'Residencial (moradia)' },
  { valor: 'veraneio', rotulo: 'Veraneio' },
  { valor: 'comercial', rotulo: 'Comercial' },
  { valor: 'investimentos', rotulo: 'Investimento (gera renda)' },
  { valor: 'participacao_empresa', rotulo: 'Participação em empresa' },
  { valor: 'veiculo', rotulo: 'Veículo' },
  { valor: 'outro', rotulo: 'Outro' },
];
const TIPOS_DIVIDA: { valor: TipoDivida; rotulo: string }[] = [
  { valor: 'financiamento', rotulo: 'Financiamento' },
  { valor: 'emprestimo', rotulo: 'Empréstimo' },
  { valor: 'consignado', rotulo: 'Consignado' },
  { valor: 'outro', rotulo: 'Outro' },
];
const rotuloTipoConta = (t: TipoConta) => TIPOS_CONTA.find((x) => x.valor === t)?.rotulo ?? t;
const hojeLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

type Alvo = { tipo: 'conta'; item: Conta } | { tipo: 'bem'; item: Bem } | { tipo: 'divida'; item: Divida };

export function PaginaPatrimonio() {
  const recurso = useRecurso<Patrimonio>('/patrimony');
  const { toast, confirmar } = useUI();
  const perguntarOnb1 = useOnb1();
  const [formConta, setFormConta] = useState<Conta | 'nova' | null>(null);
  const [formBem, setFormBem] = useState<Bem | 'novo' | null>(null);
  const [formDivida, setFormDivida] = useState<Divida | 'nova' | null>(null);
  const [atualizar, setAtualizar] = useState<Alvo | null>(null);

  const p = recurso.dados;
  if (recurso.erro) return <MensagemErro erro={recurso.erro} tentar={recurso.recarregar} />;
  if (!p) return <Carregando />;

  const aposMudanca = async (onb1?: Onb1Pergunta) => {
    recurso.recarregar();
    if (await perguntarOnb1(onb1)) recurso.recarregar();
  };

  async function excluir(tipo: 'accounts' | 'assets' | 'debts', id: number, nome: string) {
    const r = await confirmar({
      titulo: `Excluir "${nome}"?`,
      texto: 'O item e todo o histórico de saldos dele serão apagados. Fechamentos já gravados não mudam.',
      opcoes: [{ rotulo: 'Excluir', valor: 'sim', variante: 'perigo' }],
    });
    if (!r) return;
    try {
      await api.del(`/${tipo}/${id}`);
      toast('Excluído.');
      recurso.recarregar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    }
  }

  const contasAtivas = p.contas.filter((c) => c.ativa === 1);
  const contasPL = contasAtivas.filter((c) => c.conta_no_pl === 1);
  const outrasContas = p.contas.filter((c) => !(c.ativa === 1 && c.conta_no_pl === 1));
  const totalGU = p.gerador_renda_centavos + Math.max(0, p.uso_pessoal_centavos);
  const pctGerador = totalGU > 0 ? (p.gerador_renda_centavos / totalGU) * 100 : 0;

  return (
    <div className="space-y-4">
      <Cabecalho
        titulo="Patrimônio"
        subtitulo="Tudo o que você tem e deve, a partir dos últimos saldos informados."
        acoes={
          <Botao tamanho="sm" onClick={() => setFormConta('nova')}>
            <IconeMais tamanho={16} /> Conta
          </Botao>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Ativos" valor={fmtCentavos(p.ativos_centavos)} />
        <Indicador rotulo="Passivos" valor={fmtCentavos(p.passivos_centavos)} />
        <Indicador rotulo="Patrimônio líquido" valor={fmtCentavos(p.patrimonio_liquido_centavos)} destaque />
        <Indicador
          rotulo="Comprometido"
          valor={p.pct_comprometido === null ? '—' : `${p.pct_comprometido.toLocaleString('pt-BR')}%`}
          detalhe="passivos ÷ ativos"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card titulo="Patrimônio investível" acao={<SeloFrescor pl={p.investivel} />}>
          <p className="text-[26px] font-semibold tracking-tight">{fmtCentavos(p.investivel.pl_centavos)}</p>
          <p className="mt-1 text-[13px] text-ink-2">
            {p.investivel.fonte === 'manual' ? (
              <>Valor informado no onboarding. Soma das contas marcadas "no PL": {fmtCentavos(p.investivel.pl_contas_centavos)}.</>
            ) : (
              <>Soma das contas marcadas para entrar no plano de independência ({contasPL.length}). É o PL usado no Meu Futuro.</>
            )}
          </p>
        </Card>
        <Card titulo="Gerador de renda × uso pessoal">
          <div className="flex h-3 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
            <div className="h-full bg-serie-1" style={{ width: `${pctGerador}%` }} />
            <div className="h-full w-0.5 bg-surface" />
            <div className="h-full flex-1 bg-serie-2" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
            <div>
              <dt className="flex items-center gap-1.5 text-ink-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-serie-1" /> Gerador de renda
              </dt>
              <dd className="tnum font-semibold">{fmtCentavos(p.gerador_renda_centavos)}</dd>
              <dd className="text-[12px] text-ink-3">investimentos + imóveis de renda</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-ink-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-serie-2" /> Uso pessoal
              </dt>
              <dd className="tnum font-semibold">{fmtCentavos(p.uso_pessoal_centavos)}</dd>
              <dd className="text-[12px] text-ink-3">moradia, veículos, contas</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card
        titulo="Contas"
        acao={
          <Botao variante="secundario" tamanho="sm" onClick={() => setFormConta('nova')}>
            <IconeMais tamanho={16} /> Nova conta
          </Botao>
        }
      >
        {p.contas.length === 0 ? (
          <Vazio texto="Cadastre suas contas e investimentos. Para investimentos, basta o saldo do mês (modo só saldo)." />
        ) : (
          <>
            {contasPL.length > 0 && <Grupo titulo="Entram no patrimônio investível (PL)" />}
            <ul className="divide-y divide-line">
              {contasPL.map((c) => (
                <LinhaConta key={c.id} c={c} onAtualizar={() => setAtualizar({ tipo: 'conta', item: c })} onEditar={() => setFormConta(c)} onExcluir={() => excluir('accounts', c.id, c.nome)} />
              ))}
            </ul>
            {outrasContas.length > 0 && <Grupo titulo="Outras contas" />}
            <ul className="divide-y divide-line">
              {outrasContas.map((c) => (
                <LinhaConta key={c.id} c={c} onAtualizar={() => setAtualizar({ tipo: 'conta', item: c })} onEditar={() => setFormConta(c)} onExcluir={() => excluir('accounts', c.id, c.nome)} />
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          titulo="Bens"
          acao={
            <Botao variante="secundario" tamanho="sm" onClick={() => setFormBem('novo')}>
              <IconeMais tamanho={16} /> Bem
            </Botao>
          }
        >
          {p.bens.length === 0 ? (
            <Vazio texto="Imóveis, veículos, participações." />
          ) : (
            <ul className="divide-y divide-line">
              {p.bens.map((b) => (
                <LinhaItem
                  key={b.id}
                  nome={b.nome}
                  inativo={b.ativo !== 1}
                  detalhe={CATEGORIAS_BEM.find((x) => x.valor === b.categoria)?.rotulo ?? b.categoria}
                  selos={b.atualizar_mensalmente ? <Selo>Atualiza no fechamento</Selo> : null}
                  valor={fmtCentavos(b.valor_centavos)}
                  data={b.valor_data}
                  onAtualizar={() => setAtualizar({ tipo: 'bem', item: b })}
                  onEditar={() => setFormBem(b)}
                  onExcluir={() => excluir('assets', b.id, b.nome)}
                />
              ))}
            </ul>
          )}
        </Card>
        <Card
          titulo="Dívidas e financiamentos"
          acao={
            <Botao variante="secundario" tamanho="sm" onClick={() => setFormDivida('nova')}>
              <IconeMais tamanho={16} /> Dívida
            </Botao>
          }
        >
          {p.dividas.length === 0 ? (
            <Vazio texto="Financiamentos, empréstimos, consignados." />
          ) : (
            <ul className="divide-y divide-line">
              {p.dividas.map((d) => (
                <LinhaItem
                  key={d.id}
                  nome={d.nome}
                  inativo={d.ativo !== 1}
                  detalhe={`${TIPOS_DIVIDA.find((x) => x.valor === d.tipo)?.rotulo}${d.asset_id ? ` · ${p.bens.find((b) => b.id === d.asset_id)?.nome ?? 'bem'}` : ''}`}
                  selos={null}
                  valor={`− ${fmtCentavos(d.saldo_devedor_centavos)}`}
                  data={d.saldo_data}
                  onAtualizar={() => setAtualizar({ tipo: 'divida', item: d })}
                  onEditar={() => setFormDivida(d)}
                  onExcluir={() => excluir('debts', d.id, d.nome)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {formConta && <FormConta conta={formConta === 'nova' ? null : formConta} aoFechar={() => setFormConta(null)} aoSalvar={aposMudanca} />}
      {formBem && <FormBem bem={formBem === 'novo' ? null : formBem} aoFechar={() => setFormBem(null)} aoSalvar={() => aposMudanca()} />}
      {formDivida && <FormDivida divida={formDivida === 'nova' ? null : formDivida} bens={p.bens} aoFechar={() => setFormDivida(null)} aoSalvar={() => aposMudanca()} />}
      {atualizar && <ModalAtualizarSaldo alvo={atualizar} aoFechar={() => setAtualizar(null)} aoSalvar={aposMudanca} />}
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`card p-3.5 sm:p-4 ${destaque ? 'border-brand-100 bg-brand-50/60' : ''}`}>
      <p className="text-[12px] font-medium text-ink-2">{rotulo}</p>
      <p className="mt-1 text-[18px] font-semibold tracking-tight sm:text-[21px]">{valor}</p>
      {detalhe && <p className="text-[11px] text-ink-3">{detalhe}</p>}
    </div>
  );
}

const Grupo = ({ titulo }: { titulo: string }) => <p className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-ink-3 first:mt-0">{titulo}</p>;
const Vazio = ({ texto }: { texto: string }) => <p className="py-6 text-center text-[14px] text-ink-3">{texto}</p>;

function SeloData({ data }: { data: string | null }) {
  if (!data) return null;
  const dias = diasEntre(data, hojeLocal());
  return dias > LIMITE_FRESCOR_DIAS ? (
    <span className="inline-flex items-center gap-1 text-[12px] text-warning-ink">
      <IconeAlerta tamanho={12} /> {fmtData(data, true)} · há {dias} dias
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
      <IconeRelogio tamanho={12} /> {fmtData(data, true)}
    </span>
  );
}

function LinhaConta({ c, onAtualizar, onEditar, onExcluir }: { c: Conta; onAtualizar: () => void; onEditar: () => void; onExcluir: () => void }) {
  const cartao = c.tipo === 'cartao';
  return (
    <LinhaItem
      nome={c.nome}
      inativo={c.ativa !== 1}
      detalhe={[c.instituicao_nome, rotuloTipoConta(c.tipo)].filter(Boolean).join(' · ')}
      selos={<Selo>{c.modo_controle === 'so_saldo' ? 'Só saldo' : 'Detalhada'}</Selo>}
      valor={cartao ? `Fatura ${fmtCentavos(Math.max(0, -c.saldo_centavos))}` : fmtCentavos(c.saldo_centavos)}
      data={c.saldo_data}
      onAtualizar={onAtualizar}
      onEditar={onEditar}
      onExcluir={onExcluir}
    />
  );
}

function LinhaItem(p: {
  nome: string;
  detalhe: string;
  selos: React.ReactNode;
  valor: string;
  data: string | null;
  inativo?: boolean;
  onAtualizar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-3 ${p.inativo ? 'opacity-55' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[14px] font-medium">{p.nome}</span>
          {p.selos}
          {p.inativo && <Selo>Inativa</Selo>}
        </div>
        <p className="truncate text-[12px] text-ink-2">{p.detalhe}</p>
      </div>
      <div className="text-right">
        <p className="tnum text-[15px] font-semibold">{p.valor}</p>
        <SeloData data={p.data} />
      </div>
      <div className="flex w-full justify-end gap-1 sm:w-auto">
        <Botao variante="secundario" tamanho="sm" onClick={p.onAtualizar}>
          Atualizar
        </Botao>
        <button type="button" className="rounded-md p-2 text-ink-2 hover:bg-sunken" onClick={p.onEditar} aria-label={`Editar ${p.nome}`}>
          <IconeLapis tamanho={16} />
        </button>
        <button type="button" className="rounded-md p-2 text-ink-2 hover:bg-sunken hover:text-critical" onClick={p.onExcluir} aria-label={`Excluir ${p.nome}`}>
          <IconeLixeira tamanho={16} />
        </button>
      </div>
    </li>
  );
}

// ─────────────────────────── Atualizar saldo ───────────────────────────

function ModalAtualizarSaldo({ alvo, aoFechar, aoSalvar }: { alvo: Alvo; aoFechar: () => void; aoSalvar: (onb1?: Onb1Pergunta) => void }) {
  const { toast } = useUI();
  const cartao = alvo.tipo === 'conta' && alvo.item.tipo === 'cartao';
  const atual =
    alvo.tipo === 'conta' ? (cartao ? -alvo.item.saldo_centavos : alvo.item.saldo_centavos) : alvo.tipo === 'bem' ? alvo.item.valor_centavos : alvo.item.saldo_devedor_centavos;
  const [valor, setValor] = useState(atual);
  const [data, setData] = useState(hojeLocal());
  const [historico, setHistorico] = useState<Snapshot[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const detalhada = alvo.tipo === 'conta' && alvo.item.modo_controle === 'detalhado';

  useEffect(() => {
    if (detalhada) return setHistorico([]);
    api
      .get<Snapshot[]>(`/snapshots?alvo_tipo=${alvo.tipo}&alvo_id=${alvo.item.id}`)
      .then(setHistorico)
      .catch(() => setHistorico([]));
  }, [alvo, detalhada]);

  async function salvar() {
    setSalvando(true);
    try {
      let onb1: Onb1Pergunta | undefined;
      if (alvo.tipo === 'conta') {
        const r = await api.post<{ diferenca_centavos: number; onb1: Onb1Pergunta }>(`/accounts/${alvo.item.id}/saldo`, {
          saldo_centavos: cartao ? -valor : valor,
          data,
        });
        onb1 = r.onb1;
        toast(r.diferenca_centavos ? `Saldo conferido. Ajuste "Não rastreado" de ${fmtCentavos(r.diferenca_centavos)}.` : 'Saldo atualizado.');
      } else {
        const r = await api.post<{ onb1: Onb1Pergunta }>('/snapshots', { alvo_tipo: alvo.tipo, alvo_id: alvo.item.id, data, valor_centavos: valor });
        onb1 = r.onb1;
        toast('Valor atualizado.');
      }
      aoFechar();
      aoSalvar(onb1);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const rotulo = cartao ? 'Fatura em aberto' : alvo.tipo === 'bem' ? 'Valor atual' : alvo.tipo === 'divida' ? 'Saldo devedor' : 'Saldo';
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Atualizar: ${alvo.item.nome}`}
      largura="max-w-md"
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_10rem] gap-3">
          <CampoDinheiro rotulo={rotulo} valor={valor} aoMudar={setValor} permitirNegativo={alvo.tipo === 'conta' && !cartao} autoFocus />
          <div>
            <label className="rotulo" htmlFor="snap-data">
              Data do saldo
            </label>
            <input id="snap-data" type="date" className="campo" value={data} max={hojeLocal()} onChange={(e) => e.target.value && setData(e.target.value)} />
          </div>
        </div>
        {detalhada && (
          <p className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-ink-2">
            Conta detalhada: a diferença para o saldo calculado vira um lançamento de ajuste "Não rastreado" (SPEC §3.3).
          </p>
        )}
        {historico && historico.length > 0 && (
          <div>
            <p className="rotulo">Histórico</p>
            <ul className="max-h-48 divide-y divide-line overflow-auto rounded-lg border border-line text-[13px]">
              {historico.map((s) => (
                <li key={s.id} className="flex justify-between px-3 py-1.5">
                  <span className="text-ink-2">
                    {fmtData(s.data)} {s.origem === 'fechamento' && <span className="text-ink-3">· fechamento</span>}
                  </span>
                  <span className="tnum font-medium">{fmtCentavos(s.valor_centavos)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────── Formulários ───────────────────────────

function FormConta({ conta, aoFechar, aoSalvar }: { conta: Conta | null; aoFechar: () => void; aoSalvar: (onb1?: Onb1Pergunta) => void }) {
  const { toast } = useUI();
  const [f, setF] = useState({
    nome: conta?.nome ?? '',
    instituicao_nome: conta?.instituicao_nome ?? '',
    tipo: conta?.tipo ?? ('investimento' as TipoConta),
    modo_controle: conta?.modo_controle ?? ('so_saldo' as Conta['modo_controle']),
    conta_no_pl: conta ? conta.conta_no_pl === 1 : true,
    saldo: 0,
    data_ancora: hojeLocal(),
    ativa: conta ? conta.ativa === 1 : true,
    dia_fechamento: conta?.dia_fechamento ?? 5,
    dia_vencimento: conta?.dia_vencimento ?? 12,
    limite: conta?.limite_centavos ?? 0,
  });
  const [salvando, setSalvando] = useState(false);
  const cartao = f.tipo === 'cartao';

  const mudarTipo = (tipo: TipoConta) => {
    const investe = tipo === 'investimento' || tipo === 'previdencia' || tipo === 'poupanca';
    setF({ ...f, tipo, modo_controle: investe ? 'so_saldo' : 'detalhado', conta_no_pl: investe });
  };

  async function salvar() {
    if (!f.nome.trim()) return toast('Informe o nome da conta.', 'erro');
    setSalvando(true);
    try {
      const comum = {
        nome: f.nome.trim(),
        instituicao_nome: f.instituicao_nome.trim() || null,
        modo_controle: f.modo_controle,
        conta_no_pl: f.conta_no_pl ? 1 : 0,
        ...(cartao ? { dia_fechamento: f.dia_fechamento, dia_vencimento: f.dia_vencimento, limite_centavos: f.limite } : {}),
      };
      const r = conta
        ? await api.put<{ onb1: Onb1Pergunta }>(`/accounts/${conta.id}`, { ...comum, ativa: f.ativa ? 1 : 0 })
        : await api.post<{ onb1: Onb1Pergunta }>('/accounts', {
            ...comum,
            tipo: f.tipo,
            saldo_inicial_centavos: cartao ? -f.saldo : f.saldo,
            data_ancora: f.data_ancora,
          });
      toast(conta ? 'Conta atualizada.' : 'Conta criada.');
      aoFechar();
      aoSalvar(r.onb1);
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={conta ? 'Editar conta' : 'Nova conta'}
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="ct-nome">
              Nome
            </label>
            <input id="ct-nome" className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Carteira de ações" autoFocus />
          </div>
          <div>
            <label className="rotulo" htmlFor="ct-inst">
              Instituição <span className="font-normal text-ink-3">(opcional)</span>
            </label>
            <input id="ct-inst" className="campo" value={f.instituicao_nome} onChange={(e) => setF({ ...f, instituicao_nome: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="rotulo" htmlFor="ct-tipo">
            Tipo
          </label>
          <select id="ct-tipo" className="campo" value={f.tipo} disabled={!!conta} onChange={(e) => mudarTipo(e.target.value as TipoConta)}>
            {TIPOS_CONTA.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </div>
        {!cartao && (
          <>
            <div>
              <p className="rotulo">Como controlar</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['so_saldo', 'Só saldo', 'Atualiza o saldo no fechamento'],
                    ['detalhado', 'Detalhada', 'Lançamentos (Etapa 3) + conferência'],
                  ] as const
                ).map(([v, r, d]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setF({ ...f, modo_controle: v })}
                    className={`rounded-xl border px-3 py-2 text-left ${f.modo_controle === v ? 'border-brand-500 bg-brand-50' : 'border-line-strong hover:bg-sunken'}`}
                  >
                    <span className="block text-[14px] font-medium">{r}</span>
                    <span className="block text-[12px] text-ink-3">{d}</span>
                  </button>
                ))}
              </div>
            </div>
            <Alternador
              rotulo="Entra no patrimônio investível (PL do Meu Futuro)"
              ativo={f.conta_no_pl}
              aoMudar={(v) => setF({ ...f, conta_no_pl: v })}
              ajuda="Desmarque para contas do dia a dia ou reservas que não são para a independência."
            />
          </>
        )}
        {cartao && (
          <div className="grid grid-cols-3 gap-3">
            <CampoNumero rotulo="Dia do fechamento" valor={f.dia_fechamento} aoMudar={(v) => setF({ ...f, dia_fechamento: Math.round(v) })} min={1} max={31} />
            <CampoNumero rotulo="Dia do vencimento" valor={f.dia_vencimento} aoMudar={(v) => setF({ ...f, dia_vencimento: Math.round(v) })} min={1} max={31} />
            <CampoDinheiro rotulo="Limite" valor={f.limite} aoMudar={(v) => setF({ ...f, limite: Math.max(0, v) })} />
          </div>
        )}
        {!conta && (
          <div className="grid grid-cols-[1fr_10rem] gap-3">
            <CampoDinheiro rotulo={cartao ? 'Fatura em aberto hoje' : 'Saldo hoje'} valor={f.saldo} aoMudar={(v) => setF({ ...f, saldo: v })} permitirNegativo={!cartao} />
            <div>
              <label className="rotulo" htmlFor="ct-data">
                Na data
              </label>
              <input id="ct-data" type="date" className="campo" value={f.data_ancora} max={hojeLocal()} onChange={(e) => e.target.value && setF({ ...f, data_ancora: e.target.value })} />
            </div>
          </div>
        )}
        {conta && <Alternador rotulo="Conta ativa" ativo={f.ativa} aoMudar={(v) => setF({ ...f, ativa: v })} ajuda="Contas inativas não entram nos totais." />}
      </div>
    </Modal>
  );
}

function FormBem({ bem, aoFechar, aoSalvar }: { bem: Bem | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { toast } = useUI();
  const [f, setF] = useState({
    nome: bem?.nome ?? '',
    categoria: bem?.categoria ?? ('residencial' as CategoriaBem),
    valor: 0,
    data: hojeLocal(),
    atualizar: bem ? bem.atualizar_mensalmente === 1 : false,
    ativo: bem ? bem.ativo === 1 : true,
  });
  const [salvando, setSalvando] = useState(false);
  const classe = f.categoria === 'veiculo' ? 'movel' : f.categoria === 'participacao_empresa' || f.categoria === 'outro' ? 'movel' : 'imovel';

  async function salvar() {
    if (!f.nome.trim()) return toast('Informe o nome do bem.', 'erro');
    setSalvando(true);
    try {
      const comum = { nome: f.nome.trim(), categoria: f.categoria, classe, atualizar_mensalmente: f.atualizar ? 1 : 0 };
      if (bem) await api.put(`/assets/${bem.id}`, { ...comum, ativo: f.ativo ? 1 : 0 });
      else await api.post('/assets', { ...comum, valor_centavos: f.valor, data: f.data });
      toast(bem ? 'Bem atualizado.' : 'Bem cadastrado.');
      aoFechar();
      aoSalvar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={bem ? 'Editar bem' : 'Novo bem'}
      largura="max-w-md"
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="bm-nome">
            Nome
          </label>
          <input id="bm-nome" className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Apartamento" autoFocus />
        </div>
        <div>
          <label className="rotulo" htmlFor="bm-cat">
            Categoria
          </label>
          <select id="bm-cat" className="campo" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as CategoriaBem })}>
            {CATEGORIAS_BEM.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </div>
        {!bem && (
          <div className="grid grid-cols-[1fr_10rem] gap-3">
            <CampoDinheiro rotulo="Valor estimado" valor={f.valor} aoMudar={(v) => setF({ ...f, valor: Math.max(0, v) })} />
            <div>
              <label className="rotulo" htmlFor="bm-data">
                Na data
              </label>
              <input id="bm-data" type="date" className="campo" value={f.data} max={hojeLocal()} onChange={(e) => e.target.value && setF({ ...f, data: e.target.value })} />
            </div>
          </div>
        )}
        <Alternador rotulo="Atualizar no fechamento mensal" ativo={f.atualizar} aoMudar={(v) => setF({ ...f, atualizar: v })} ajuda="Imóveis costumam ser revisados uma vez por ano." />
        {bem && <Alternador rotulo="Ativo" ativo={f.ativo} aoMudar={(v) => setF({ ...f, ativo: v })} />}
      </div>
    </Modal>
  );
}

function FormDivida({ divida, bens, aoFechar, aoSalvar }: { divida: Divida | null; bens: Bem[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { toast } = useUI();
  const [f, setF] = useState({
    nome: divida?.nome ?? '',
    tipo: divida?.tipo ?? ('financiamento' as TipoDivida),
    asset_id: divida?.asset_id ?? null,
    saldo: 0,
    total: divida?.total_tomado_centavos ?? 0,
    juros: divida?.taxa_juros_anual ? Math.round(divida.taxa_juros_anual * 10000) / 100 : 0,
    data: hojeLocal(),
    atualizar: divida ? divida.atualizar_mensalmente === 1 : true,
    ativo: divida ? divida.ativo === 1 : true,
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!f.nome.trim()) return toast('Informe o nome da dívida.', 'erro');
    setSalvando(true);
    try {
      const comum = {
        nome: f.nome.trim(),
        tipo: f.tipo,
        asset_id: f.asset_id,
        total_tomado_centavos: f.total || null,
        taxa_juros_anual: f.juros ? f.juros / 100 : null,
        atualizar_mensalmente: f.atualizar ? 1 : 0,
      };
      if (divida) await api.put(`/debts/${divida.id}`, { ...comum, ativo: f.ativo ? 1 : 0 });
      else await api.post('/debts', { ...comum, saldo_devedor_centavos: f.saldo, data: f.data });
      toast(divida ? 'Dívida atualizada.' : 'Dívida cadastrada.');
      aoFechar();
      aoSalvar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={divida ? 'Editar dívida' : 'Nova dívida'}
      largura="max-w-md"
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="dv-nome">
            Nome
          </label>
          <input id="dv-nome" className="campo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Financiamento do apartamento" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="dv-tipo">
              Tipo
            </label>
            <select id="dv-tipo" className="campo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoDivida })}>
              {TIPOS_DIVIDA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="dv-bem">
              Bem vinculado
            </label>
            <select id="dv-bem" className="campo" value={f.asset_id ?? ''} onChange={(e) => setF({ ...f, asset_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Nenhum</option>
              {bens.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!divida && (
          <div className="grid grid-cols-[1fr_10rem] gap-3">
            <CampoDinheiro rotulo="Saldo devedor hoje" valor={f.saldo} aoMudar={(v) => setF({ ...f, saldo: Math.max(0, v) })} />
            <div>
              <label className="rotulo" htmlFor="dv-data">
                Na data
              </label>
              <input id="dv-data" type="date" className="campo" value={f.data} max={hojeLocal()} onChange={(e) => e.target.value && setF({ ...f, data: e.target.value })} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <CampoDinheiro rotulo="Valor tomado (opcional)" valor={f.total} aoMudar={(v) => setF({ ...f, total: Math.max(0, v) })} />
          <CampoNumero rotulo="Juros (opcional)" sufixo="% a.a." valor={f.juros} aoMudar={(v) => setF({ ...f, juros: Math.max(0, v) })} min={0} max={500} />
        </div>
        <Alternador rotulo="Atualizar no fechamento mensal" ativo={f.atualizar} aoMudar={(v) => setF({ ...f, atualizar: v })} />
        {divida && <Alternador rotulo="Ativa" ativo={f.ativo} aoMudar={(v) => setF({ ...f, ativo: v })} />}
      </div>
    </Modal>
  );
}
