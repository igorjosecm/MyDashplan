import type { TipoProjeto } from '../../shared/finance-engine.ts';
import type { EstagioProjeto } from '../../shared/types.ts';

export const TIPOS: Record<TipoProjeto, { rotulo: string; icone: string }> = {
  viagem: { rotulo: 'Viagem', icone: '✈️' },
  familia: { rotulo: 'Família', icone: '👨‍👩‍👧' },
  veiculo: { rotulo: 'Veículo', icone: '🚗' },
  casa: { rotulo: 'Casa', icone: '🏠' },
  hobby: { rotulo: 'Hobby', icone: '🎨' },
  eletronico: { rotulo: 'Eletrônico', icone: '💻' },
  educacao: { rotulo: 'Educação', icone: '🎓' },
  profissional: { rotulo: 'Profissional', icone: '💼' },
  saude: { rotulo: 'Saúde', icone: '🩺' },
  outro: { rotulo: 'Outro', icone: '🎯' },
  aporte_financeiro: { rotulo: 'Aporte financeiro (entrada)', icone: '💰' },
  ajuste_meta: { rotulo: 'Ajuste da meta de aporte', icone: '🔁' },
};

export const ESTAGIOS: { valor: EstagioProjeto; rotulo: string }[] = [
  { valor: 'essencial', rotulo: 'Essencial' },
  { valor: 'desejo', rotulo: 'Desejo' },
  { valor: 'sonho', rotulo: 'Sonho' },
];

export const INTERVALOS_REPETICAO = [1, 3, 6, 12, 24, 36, 48];

export const ehEspecial = (t: TipoProjeto) => t === 'aporte_financeiro' || t === 'ajuste_meta';
