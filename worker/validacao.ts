import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { parseDataCivil, TIPOS_PROJETO } from '../shared/finance-engine.ts';

/** Validador JSON com mensagem de erro em português. */
export const corpo = <T extends z.ZodType>(schema: T) =>
  zValidator('json', schema, (r, c) => {
    if (!r.success) {
      return c.json(
        { erro: 'Dados inválidos', detalhes: r.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })) },
        400,
      );
    }
  });

const dataValida = (s: string) => {
  try {
    parseDataCivil(s);
    return true;
  } catch {
    return false;
  }
};

export const zData = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD').refine(dataValida, 'Data inexistente');
export const zMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use AAAA-MM');
export const zCentavos = z.number().int('Use centavos inteiros').safe();
export const zCentavosPos = zCentavos.min(0, 'Não pode ser negativo');
export const zTaxa = z.number().gt(-0.99).lt(10);
export const zBool01 = z.union([z.literal(0), z.literal(1)]);
export const zProprietario = z.enum(['eu', 'conjuge', 'ambos']);

export const zPlanoParcial = z
  .object({
    modo_taxa: z.enum(['real', 'nominal']),
    taxa_real_anual_acumulacao: zTaxa,
    taxa_real_anual_aposentadoria: zTaxa,
    taxa_nominal_anual_acumulacao: zTaxa,
    taxa_nominal_anual_aposentadoria: zTaxa,
    inflacao_anual: zTaxa,
    idade_aposentadoria: z.number().int().min(18).max(110),
    expectativa_vida: z.number().int().min(50).max(120),
    renda_desejada_centavos: zCentavosPos,
    outras_rendas_centavos: zCentavosPos,
    meta_aporte_mensal_centavos: zCentavos,
    patrimonio_sucessao_centavos: zCentavosPos,
    colchao_seguranca_centavos: zCentavosPos,
    colchao_customizado: zBool01,
  })
  .partial()
  .strict();

export const zPerfilParcial = z
  .object({
    nome: z.string().trim().max(120).nullable(),
    data_nascimento: zData.nullable(),
    modo_pl_manual: zBool01,
    pl_manual_centavos: zCentavos,
    onb1_respondido: zBool01,
  })
  .partial()
  .strict();

export const zOnboarding = z.object({
  nome: z.string().trim().max(120).nullable().optional(),
  data_nascimento: zData.nullable().optional(),
  idade_aposentadoria: z.number().int().min(18).max(110).nullable().optional(),
  renda_desejada_centavos: zCentavosPos.nullable().optional(),
  outras_rendas_centavos: zCentavosPos.nullable().optional(),
  meta_aporte_mensal_centavos: zCentavos.nullable().optional(),
  pl: z
    .discriminatedUnion('modo', [
      z.object({ modo: z.literal('total'), valor_centavos: zCentavos }),
      z.object({
        modo: z.literal('contas'),
        contas: z
          .array(
            z.object({
              nome: z.string().trim().min(1).max(80),
              saldo_centavos: zCentavos,
              tipo: z.enum(['investimento', 'poupanca', 'previdencia']).default('investimento'),
            }),
          )
          .max(30),
      }),
    ])
    .nullable()
    .optional(),
});

export const zProjeto = z
  .object({
    nome: z.string().trim().min(1).max(120),
    tipo: z.enum(TIPOS_PROJETO),
    valor_centavos: zCentavosPos,
    data_inicial: zData,
    parcelas: z.number().int().min(0).max(600).default(0),
    prazo: z.enum(['a_vista', 'a_prazo', 'mes', 'trimestre', 'semestre', 'ano']).default('a_vista'),
    estagio: z.enum(['essencial', 'desejo', 'sonho']).default('desejo'),
    ativo: zBool01.default(1),
    observacao: z.string().max(500).nullable().optional(),
    /** Repetição (L2): total de ocorrências (inclui a primeira) a cada intervalo_meses. */
    repeticao: z
      .object({ intervalo_meses: z.number().int().min(1).max(120), ocorrencias: z.number().int().min(2).max(60) })
      .nullable()
      .optional(),
  })
  .strict();

export const zProjetoParcial = zProjeto.omit({ repeticao: true }).partial().strict();

export const zConta = z
  .object({
    nome: z.string().trim().min(1).max(80),
    instituicao_nome: z.string().trim().max(80).nullable().optional(),
    tipo: z.enum(['corrente', 'poupanca', 'investimento', 'previdencia', 'cartao', 'dinheiro', 'outro']),
    modo_controle: z.enum(['detalhado', 'so_saldo']).optional(),
    conta_no_pl: zBool01.optional(),
    saldo_inicial_centavos: zCentavos.default(0),
    data_ancora: zData.optional(),
    proprietario: zProprietario.default('eu'),
    dia_fechamento: z.number().int().min(1).max(31).nullable().optional(),
    dia_vencimento: z.number().int().min(1).max(31).nullable().optional(),
    limite_centavos: zCentavosPos.nullable().optional(),
  })
  .strict();

export const zContaParcial = z
  .object({
    nome: z.string().trim().min(1).max(80),
    instituicao_nome: z.string().trim().max(80).nullable(),
    modo_controle: z.enum(['detalhado', 'so_saldo']),
    conta_no_pl: zBool01,
    ativa: zBool01,
    proprietario: zProprietario,
    dia_fechamento: z.number().int().min(1).max(31).nullable(),
    dia_vencimento: z.number().int().min(1).max(31).nullable(),
    limite_centavos: zCentavosPos.nullable(),
  })
  .partial()
  .strict();

export const zBem = z
  .object({
    nome: z.string().trim().min(1).max(80),
    classe: z.enum(['movel', 'imovel']),
    categoria: z.enum(['residencial', 'veraneio', 'comercial', 'investimentos', 'participacao_empresa', 'veiculo', 'outro']),
    valor_centavos: zCentavosPos,
    data: zData.optional(),
    proprietario: zProprietario.default('eu'),
    atualizar_mensalmente: zBool01.default(0),
  })
  .strict();

export const zBemParcial = zBem.omit({ valor_centavos: true, data: true }).extend({ ativo: zBool01 }).partial().strict();

export const zDivida = z
  .object({
    nome: z.string().trim().min(1).max(80),
    tipo: z.enum(['emprestimo', 'financiamento', 'consignado', 'outro']),
    asset_id: z.number().int().positive().nullable().optional(),
    total_tomado_centavos: zCentavosPos.nullable().optional(),
    taxa_juros_anual: z.number().min(0).max(10).nullable().optional(),
    saldo_devedor_centavos: zCentavosPos,
    data: zData.optional(),
    proprietario: zProprietario.default('eu'),
    atualizar_mensalmente: zBool01.default(1),
  })
  .strict();

export const zDividaParcial = zDivida.omit({ saldo_devedor_centavos: true, data: true }).extend({ ativo: zBool01 }).partial().strict();

export const zSnapshot = z
  .object({
    alvo_tipo: z.enum(['conta', 'bem', 'divida']),
    alvo_id: z.number().int().positive(),
    data: zData.optional(),
    valor_centavos: zCentavos,
    observacao: z.string().max(300).nullable().optional(),
  })
  .strict();

export const zFechamento = z
  .object({
    mes: zMes,
    itens: z
      .array(z.object({ alvo_tipo: z.enum(['conta', 'bem', 'divida']), alvo_id: z.number().int().positive(), valor_centavos: zCentavos }))
      .max(500),
    aporte_informado_centavos: zCentavos.nullable().optional(),
  })
  .strict();
