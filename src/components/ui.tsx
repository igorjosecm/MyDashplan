import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { fmtNum } from '../lib/format.ts';
import { IconeAlerta, IconeCheck, IconeFechar, IconeInfo } from './icones.tsx';

// ─────────────────────────── Botões ───────────────────────────

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-400/60',
  secundario: 'bg-surface text-ink border border-line-strong hover:bg-sunken disabled:text-ink-3',
  fantasma: 'text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-3',
  perigo: 'bg-critical text-white hover:brightness-95 disabled:opacity-60',
};

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  className = '',
  carregando,
  children,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: 'sm' | 'md'; carregando?: boolean }) {
  const t = tamanho === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[14px]';
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || carregando}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${t} ${VARIANTES[variante]} ${className}`}
    >
      {carregando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// ─────────────────────────── Estrutura ───────────────────────────

export function Card({ titulo, acao, children, className = '' }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(titulo || acao) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-[15px] font-semibold text-ink">{titulo}</h2>}
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-[14px] text-ink-2">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-2" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {texto}
    </div>
  );
}

export function MensagemErro({ erro, tentar }: { erro: string; tentar?: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3 border-critical/30 bg-critical-bg p-4 text-[14px]" role="alert">
      <div className="flex items-center gap-2 font-medium text-critical">
        <IconeAlerta tamanho={18} /> Não foi possível carregar
      </div>
      <p className="text-ink-2">{erro}</p>
      {tentar && (
        <Botao variante="secundario" tamanho="sm" onClick={tentar}>
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

/** Selo com ícone + rótulo (status nunca só por cor). */
export function Selo({ tom = 'neutro', icone, children }: { tom?: 'neutro' | 'aviso' | 'ok' | 'entrada' | 'meta' | 'marca'; icone?: ReactNode; children: ReactNode }) {
  const t = {
    neutro: 'bg-sunken text-ink-2',
    aviso: 'bg-warning-bg text-warning-ink',
    ok: 'bg-[#e8f5e8] text-good-ink',
    entrada: 'bg-entrada-bg text-entrada',
    meta: 'bg-meta-bg text-meta',
    marca: 'bg-brand-50 text-brand-700',
  }[tom];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${t}`}>{icone}{children}</span>;
}

// ─────────────────────────── Modal ───────────────────────────

export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      className={`m-0 mt-auto w-full ${largura} max-h-[92dvh] rounded-t-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40 sm:m-auto sm:rounded-2xl`}
    >
      {aberto && (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[16px] font-semibold">{titulo}</h2>
            <button type="button" onClick={aoFechar} className="rounded-md p-1 text-ink-2 hover:bg-sunken" aria-label="Fechar">
              <IconeFechar />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {rodape && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{rodape}</footer>}
        </div>
      )}
    </dialog>
  );
}

// ─────────────────────────── Toasts e confirmação ───────────────────────────

type Toast = { id: number; tipo: 'ok' | 'erro' | 'info'; texto: string };
type Confirmacao = { titulo: string; texto: ReactNode; opcoes: { rotulo: string; valor: string; variante?: Variante }[]; resolver: (v: string | null) => void };

const CtxUI = createContext<{
  toast: (texto: string, tipo?: Toast['tipo']) => void;
  confirmar: (c: Omit<Confirmacao, 'resolver'>) => Promise<string | null>;
} | null>(null);

