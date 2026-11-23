import { useEffect, useState, type ReactNode } from 'react';
import type { Perfil } from '../shared/types.ts';
import {
  IconeConfig,
  IconeFechamento,
  IconeFuturo,
  IconeLancamentos,
  IconeMenu,
  IconeOrcamento,
  IconePatrimonio,
} from './components/icones.tsx';
import { Carregando, MensagemErro, Modal } from './components/ui.tsx';
import { useRecurso } from './lib/hooks.ts';
import { Configuracoes } from './pages/Configuracoes.tsx';
import { Fechamento } from './pages/Fechamento.tsx';
import { MeuFuturo } from './pages/MeuFuturo.tsx';
import { Onboarding } from './pages/Onboarding.tsx';
import { PaginaPatrimonio } from './pages/Patrimonio.tsx';
import { Placeholder } from './pages/Placeholder.tsx';

export type Rota = 'futuro' | 'patrimonio' | 'fechamento' | 'lancamentos' | 'orcamento' | 'configuracoes';

const ITENS: { rota: Rota; rotulo: string; curto: string; icone: (p: { tamanho?: number }) => ReactNode; etapa3?: boolean }[] = [
  { rota: 'futuro', rotulo: 'Meu Futuro', curto: 'Futuro', icone: IconeFuturo },
  { rota: 'patrimonio', rotulo: 'Patrimônio', curto: 'Patrimônio', icone: IconePatrimonio },
  { rota: 'fechamento', rotulo: 'Fechamento do mês', curto: 'Fechar mês', icone: IconeFechamento },
  { rota: 'lancamentos', rotulo: 'Lançamentos', curto: 'Lançamentos', icone: IconeLancamentos, etapa3: true },
  { rota: 'orcamento', rotulo: 'Orçamento', curto: 'Orçamento', icone: IconeOrcamento, etapa3: true },
  { rota: 'configuracoes', rotulo: 'Configurações', curto: 'Config.', icone: IconeConfig },
];

const lerRota = (): Rota => {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Rota;
  return ITENS.some((i) => i.rota === h) ? h : 'futuro';
};

export const navegar = (r: Rota) => {
  window.location.hash = `/${r}`;
};

export function App() {
  const [rota, setRota] = useState<Rota>(lerRota);
  const perfil = useRecurso<Perfil>('/profile');
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    const f = () => {
      setRota(lerRota());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  if (perfil.carregando && !perfil.dados) return <Carregando texto="Abrindo seu planejador…" />;
  if (perfil.erro) {
    return (
      <div className="mx-auto max-w-lg p-4 pt-10">
        <MensagemErro erro={perfil.erro} tentar={perfil.recarregar} />
      </div>
    );
  }
  if (perfil.dados && perfil.dados.onboarding_concluido !== 1) {
    return (
      <Onboarding
        aoConcluir={() => {
          navegar('futuro');
          perfil.recarregar();
        }}
      />
    );
  }

  const pagina = {
    futuro: <MeuFuturo />,
    patrimonio: <PaginaPatrimonio />,
    fechamento: <Fechamento />,
    lancamentos: <Placeholder titulo="Lançamentos" />,
    orcamento: <Placeholder titulo="Orçamento" />,
    configuracoes: <Configuracoes aoMudarPerfil={perfil.recarregar} />,
  }[rota];

  const principais = ITENS.slice(0, 3);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* Navegação lateral (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <a href="#/futuro" className="mb-6 flex items-center gap-2 px-2">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <span className="text-[17px] font-semibold tracking-tight">MyDashplan</span>
        </a>
        <nav className="flex flex-col gap-0.5" aria-label="Principal">
          {ITENS.map((i) => (
            <a
              key={i.rota}
              href={`#/${i.rota}`}
              aria-current={rota === i.rota ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors ${
                rota === i.rota ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-sunken hover:text-ink'
              }`}
            >
              <i.icone tamanho={19} />
              <span className="flex-1">{i.rotulo}</span>
              {i.etapa3 && <span className="rounded bg-sunken px-1.5 text-[11px] text-ink-3">Etapa 3</span>}
            </a>
          ))}
        </nav>
        <p className="mt-auto px-3 text-[12px] leading-snug text-ink-3">
          Demo · Fase 1
          <br />
          Dados locais (Cloudflare D1)
        </p>
      </aside>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">{pagina}</main>

      {/* Navegação inferior (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Principal"
      >
        {principais.map((i) => (
          <a
            key={i.rota}
            href={`#/${i.rota}`}
            aria-current={rota === i.rota ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${rota === i.rota ? 'text-brand-600' : 'text-ink-2'}`}
          >
            <i.icone tamanho={22} />
            {i.curto}
          </a>
        ))}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
            ['lancamentos', 'orcamento', 'configuracoes'].includes(rota) ? 'text-brand-600' : 'text-ink-2'
          }`}
        >
          <IconeMenu tamanho={22} />
          Mais
        </button>
      </nav>
      <Modal aberto={maisAberto} aoFechar={() => setMaisAberto(false)} titulo="Mais opções" largura="max-w-sm">
        <div className="flex flex-col gap-1">
          {ITENS.slice(3).map((i) => (
            <a
              key={i.rota}
              href={`#/${i.rota}`}
              onClick={() => setMaisAberto(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] hover:bg-sunken"
            >
              <i.icone tamanho={20} />
              <span className="flex-1">{i.rotulo}</span>
              {i.etapa3 && <span className="rounded bg-sunken px-1.5 text-[11px] text-ink-3">Etapa 3</span>}
            </a>
          ))}
        </div>
      </Modal>
    </div>
  );
}
