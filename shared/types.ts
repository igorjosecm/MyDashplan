/**
 * Contrato de dados compartilhado entre API (worker) e UI.
 * Dinheiro sempre em centavos inteiros (*_centavos); datas 'AAAA-MM-DD'; meses 'AAAA-MM'.
 */
import type { ResumoMeuFuturo, TipoProjeto } from './finance-engine.ts';

export type Proprietario = 'eu' | 'conjuge' | 'ambos';
export type TipoConta = 'corrente' | 'poupanca' | 'investimento' | 'previdencia' | 'cartao' | 'dinheiro' | 'outro';
export type ModoControle = 'detalhado' | 'so_saldo';
export type ClasseBem = 'movel' | 'imovel';
export type CategoriaBem = 'residencial' | 'veraneio' | 'comercial' | 'investimentos' | 'participacao_empresa' | 'veiculo' | 'outro';
export type TipoDivida = 'emprestimo' | 'financiamento' | 'consignado' | 'outro';
export type AlvoSnapshot = 'conta' | 'produto' | 'bem' | 'divida';
export type EstagioProjeto = 'essencial' | 'desejo' | 'sonho';
export type PrazoProjeto = 'a_vista' | 'a_prazo' | 'mes' | 'trimestre' | 'semestre' | 'ano';
export type FonteAporte = 'detalhado' | 'informado' | 'estimado';

export interface Perfil {
  nome: string | null;
  data_nascimento: string | null;
  onboarding_concluido: 0 | 1;
  modo_pl_manual: 0 | 1;
  pl_manual_centavos: number;
  pl_manual_data: string | null;
  onb1_respondido: 0 | 1;
  preferencias_json: string;
}

export interface Plano {
  modo_taxa: 'real' | 'nominal';
  taxa_real_anual_acumulacao: number;
  taxa_real_anual_aposentadoria: number;
  taxa_nominal_anual_acumulacao: number;
  taxa_nominal_anual_aposentadoria: number;
  inflacao_anual: number;
  idade_aposentadoria: number;
  expectativa_vida: number;
  renda_desejada_centavos: number;
  outras_rendas_centavos: number;
  meta_aporte_mensal_centavos: number;
  patrimonio_sucessao_centavos: number;
  colchao_seguranca_centavos: number;
  colchao_customizado: 0 | 1;
  patrimonio_necessario_consumo_centavos: number | null;
  valor_aposentadoria_real_centavos: number | null;
  patrimonio_projetado_aposentadoria_centavos: number | null;
  saldo_real_longo_prazo_centavos: number | null;
  acumulado_projetos_longo_prazo_centavos: number | null;
  acumulo_investimentos_longo_prazo_centavos: number | null;
  mes_independencia: string | null;
  cache_atualizado_em: string | null;
}

/** Campos de premissa editáveis pela UI (subconjunto de Plano). */
export const CAMPOS_PLANO_EDITAVEIS = [
  'modo_taxa',
  'taxa_real_anual_acumulacao',
  'taxa_real_anual_aposentadoria',
  'taxa_nominal_anual_acumulacao',
  'taxa_nominal_anual_aposentadoria',
  'inflacao_anual',
  'idade_aposentadoria',
  'expectativa_vida',
  'renda_desejada_centavos',
  'outras_rendas_centavos',
  'meta_aporte_mensal_centavos',
  'patrimonio_sucessao_centavos',
  'colchao_seguranca_centavos',
  'colchao_customizado',
] as const;
export type CampoPlanoEditavel = (typeof CAMPOS_PLANO_EDITAVEIS)[number];
export type PlanoEditavel = Pick<Plano, CampoPlanoEditavel>;

export interface ProjetoVida {
  id: number;
  nome: string;
  tipo: TipoProjeto;
  valor_centavos: number;
  data_inicial: string;
  data_final: string;
  parcelas: number;
  prazo: PrazoProjeto;
  estagio: EstagioProjeto;
  ativo: 0 | 1;
  repetindo: 0 | 1;
  cod_projeto: string;
  repeticao_intervalo_meses: number | null;
  repeticao_indice: number;
  observacao: string | null;
}

