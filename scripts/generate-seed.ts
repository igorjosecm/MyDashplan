/**
 * Gera ./migrations/seed_demo.sql (cenário fictício de demonstração).
 * Os resultados do Meu Futuro dos fechamentos históricos são calculados com o motor real,
 * para o seed nunca divergir do código. Uso: `npm run seed:generate` (Node ≥ 22.18 roda .ts direto).
 */
import { writeFileSync } from 'node:fs';
import { resumirResultado } from '../shared/finance-engine.ts';
import { mesSeguinte, rodarMeuFuturo, ultimoDiaDoMes } from '../shared/meu-futuro.ts';
import { aporteEstimado } from '../shared/patrimonio.ts';
import { taxaMensal } from '../shared/finance-engine.ts';

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const R = (reais: number) => Math.round(reais * 100); // reais → centavos

// ─────────── Cenário ───────────
const perfil = { nome: 'Ana Demo', data_nascimento: '1988-04-20' };
const plano = {
  modo_taxa: 'real' as const,
  taxa_real_anual_acumulacao: 0.04,
  taxa_real_anual_aposentadoria: 0.035,
  taxa_nominal_anual_acumulacao: 0.0868,
  taxa_nominal_anual_aposentadoria: 0.0816,
  inflacao_anual: 0.045,
  idade_aposentadoria: 60,
  expectativa_vida: 90,
  renda_desejada_centavos: R(9000),
  outras_rendas_centavos: R(2000),
  meta_aporte_mensal_centavos: R(4500),
  patrimonio_sucessao_centavos: 0,
  colchao_seguranca_centavos: R(30000),
  colchao_customizado: 1,
};
const projetos = [
  { id: 1, nome: 'Viagem para a Europa', tipo: 'viagem' as const, valor_centavos: R(25000), data_inicial: '2028-07-01', data_final: '2028-07-01', parcelas: 0, prazo: 'a_vista', estagio: 'sonho', cod: 'P-demo0001', ativo: 1 as const },
  { id: 2, nome: 'Troca de carro', tipo: 'veiculo' as const, valor_centavos: R(72000), data_inicial: '2029-03-01', data_final: '2031-03-01', parcelas: 24, prazo: 'a_prazo', estagio: 'essencial', cod: 'P-demo0002', ativo: 1 as const },
  { id: 3, nome: 'Bônus / PLR investido', tipo: 'aporte_financeiro' as const, valor_centavos: R(15000), data_inicial: '2027-03-01', data_final: '2027-03-01', parcelas: 0, prazo: 'a_vista', estagio: 'essencial', cod: 'P-demo0003', ativo: 1 as const },
];
const instituicoes = [
  { id: 1, nome: 'Banco Aurora (fictício)', cor: '#2563eb' },
  { id: 2, nome: 'Corretora Horizonte (fictícia)', cor: '#0d9488' },
  { id: 3, nome: 'Seguradora Atlas (fictícia)', cor: '#9333ea' },
];
const ANCORA = '2026-07-31';
const contas = [
  { id: 1, inst: 1, nome: 'Conta corrente', tipo: 'corrente', modo: 'detalhado', no_pl: 0, inicial: R(4850) },
  { id: 2, inst: 1, nome: 'Reserva de emergência', tipo: 'poupanca', modo: 'so_saldo', no_pl: 0, inicial: R(28000) },
  { id: 3, inst: 2, nome: 'Carteira de investimentos', tipo: 'investimento', modo: 'so_saldo', no_pl: 1, inicial: R(178400) },
  { id: 4, inst: 3, nome: 'Previdência privada (PGBL)', tipo: 'previdencia', modo: 'so_saldo', no_pl: 1, inicial: R(62300) },
  { id: 5, inst: 1, nome: 'Cartão Aurora', tipo: 'cartao', modo: 'detalhado', no_pl: 0, inicial: 0 },
];
// Snapshots mensais das contas so_saldo (a âncora de 31/07 já é o saldo inicial).
const snapContas: Record<number, Record<string, number>> = {
  2: { '2026-08-31': R(29100), '2026-09-30': R(30250) },
  3: { '2026-08-31': R(183950), '2026-09-30': R(188720) },
  4: { '2026-08-31': R(63600), '2026-09-30': R(64880) },
};
const bem = { id: 1, nome: 'Apartamento', valor: R(640000), data: ANCORA };
const divida = { id: 1, nome: 'Financiamento do apartamento', total: R(420000), juros: 0.105 };
const snapDivida: Record<string, number> = { '2026-07-31': R(296800), '2026-08-31': R(295150), '2026-09-30': R(293480) };
const fechamentos = [
  { mes: '2026-08', aporteInformado: R(4000) as number | null },
  { mes: '2026-09', aporteInformado: null },
];

