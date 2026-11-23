import { useEffect, useRef, useState } from 'react';
import type { BackupArquivo, Perfil } from '../../shared/types.ts';
import { IconeDownload, IconeUpload } from '../components/icones.tsx';
import { Botao, Cabecalho, Card, Carregando, MensagemErro, useUI } from '../components/ui.tsx';
import { api, mensagemErro } from '../lib/api.ts';
import { fmtData } from '../lib/format.ts';
import { useRecurso } from '../lib/hooks.ts';

export function Configuracoes({ aoMudarPerfil }: { aoMudarPerfil: () => void }) {
  const { toast, confirmar } = useUI();
  const perfil = useRecurso<Perfil>('/profile');
  const [nome, setNome] = useState('');
  const [nasc, setNasc] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (perfil.dados) {
      setNome(perfil.dados.nome ?? '');
      setNasc(perfil.dados.data_nascimento ?? '');
    }
  }, [perfil.dados]);

  if (perfil.erro) return <MensagemErro erro={perfil.erro} tentar={perfil.recarregar} />;
  if (!perfil.dados) return <Carregando />;

  async function salvarPerfil() {
    setSalvando(true);
    try {
      await api.put('/profile', { nome: nome.trim() || null, data_nascimento: nasc || null });
      toast('Perfil salvo.');
      perfil.recarregar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function importar(f: File) {
    let dados: BackupArquivo;
    try {
      dados = JSON.parse(await f.text());
    } catch {
      return toast('O arquivo não é um JSON válido.', 'erro');
    }
    if (dados?.formato !== 'mydashplan-backup') return toast('Este arquivo não é um backup do MyDashplan.', 'erro');
    const linhas = Object.values(dados.tabelas ?? {}).reduce((s, t) => s + (Array.isArray(t) ? t.length : 0), 0);
    const r = await confirmar({
      titulo: 'Restaurar este backup?',
      texto: (
        <>
          Backup exportado em <strong>{fmtData(dados.exportado_em?.slice(0, 10) ?? null)}</strong> com {linhas} registros.
          <br />
          <strong>Todos os dados atuais serão substituídos.</strong> Se algo falhar, nada é alterado.
        </>
      ),
      opcoes: [{ rotulo: 'Substituir tudo', valor: 'sim', variante: 'perigo' }],
    });
    if (!r) return;
    setImportando(true);
    try {
      const res = await api.post<{ linhas: number }>('/backup/import', dados);
      toast(`Backup restaurado (${res.linhas} registros).`);
      aoMudarPerfil();
      perfil.recarregar();
    } catch (e) {
      toast(mensagemErro(e), 'erro');
    } finally {
      setImportando(false);
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Configurações" />

      <Card titulo="Perfil">
        <div className="grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="cfg-nome">
              Nome
            </label>
            <input id="cfg-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="cfg-nasc">
              Data de nascimento
            </label>
            <input id="cfg-nasc" type="date" className="campo" value={nasc} onChange={(e) => setNasc(e.target.value)} min="1920-01-01" />
          </div>
        </div>
        <Botao className="mt-4" onClick={salvarPerfil} carregando={salvando}>
          Salvar perfil
        </Botao>
      </Card>

      <Card titulo="Backup">
        <p className="mb-4 max-w-2xl text-[14px] text-ink-2">
          Exporte um arquivo JSON com <strong>todos</strong> os seus dados (plano, projetos, contas, saldos, fechamentos). Guarde-o em lugar seguro: ele contém
          suas informações financeiras. A restauração substitui tudo, numa única transação.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup/export" download className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-[14px] font-medium text-white hover:bg-brand-700">
            <IconeDownload tamanho={17} /> Exportar backup
          </a>
          <Botao variante="secundario" onClick={() => arquivo.current?.click()} carregando={importando}>
            <IconeUpload tamanho={17} /> Restaurar backup…
          </Botao>
          <input ref={arquivo} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
        </div>
      </Card>

      <Card titulo="Sobre esta demo">
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-ink-2">
          <li>Fase 1: Meu Futuro, Patrimônio e Fechamento do mês. Lançamentos e Orçamento chegam na Etapa 3 (o banco já está pronto para eles).</li>
          <li>Os cálculos rodam no navegador e no servidor com o mesmo motor (shared/finance-engine.ts), validado contra os cenários da especificação.</li>
          <li>
            Para recomeçar do zero no ambiente local: <code className="rounded bg-sunken px-1">npm run db:reset:local</code>; para recarregar o cenário de
            demonstração: <code className="rounded bg-sunken px-1">npm run db:seed:local</code>.
          </li>
        </ul>
      </Card>
    </div>
  );
}