export function ProvedorUI({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<Confirmacao | null>(null);
  const toast = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 7000 : 3500);
  }, []);
  const confirmar = useCallback(
    (c: Omit<Confirmacao, 'resolver'>) => new Promise<string | null>((resolver) => setConf({ ...c, resolver })),
    [],
  );
  const fechar = (v: string | null) => {
    conf?.resolver(v);
    setConf(null);
  };
  return (
    <CtxUI.Provider value={{ toast, confirmar }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-2.5 text-[14px] shadow-lg ${
              t.tipo === 'erro' ? 'bg-critical text-white' : 'bg-ink text-white'
            }`}
          >
            {t.tipo === 'erro' ? <IconeAlerta tamanho={18} /> : t.tipo === 'ok' ? <IconeCheck tamanho={18} /> : <IconeInfo tamanho={18} />}
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
      <Modal
        aberto={!!conf}
        aoFechar={() => fechar(null)}
        titulo={conf?.titulo ?? ''}
        largura="max-w-md"
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => fechar(null)}>
              Cancelar
            </Botao>
            {conf?.opcoes.map((o) => (
              <Botao key={o.valor} variante={o.variante ?? 'primario'} onClick={() => fechar(o.valor)}>
                {o.rotulo}
              </Botao>
            ))}
          </>
        }
      >
        <div className="text-[14px] leading-relaxed text-ink-2">{conf?.texto}</div>
      </Modal>
    </CtxUI.Provider>
  );
}

export function useUI() {
  const c = useContext(CtxUI);
  if (!c) throw new Error('ProvedorUI ausente');
  return c;
}

// ─────────────────────────── Campos ───────────────────────────

const fmtValorCampo = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Campo monetário estilo "caixa registradora": os dígitos entram como centavos (3250 → 32,50).
 * Valor sempre em centavos inteiros.
 */
export function CampoDinheiro({
  rotulo,
  valor,
  aoMudar,
  permitirNegativo,
  ajuda,
  id,
  autoFocus,
  className = '',
}: {
  rotulo?: string;
  valor: number;
  aoMudar: (centavos: number) => void;
  permitirNegativo?: boolean;
  ajuda?: ReactNode;
  id?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const auto = useId();
  const idc = id ?? auto;
  const negativo = valor < 0;
  return (
    <div className={className}>
      {rotulo && (
        <label htmlFor={idc} className="rotulo">
          {rotulo}
        </label>
      )}
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-[14px] text-ink-3">R$</span>
        <input
          id={idc}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          className={`campo tnum pl-10 text-right ${permitirNegativo ? 'pr-12' : ''}`}
          value={(negativo ? '−' : '') + fmtValorCampo.format(Math.abs(valor) / 100)}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, '').slice(0, 13);
            const v = Number(digitos || '0');
            aoMudar(negativo ? -v : v);
          }}
          onKeyDown={(e) => {
            if (permitirNegativo && (e.key === '-' || e.key === '+')) {
              e.preventDefault();
              aoMudar(e.key === '-' ? -Math.abs(valor) : Math.abs(valor));
            }
          }}
        />
        {permitirNegativo && (
          <button
            type="button"
            className="absolute right-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-ink-2 hover:bg-sunken"
            onClick={() => aoMudar(-valor)}
            aria-label="Inverter sinal"
            title="Inverter sinal (+/−)"
          >
            ±
          </button>
        )}
      </div>
      {ajuda && <p className="mt-1 text-[12px] text-ink-3">{ajuda}</p>}
    </div>
  );
}

/** Slider + campo numérico sincronizados. */
export function CampoSlider({
  rotulo,
  valor,
  aoMudar,
  min,
  max,
  passo = 1,
  formatar = fmtNum,
  sufixo,
  dinheiro,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (v: number) => void;
  min: number;
  max: number;
  passo?: number;
  formatar?: (v: number) => string;
  sufixo?: string;
  /** valor em centavos; o slider anda em reais */
  dinheiro?: boolean;
}) {
  const id = useId();
  const vSlider = dinheiro ? valor / 100 : valor;
  const pct = Math.max(0, Math.min(100, ((vSlider - min) / (max - min)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {rotulo}
        </label>
        {!dinheiro && (
          <span className="tnum text-[15px] font-semibold text-ink">
            {formatar(valor)}
            {sufixo}
          </span>
        )}
      </div>
      <div className={dinheiro ? 'grid grid-cols-[1fr_9.5rem] items-center gap-3' : ''}>
        <input
          id={id}
          type="range"
          className="slider"
          min={min}
          max={max}
          step={passo}
          value={Math.max(min, Math.min(max, vSlider))}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
          onChange={(e) => {
            const v = Number(e.target.value);
            aoMudar(dinheiro ? Math.round(v * 100) : v);
          }}
          aria-valuetext={dinheiro ? undefined : `${formatar(valor)}${sufixo ?? ''}`}
        />
        {dinheiro && <CampoDinheiro valor={valor} aoMudar={aoMudar} />}
      </div>
    </div>
  );
}

export function CampoNumero({
  rotulo,
  valor,
  aoMudar,
  min,
  max,
  passo = 1,
  sufixo,
  ajuda,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  sufixo?: string;
  ajuda?: ReactNode;
}) {
  const id = useId();
  const [texto, setTexto] = useState(String(valor).replace('.', ','));
  useEffect(() => setTexto(String(valor).replace('.', ',')), [valor]);
  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`campo tnum ${sufixo ? 'pr-12' : ''}`}
          inputMode="decimal"
          value={texto}
          min={min}
          max={max}
          step={passo}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            const n = Number(texto.replace(',', '.'));
            if (Number.isFinite(n)) {
              const lim = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
              aoMudar(lim);
              setTexto(String(lim).replace('.', ','));
            } else setTexto(String(valor).replace('.', ','));
          }}
        />
        {sufixo && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-3">{sufixo}</span>}
      </div>
      {ajuda && <p className="mt-1 text-[12px] text-ink-3">{ajuda}</p>}
    </div>
  );
}

export function Alternador({ rotulo, ativo, aoMudar, ajuda }: { rotulo: ReactNode; ativo: boolean; aoMudar: (v: boolean) => void; ajuda?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={ativo} onChange={(e) => aoMudar(e.target.checked)} />
        <span className="h-6 w-10 rounded-full bg-line-strong transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="text-[14px] text-ink">{rotulo}</span>
        {ajuda && <span className="block text-[12px] text-ink-3">{ajuda}</span>}
      </span>
    </label>
  );
}

export function Segmentado<T extends string | number>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex rounded-lg bg-sunken p-0.5">
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => aoMudar(o.valor)}
          className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors ${
            o.valor === valor ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
