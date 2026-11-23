import { useCallback } from 'react';
import { useUI } from '../components/ui.tsx';
import type { Onb1Pergunta } from '../../shared/types.ts';
import { api } from './api.ts';
import { fmtCentavos } from './format.ts';

/**
 * ONB-1 (SPEC_ENTRADA_MANUAL §2): quando a primeira conta do PL recebe saldo e o PL ainda é o valor
 * informado no onboarding, pergunta se deve substituí-lo pela soma das contas.
 * Retorna true se algo mudou (para a tela recarregar).
 */
export function useOnb1() {
  const { confirmar, toast } = useUI();
  return useCallback(
    async (p: Onb1Pergunta | undefined | null): Promise<boolean> => {
      if (!p?.perguntar) return false;
      const r = await confirmar({
        titulo: 'Usar a soma das contas como patrimônio investível?',
        texto: (
          <>
            No onboarding você informou <strong>{fmtCentavos(p.pl_manual_centavos)}</strong> como patrimônio investido. Agora suas contas que
            entram no PL somam <strong>{fmtCentavos(p.pl_contas_centavos)}</strong>.
            <br />
            <br />
            Substituir o valor informado pela soma das contas? O Meu Futuro passará a usar os saldos das contas.
          </>
        ),
        opcoes: [
          { rotulo: 'Manter o valor informado', valor: 'manter', variante: 'secundario' },
          { rotulo: 'Substituir pela soma', valor: 'substituir' },
        ],
      });
      if (r === null) return false; // pergunta de novo na próxima vez
      await api.post('/onboarding/onb1', { substituir: r === 'substituir' });
      toast(r === 'substituir' ? 'Patrimônio investível agora vem das contas.' : 'Mantido o valor informado.');
      return true;
    },
    [confirmar, toast],
  );
}
