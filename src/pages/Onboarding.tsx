import { useState } from 'react';
import { IconeFechar, IconeMais, IconeVoltar } from '../components/icones.tsx';
import { Botao, CampoDinheiro, CampoSlider, useUI } from '../components/ui.tsx';
import { api, mensagemErro } from '../lib/api.ts';
import { fmtCentavos } from '../lib/format.ts';

type ContaRapida = { nome: string; saldo_centavos: number; tipo: 'investimento' | 'poupanca' | 'previdencia' };

/**
 * Onboarding nível 0 (SPEC_ENTRADA_MANUAL §2): 5 telas, um assunto por tela, todas com "pular".
 * Termina direto no Meu Futuro.
 */
export function Onboarding({ aoConcluir }: { aoConcluir: () => void }) {
  const { toast } = useUI();
  const [passo, setPasso] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState<string | null>(null);
  const [idade, setIdade] = useState<number | null>(null);
  const [renda, setRenda] = useState<number | null>(null);
  const [outras, setOutras] = useState<number | null>(null);
  const [modoPL, setModoPL] = useState<'total' | 'contas' | null>(null);
  const [plTotal, setPlTotal] = useState(0);
  const [contas, setContas] = useState<ContaRapida[]>([{ nome: '', saldo_centavos: 0, tipo: 'investimento' }]);
  const [aporte, setAporte] = useState<number | null>(null);

  const total = 5;
  const avancar = () => {
    if (passo === 1 && idade === null) setIdade(65); // aceitou o padrão sem mexer no slider
    if (passo < total - 1) setPasso(passo + 1);
    else concluir(false);
  };
  /** "Pular" descarta a resposta da tela atual. */
  const pular = () => {
    [
      () => setNascimento(null),
      () => setIdade(null),
      () => {
        setRenda(null);
        setOutras(null);
      },
      () => setModoPL(null),
      () => setAporte(null),
    ][passo]();
    if (passo < total - 1) setPasso(passo + 1);
    else concluir(true);
  };

  async function concluir(semAporte: boolean) {
    setEnviando(true);
    try {
      const contasValidas = contas.filter((c) => c.nome.trim());
      await api.post('/onboarding', {
        nome: nome.trim() || null,
        data_nascimento: nascimento,
        idade_aposentadoria: idade,
        renda_desejada_centavos: renda,
        outras_rendas_centavos: outras,
        meta_aporte_mensal_centavos: semAporte ? null : aporte,
        pl:
          modoPL === 'total'
            ? { modo: 'total', valor_centavos: plTotal }
            : modoPL === 'contas' && contasValidas.length
              ? { modo: 'contas', contas: contasValidas.map((c) => ({ ...c, nome: c.nome.trim() })) }
              : null,
      });
      toast('Tudo pronto! Este é o seu Meu Futuro.');
      aoConcluir();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  }

  const telas = [
    {
      titulo: 'Vamos montar o seu plano',
      texto: 'Em 5 perguntas rápidas você já vê quando pode alcançar a independência financeira. Dá para pular qualquer uma e ajustar depois.',
      corpo: (
        <div className="space-y-4">
          <div>
            <label htmlFor="onb-nome" className="rotulo">
              Como podemos te chamar? <span className="font-normal text-ink-3">(opcional)</span>
            </label>
            <input id="onb-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" />
          </div>
          <div>
            <label htmlFor="onb-nasc" className="rotulo">
              Data de nascimento
            </label>
            <input
              id="onb-nasc"
              type="date"
              className="campo"
              value={nascimento ?? ''}
              max={new Date().toISOString().slice(0, 10)}
              min="1920-01-01"
              onChange={(e) => setNascimento(e.target.value || null)}
            />
            <p className="mt-1 text-[12px] text-ink-3">Usada para calcular sua idade em cada mês da projeção.</p>
          </div>
        </div>
      ),
      ok: !!nascimento,
    },
    {
      titulo: 'Com que idade quer se aposentar?',
      texto: 'É a idade em que você para de investir e passa a viver do patrimônio.',
      corpo: <CampoSlider rotulo="Idade de aposentadoria" valor={idade ?? 65} aoMudar={setIdade} min={40} max={80} sufixo=" anos" />,
      ok: true,
    },
    {
      titulo: 'Quanto quer ganhar por mês aposentado?',
      texto: 'Em valores de hoje: o plano desconta a inflação, então pense no poder de compra de agora.',
      corpo: (
        <div className="space-y-4">
          <CampoDinheiro rotulo="Renda mensal desejada" valor={renda ?? 0} aoMudar={setRenda} autoFocus />
          <CampoDinheiro
            rotulo="Terá outras rendas? (INSS, aluguel…)"
            valor={outras ?? 0}
            aoMudar={setOutras}
            ajuda="O patrimônio só precisa cobrir a diferença entre as duas."
          />
        </div>
      ),
      ok: renda !== null,
    },
    {
      titulo: 'Quanto você tem investido hoje?',
      texto: 'Pode ser um número só. Se preferir, detalhe por conta — dá para fazer isso depois no Patrimônio.',
      corpo: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['total', 'Um valor total'],
                ['contas', 'Quero detalhar'],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                onClick={() => setModoPL(v)}
                className={`rounded-xl border px-3 py-3 text-[14px] font-medium transition-colors ${
                  modoPL === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line-strong hover:bg-sunken'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {modoPL === 'total' && <CampoDinheiro rotulo="Total investido" valor={plTotal} aoMudar={setPlTotal} autoFocus />}
          {modoPL === 'contas' && (
            <div className="space-y-3">
              {contas.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_9rem_auto] items-end gap-2">
                  <div>
                    <label className="rotulo" htmlFor={`onb-c-${i}`}>
                      Instituição / conta
                    </label>
                    <input
                      id={`onb-c-${i}`}
                      className="campo"
                      placeholder="Ex.: Corretora X"
                      value={c.nome}
                      onChange={(e) => setContas(contas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                    />
                  </div>
                  <CampoDinheiro rotulo="Saldo" valor={c.saldo_centavos} aoMudar={(v) => setContas(contas.map((x, j) => (j === i ? { ...x, saldo_centavos: v } : x)))} />
                  <button
                    type="button"
                    className="mb-1 rounded-md p-2 text-ink-3 hover:bg-sunken disabled:opacity-30"
                    disabled={contas.length === 1}
                    onClick={() => setContas(contas.filter((_, j) => j !== i))}
                    aria-label="Remover conta"
                  >
                    <IconeFechar tamanho={18} />
                  </button>
                </div>
              ))}
              <Botao variante="fantasma" tamanho="sm" onClick={() => setContas([...contas, { nome: '', saldo_centavos: 0, tipo: 'investimento' }])}>
                <IconeMais tamanho={16} /> Adicionar conta
              </Botao>
              <p className="text-[13px] text-ink-2">
                Total: <strong className="tnum">{fmtCentavos(contas.reduce((s, c) => s + c.saldo_centavos, 0))}</strong>
              </p>
            </div>
          )}
        </div>
      ),
      ok: modoPL !== null,
    },
    {
      titulo: 'Quanto consegue investir por mês?',
      texto: 'Sua meta de aporte. No Meu Futuro você compara com o valor recomendado.',
      corpo: <CampoDinheiro rotulo="Meta de aporte mensal" valor={aporte ?? 0} aoMudar={setAporte} autoFocus />,
      ok: aporte !== null,
    },
  ];
  const t = telas[passo];

  return (
    <div className="flex min-h-dvh flex-col items-center bg-page px-4 py-6 sm:justify-center">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="text-[16px] font-semibold">MyDashplan</span>
          </div>
          <span className="text-[13px] text-ink-3">
            {passo + 1} de {total}
          </span>
        </div>
        <div className="mb-6 flex gap-1.5" aria-hidden="true">
          {telas.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= passo ? 'bg-brand-500' : 'bg-line'}`} />
          ))}
        </div>

        <div className="card p-5 sm:p-6">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{t.titulo}</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{t.texto}</p>
          <div className="mt-5">{t.corpo}</div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Botao variante="fantasma" onClick={() => setPasso(passo - 1)} disabled={passo === 0}>
            <IconeVoltar tamanho={16} /> Voltar
          </Botao>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={pular} disabled={enviando}>
              Pular
            </Botao>
            <Botao onClick={avancar} disabled={!t.ok} carregando={enviando && passo === total - 1}>
              {passo === total - 1 ? 'Ver meu futuro' : 'Continuar'}
            </Botao>
          </div>
        </div>
      </div>
    </div>
  );
}