// ─────────── Cálculo dos fechamentos ───────────
function saldoConta(id: number, data: string): number {
  const c = contas.find((x) => x.id === id)!;
  let v = c.inicial;
  for (const [d, val] of Object.entries(snapContas[id] ?? {}).sort()) if (d <= data) v = val;
  return v;
}
const plEm = (data: string) => contas.filter((c) => c.no_pl === 1).reduce((s, c) => s + saldoConta(c.id, data), 0);
const iAcc = taxaMensal(plano.taxa_real_anual_acumulacao);

const linhasFech: string[] = [];
const snapsFech: string[] = [];
fechamentos.forEach((f, idx) => {
  const dataRef = ultimoDiaDoMes(f.mes);
  const pl = plEm(dataRef);
  const ativosContas = contas.reduce((s, c) => s + Math.max(0, saldoConta(c.id, dataRef)), 0);
  const ativos = ativosContas + bem.valor;
  const passivos = snapDivida[dataRef];
  const plAnterior = plEm(ultimoDiaDoMes(f.mes === '2026-08' ? '2026-07' : '2026-08'));
  const aporte = f.aporteInformado ?? aporteEstimado(pl, plAnterior, iAcc);
  const fonte = f.aporteInformado !== null ? 'informado' : 'estimado';
  const hojeMotor = mesSeguinte(f.mes);
  const r = rodarMeuFuturo({ hoje: hojeMotor, nascimento: perfil.data_nascimento, plano, projetos, plCentavos: pl });
  const resultado = resumirResultado(hojeMotor, pl / 100, r);
  const id = idx + 1;
  linhasFech.push(
    `(${id}, ${q(f.mes)}, ${q(dataRef)}, 'concluido', ${q(`${dataRef}T22:00:00Z`)}, ${pl}, ${ativos}, ${passivos}, ${ativos - passivos}, ${aporte}, ${q(fonte)}, 0, ${q(JSON.stringify(resultado))}, ${q(JSON.stringify({ pct_comprometido: Math.round((passivos / ativos) * 1000) / 10 }))})`,
  );
  for (const [cid, m] of Object.entries(snapContas)) if (m[dataRef] !== undefined) snapsFech.push(`('conta', ${cid}, ${q(dataRef)}, ${m[dataRef]}, 'fechamento', ${id})`);
  snapsFech.push(`('divida', ${divida.id}, ${q(dataRef)}, ${snapDivida[dataRef]}, 'fechamento', ${id})`);
  console.log(`Fechamento ${f.mes}: PL ${pl / 100} · aporte ${aporte / 100} (${fonte}) · IF ${resultado.mesIF ?? 'não atinge'} (${resultado.idadeIF ?? '-'} anos)`);
});

// ─────────── SQL ───────────
const TABELAS_USUARIO = [
  'transactions', 'categorization_rules', 'monthly_budgets', 'recurrences', 'installment_plans', 'import_batches',
  'balance_snapshots', 'monthly_closings', 'investment_product_goals', 'investment_products', 'debts', 'assets',
  'accounts', 'csv_import_profiles', 'institutions', 'life_projects', 'financial_plans', 'client_profile',
];

