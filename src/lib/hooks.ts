import { useCallback, useEffect, useRef, useState } from 'react';
import { api, mensagemErro } from './api.ts';

/** Busca um recurso da API com recarga manual. */
export function useRecurso<T>(caminho: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    setCarregando(true);
    api
      .get<T>(caminho)
      .then((d) => {
        if (vivo) {
          setDados(d);
          setErro(null);
        }
      })
      .catch((e) => vivo && setErro(mensagemErro(e)))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [caminho, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, setDados, erro, carregando, recarregar };
}

/**
 * Acumula alterações e as envia uma única vez após `ms` sem mudanças
 * (evita uma requisição por movimento de slider — contraste com §4.9).
 */
export function useSalvarComDebounce<T extends object>(salvar: (patch: Partial<T>) => Promise<void>, ms = 700) {
  const pendente = useRef<Partial<T>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [estado, setEstado] = useState<'ocioso' | 'pendente' | 'salvando' | 'salvo' | 'erro'>('ocioso');
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;

  const descarregar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pendente.current;
    if (!Object.keys(patch).length) return;
    pendente.current = {};
    setEstado('salvando');
    try {
      await salvarRef.current(patch);
      setEstado(Object.keys(pendente.current).length ? 'pendente' : 'salvo');
    } catch {
      setEstado('erro');
    }
  }, []);

  const agendar = useCallback(
    (patch: Partial<T>) => {
      pendente.current = { ...pendente.current, ...patch };
      setEstado('pendente');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(descarregar, ms);
    },
    [descarregar, ms],
  );

  // Garante o envio ao sair da tela.
  useEffect(() => () => void descarregar(), [descarregar]);
  return { agendar, estado, descarregar };
}