export interface Conta {
  id: number;
  institution_id: number | null;
  instituicao_nome: string | null;
  nome: string;
  tipo: TipoConta;
  modo_controle: ModoControle;
  conta_no_pl: 0 | 1;
  saldo_inicial_centavos: number;
  data_ancora: string;
  ativa: 0 | 1;
  proprietario: Proprietario;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  limite_centavos: number | null;
  /** Saldo calculado na data de referência. */
  saldo_centavos: number;
  /** Data do dado mais recente que compõe o saldo. */
  saldo_data: string;
}

export interface Bem {
  id: number;
  nome: string;
  classe: ClasseBem;
  categoria: CategoriaBem;
  ativo: 0 | 1;
  proprietario: Proprietario;
  atualizar_mensalmente: 0 | 1;
  valor_centavos: number;
  valor_data: string | null;
}

export interface Divida {
  id: number;
  nome: string;
  tipo: TipoDivida;
  asset_id: number | null;
  total_tomado_centavos: number | null;
  taxa_juros_anual: number | null;
  ativo: 0 | 1;
  proprietario: Proprietario;
  atualizar_mensalmente: 0 | 1;
  saldo_devedor_centavos: number;
  saldo_data: string | null;
}

export interface Snapshot {
  id: number;
  alvo_tipo: AlvoSnapshot;
  alvo_id: number;
  data: string;
  valor_centavos: number;
  origem: string;
  closing_id: number | null;
  observacao: string | null;
}

export interface FrescorPL {
  /** PL efetivo usado pelo Meu Futuro. */
  pl_centavos: number;
  fonte: 'manual' | 'contas';
  pl_contas_centavos: number;
  /** Data mais antiga entre os saldos que compõem o PL ("PL baseado em saldos de …"). */
  data_base: string | null;
  dias: number | null;
  desatualizado: boolean;
}

export interface Patrimonio {
  data_referencia: string;
  ativos_centavos: number;
  passivos_centavos: number;
  patrimonio_liquido_centavos: number;
  pct_comprometido: number | null;
  gerador_renda_centavos: number;
  uso_pessoal_centavos: number;
  investivel: FrescorPL;
  contas: Conta[];
  bens: Bem[];
  dividas: Divida[];
}

export interface Fechamento {
  id: number;
  mes: string;
  data_referencia: string;
  status: 'rascunho' | 'concluido';
  concluido_em: string | null;
  pl_centavos: number;
  ativos_centavos: number;
  passivos_centavos: number;
  patrimonio_liquido_centavos: number;
  aporte_real_centavos: number | null;
  aporte_fonte: FonteAporte | null;
  nao_rastreado_centavos: number;
  resultado: ResumoMeuFuturo | null;
}

export interface Onb1Pergunta {
  perguntar: boolean;
  pl_manual_centavos: number;
  pl_contas_centavos: number;
}

export interface FuturoResposta {
  hoje: string;
  perfil: Perfil;
  plano: Plano;
  projetos: ProjetoVida[];
  pl: FrescorPL;
  fechamentos: Pick<Fechamento, 'mes' | 'data_referencia' | 'pl_centavos'>[];
  onb1: Onb1Pergunta;
}

export interface PrepararFechamentoResposta {
  hoje: string;
  mes: string;
  data_referencia: string;
  ja_existe: boolean;
  contas: Conta[];
  bens: Bem[];
  dividas: Divida[];
  anterior: Fechamento | null;
  pl_anterior_centavos: number | null;
  taxa_mensal_acumulacao: number;
}

export interface ResultadoFechamento {
  fechamento: Fechamento;
  anterior: Fechamento | null;
  delta_patrimonio_liquido_centavos: number | null;
  meta_aporte_centavos: number;
  efeito: {
    mes_if_antes: string | null;
    mes_if_depois: string | null;
    ganho_meses: number | null;
  };
}

export interface BackupArquivo {
  formato: 'mydashplan-backup';
  versao: 1;
  exportado_em: string;
  tabelas: Record<string, Record<string, unknown>[]>;
}