const sql = `-- ════════════════════════════════════════════════════════════════════════════
-- seed_demo.sql — cenário FICTÍCIO de demonstração (gerado por scripts/generate-seed.ts; não edite à mão)
-- Pessoa: ${perfil.nome}, nascida em ${perfil.data_nascimento}. Contas so_saldo, 1 bem, 1 dívida,
-- 2 fechamentos históricos (2026-08 e 2026-09) e 3 projetos de vida. Outubro fica em aberto para o fluxo
-- "Fechamento do mês"; os saldos de 30/09 deixam o selo de frescor do PL âmbar (> 35 dias).
-- Aplicar: npm run db:seed:local  (limpa os dados do usuário e recarrega este cenário)
-- ════════════════════════════════════════════════════════════════════════════

PRAGMA defer_foreign_keys = on;

${TABELAS_USUARIO.map((t) => `DELETE FROM ${t};`).join('\n')}
DELETE FROM sqlite_sequence WHERE name IN (${TABELAS_USUARIO.map(q).join(', ')});

INSERT INTO client_profile (id, nome, data_nascimento, onboarding_concluido, modo_pl_manual, pl_manual_centavos, onb1_respondido)
VALUES (1, ${q(perfil.nome)}, ${q(perfil.data_nascimento)}, 1, 0, 0, 1);

INSERT INTO financial_plans (id, ${Object.keys(plano).join(', ')})
VALUES (1, ${Object.values(plano).map(q).join(', ')});

INSERT INTO life_projects (id, nome, tipo, valor_centavos, data_inicial, data_final, parcelas, prazo, estagio, ativo, cod_projeto) VALUES
${projetos.map((p) => `  (${p.id}, ${q(p.nome)}, ${q(p.tipo)}, ${p.valor_centavos}, ${q(p.data_inicial)}, ${q(p.data_final)}, ${p.parcelas}, ${q(p.prazo)}, ${q(p.estagio)}, ${p.ativo}, ${q(p.cod)})`).join(',\n')};

INSERT INTO institutions (id, nome, cor) VALUES
${instituicoes.map((i) => `  (${i.id}, ${q(i.nome)}, ${q(i.cor)})`).join(',\n')};

INSERT INTO accounts (id, institution_id, nome, tipo, modo_controle, conta_no_pl, saldo_inicial_centavos, data_ancora, dia_fechamento, dia_vencimento, limite_centavos, ordem) VALUES
${contas
  .map((c) => {
    const cartao = c.tipo === 'cartao';
    return `  (${c.id}, ${c.inst}, ${q(c.nome)}, ${q(c.tipo)}, ${q(c.modo)}, ${c.no_pl}, ${c.inicial}, ${q(ANCORA)}, ${cartao ? 3 : 'NULL'}, ${cartao ? 10 : 'NULL'}, ${cartao ? R(15000) : 'NULL'}, ${c.id})`;
  })
  .join(',\n')};

INSERT INTO assets (id, nome, classe, categoria, atualizar_mensalmente) VALUES (${bem.id}, ${q(bem.nome)}, 'imovel', 'residencial', 0);

INSERT INTO debts (id, nome, tipo, asset_id, institution_id, total_tomado_centavos, taxa_juros_anual, atualizar_mensalmente)
VALUES (${divida.id}, ${q(divida.nome)}, 'financiamento', ${bem.id}, 1, ${divida.total}, ${divida.juros}, 1);

INSERT INTO monthly_closings (id, mes, data_referencia, status, concluido_em, pl_centavos, ativos_centavos, passivos_centavos,
  patrimonio_liquido_centavos, aporte_real_centavos, aporte_fonte, nao_rastreado_centavos, resultado_meu_futuro_json, resumo_json) VALUES
${linhasFech.map((l) => `  ${l}`).join(',\n')};

-- Saldos iniciais de bem e dívida (31/07) + snapshots gravados pelos fechamentos.
INSERT INTO balance_snapshots (alvo_tipo, alvo_id, data, valor_centavos, origem, closing_id) VALUES
  ('bem', ${bem.id}, ${q(bem.data)}, ${bem.valor}, 'manual', NULL),
  ('divida', ${divida.id}, ${q(ANCORA)}, ${snapDivida[ANCORA]}, 'manual', NULL),
${snapsFech.map((s) => `  ${s}`).join(',\n')};
`;

writeFileSync(new URL('../migrations/seed_demo.sql', import.meta.url), sql);
console.log('✔ migrations/seed_demo.sql gerado.');
