-- ════════════════════════════════════════════════════════════════════════════
-- MyDashplan — schema inicial (Fase 1, já preparado para F2/F3)
-- Fontes: SPEC_DASHPLAN_CLEANROOM.md §2.1 + SPEC_ENTRADA_MANUAL.md §8
--
-- Convenções:
--   • Dinheiro: INTEGER em centavos com sinal (*_centavos). Negativo = saída (QA-7).
--   • Datas civis: TEXT 'AAAA-MM-DD' (sem fuso). Meses: TEXT 'AAAA-MM'.
--   • Carimbos de auditoria (*_em): TEXT ISO-8601 UTC.
--   • Taxas: REAL anual (0.04 = 4% a.a.).
--   • App de usuário único: client_profile e financial_plans têm uma linha (id = 1).
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── Perfil e plano ───────────────────────────

CREATE TABLE client_profile (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  nome                  TEXT,
  data_nascimento       TEXT CHECK (data_nascimento IS NULL OR data_nascimento GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  onboarding_concluido  INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_concluido IN (0, 1)),
  -- ONB-1: enquanto modo_pl_manual = 1, o PL do Meu Futuro é pl_manual_centavos.
  modo_pl_manual        INTEGER NOT NULL DEFAULT 1 CHECK (modo_pl_manual IN (0, 1)),
  pl_manual_centavos    INTEGER NOT NULL DEFAULT 0,
  pl_manual_data        TEXT CHECK (pl_manual_data IS NULL OR pl_manual_data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  onb1_respondido       INTEGER NOT NULL DEFAULT 0 CHECK (onb1_respondido IN (0, 1)),
  preferencias_json     TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(preferencias_json)),
  criado_em             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- PlanejamentoFinanceiro (§2.1) — premissas do Meu Futuro + caches gravados de volta (§2.2).
CREATE TABLE financial_plans (
  id                                    INTEGER PRIMARY KEY CHECK (id = 1),
  modo_taxa                             TEXT NOT NULL DEFAULT 'real' CHECK (modo_taxa IN ('real', 'nominal')),
  taxa_real_anual_acumulacao            REAL NOT NULL DEFAULT 0.04,
  taxa_real_anual_aposentadoria         REAL NOT NULL DEFAULT 0.035,
  taxa_nominal_anual_acumulacao         REAL NOT NULL DEFAULT 0.0868,   -- ≈ (1,04 × 1,045) − 1
  taxa_nominal_anual_aposentadoria      REAL NOT NULL DEFAULT 0.0816,   -- ≈ (1,035 × 1,045) − 1
  inflacao_anual                        REAL NOT NULL DEFAULT 0.045,    -- IPCA (só no modo nominal)
  idade_aposentadoria                   INTEGER NOT NULL DEFAULT 65 CHECK (idade_aposentadoria BETWEEN 18 AND 110),
  expectativa_vida                      INTEGER NOT NULL DEFAULT 90 CHECK (expectativa_vida BETWEEN 50 AND 120),
  renda_desejada_centavos               INTEGER NOT NULL DEFAULT 0 CHECK (renda_desejada_centavos >= 0),
  outras_rendas_centavos                INTEGER NOT NULL DEFAULT 0 CHECK (outras_rendas_centavos >= 0),
  meta_aporte_mensal_centavos           INTEGER NOT NULL DEFAULT 0,
  patrimonio_sucessao_centavos          INTEGER NOT NULL DEFAULT 0 CHECK (patrimonio_sucessao_centavos >= 0),
  aliquota_ir                           REAL NOT NULL DEFAULT 0.15,
  aliquota_itcmd                        REAL NOT NULL DEFAULT 0,
  taxa_honorarios                       REAL NOT NULL DEFAULT 0.04,
  colchao_seguranca_centavos            INTEGER NOT NULL DEFAULT 0 CHECK (colchao_seguranca_centavos >= 0),
  colchao_customizado                   INTEGER NOT NULL DEFAULT 0 CHECK (colchao_customizado IN (0, 1)),
  -- Caches (§2.2), recalculados pela API a cada gravação de premissas.
  patrimonio_necessario_consumo_centavos      INTEGER,
  valor_aposentadoria_real_centavos           INTEGER,
  patrimonio_projetado_aposentadoria_centavos INTEGER,
  saldo_real_longo_prazo_centavos             INTEGER,
  acumulado_projetos_longo_prazo_centavos     INTEGER,
  acumulo_investimentos_longo_prazo_centavos  INTEGER,
  mes_independencia                           TEXT CHECK (mes_independencia IS NULL OR mes_independencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  cache_atualizado_em                         TEXT,
  atualizado_em                         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ProjetoDeVida (§2.1) — metas e eventos do Meu Futuro. Repetição (L2): cópias com o mesmo cod_projeto.
CREATE TABLE life_projects (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                       TEXT NOT NULL,
  tipo                       TEXT NOT NULL CHECK (tipo IN ('viagem', 'familia', 'veiculo', 'casa', 'hobby', 'eletronico', 'educacao', 'outro', 'profissional', 'saude', 'ajuste_meta', 'aporte_financeiro')),
  valor_centavos             INTEGER NOT NULL CHECK (valor_centavos >= 0),
  data_inicial               TEXT NOT NULL CHECK (data_inicial GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  data_final                 TEXT NOT NULL CHECK (data_final GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  parcelas                   INTEGER NOT NULL DEFAULT 0 CHECK (parcelas >= 0 AND parcelas <= 600),
  prazo                      TEXT NOT NULL DEFAULT 'a_vista' CHECK (prazo IN ('a_vista', 'a_prazo', 'mes', 'trimestre', 'semestre', 'ano')),
  estagio                    TEXT NOT NULL DEFAULT 'desejo' CHECK (estagio IN ('essencial', 'desejo', 'sonho')),
  ativo                      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  alocado_centavos           INTEGER NOT NULL DEFAULT 0,
  repetindo                  INTEGER NOT NULL DEFAULT 0 CHECK (repetindo IN (0, 1)),
  cod_projeto                TEXT NOT NULL,
  repeticao_intervalo_meses  INTEGER CHECK (repeticao_intervalo_meses IS NULL OR repeticao_intervalo_meses > 0),
  repeticao_indice           INTEGER NOT NULL DEFAULT 0,
  trecho_aereo               TEXT,
  origem                     TEXT,
  destino                    TEXT,
  observacao                 TEXT,
  criado_em                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_life_projects_cod ON life_projects (cod_projeto);
CREATE INDEX idx_life_projects_inicio ON life_projects (ativo, data_inicial);

-- ─────────────────────────── Taxonomia (2 níveis) ───────────────────────────

-- ClassificacaoOrcamentaria (§2.1)
CREATE TABLE budget_classifications (
  id     TEXT PRIMARY KEY,
  nome   TEXT NOT NULL,
  ordem  INTEGER NOT NULL
);

-- CategoriaApp (§2.1)
CREATE TABLE categories (
  id                TEXT PRIMARY KEY,
  nome              TEXT NOT NULL,
  classificacao_id  TEXT NOT NULL REFERENCES budget_classifications (id),
  icone             TEXT,
  ordem             INTEGER NOT NULL DEFAULT 0,
  sistema           INTEGER NOT NULL DEFAULT 1 CHECK (sistema IN (0, 1)),
  ativa             INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1))
);
CREATE INDEX idx_categories_classificacao ON categories (classificacao_id);

-- ─────────────────────────── Instituições, contas, investimentos ───────────────────────────

CREATE TABLE institutions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT NOT NULL,
  apelido        TEXT,
  proprietario   TEXT NOT NULL DEFAULT 'eu' CHECK (proprietario IN ('eu', 'conjuge', 'ambos')),
  inativa        INTEGER NOT NULL DEFAULT 0 CHECK (inativa IN (0, 1)),
  cor            TEXT,
  criado_em      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- PerfilImportacaoCSV (§5.2 / §8) — F3
CREATE TABLE csv_import_profiles (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id         INTEGER REFERENCES institutions (id) ON DELETE SET NULL,
  nome                   TEXT NOT NULL,
  separador              TEXT NOT NULL DEFAULT ';',
  encoding               TEXT NOT NULL DEFAULT 'utf-8',
  linhas_ignorar_inicio  INTEGER NOT NULL DEFAULT 0,
  linhas_ignorar_fim     INTEGER NOT NULL DEFAULT 0,
  mapa_colunas_json      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(mapa_colunas_json)),
  formato_data           TEXT NOT NULL DEFAULT 'dd/mm/aaaa',
  separador_decimal      TEXT NOT NULL DEFAULT ',' CHECK (separador_decimal IN (',', '.')),
  sinal_invertido        INTEGER NOT NULL DEFAULT 0 CHECK (sinal_invertido IN (0, 1)),
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Conta (§2.1 + §3.1 de SPEC_ENTRADA_MANUAL). tipo 'cartao' ⇒ campos de cartão.
CREATE TABLE accounts (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id                  INTEGER REFERENCES institutions (id) ON DELETE SET NULL,
  nome                            TEXT NOT NULL,
  tipo                            TEXT NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'investimento', 'previdencia', 'cartao', 'dinheiro', 'outro')),
  modo_controle                   TEXT NOT NULL CHECK (modo_controle IN ('detalhado', 'so_saldo')),
  conta_no_pl                     INTEGER NOT NULL DEFAULT 0 CHECK (conta_no_pl IN (0, 1)),
  saldo_inicial_centavos          INTEGER NOT NULL DEFAULT 0,
  data_ancora                     TEXT NOT NULL CHECK (data_ancora GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  ativa                           INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  proprietario                    TEXT NOT NULL DEFAULT 'eu' CHECK (proprietario IN ('eu', 'conjuge', 'ambos')),
  -- Cartão de crédito (CC-1..CC-5)
  dia_fechamento                  INTEGER CHECK (dia_fechamento IS NULL OR dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento                  INTEGER CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31),
  limite_centavos                 INTEGER CHECK (limite_centavos IS NULL OR limite_centavos >= 0),
  compra_no_fechamento_proxima    INTEGER NOT NULL DEFAULT 1 CHECK (compra_no_fechamento_proxima IN (0, 1)),
  modo_cartao                     TEXT CHECK (modo_cartao IS NULL OR modo_cartao IN ('compra_a_compra', 'importar_fatura', 'so_total')),
  perfil_importacao_id            INTEGER REFERENCES csv_import_profiles (id) ON DELETE SET NULL,
  ordem                           INTEGER NOT NULL DEFAULT 0,
  criado_em                       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em                   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (tipo = 'cartao' OR (dia_fechamento IS NULL AND dia_vencimento IS NULL))
);
CREATE INDEX idx_accounts_institution ON accounts (institution_id);

-- ProdutoInvestimento (§2.1). Valor atual = último balance_snapshot (alvo_tipo = 'produto').
CREATE TABLE investment_products (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id              INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  nome                    TEXT NOT NULL,
  categoria               TEXT NOT NULL DEFAULT 'renda_fixa' CHECK (categoria IN ('renda_fixa', 'renda_variavel', 'fundos', 'coe', 'previdencia', 'outros')),
  classe_ativo            TEXT,
  liquidez_resgate        TEXT,
  pct_reserva_emergencia  REAL NOT NULL DEFAULT 0 CHECK (pct_reserva_emergencia BETWEEN 0 AND 1),
  pct_independencia       REAL NOT NULL DEFAULT 1 CHECK (pct_independencia BETWEEN 0 AND 1),
  ativo                   INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_investment_products_account ON investment_products (account_id);

-- ObjetivoPorProduto (§2.1)
CREATE TABLE investment_product_goals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id       INTEGER NOT NULL REFERENCES investment_products (id) ON DELETE CASCADE,
  percentual       REAL NOT NULL CHECK (percentual BETWEEN 0 AND 1),
  objetivo         TEXT NOT NULL CHECK (objetivo IN ('reserva', 'independencia', 'projeto')),
  life_project_id  INTEGER REFERENCES life_projects (id) ON DELETE SET NULL
);

-- ─────────────────────────── Bens e dívidas ───────────────────────────

-- Bem (§2.1). Valor atual = último balance_snapshot (alvo_tipo = 'bem').
CREATE TABLE assets (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                   TEXT NOT NULL,
  classe                 TEXT NOT NULL CHECK (classe IN ('movel', 'imovel')),
  categoria              TEXT NOT NULL CHECK (categoria IN ('residencial', 'veraneio', 'comercial', 'investimentos', 'participacao_empresa', 'veiculo', 'outro')),
  vendavel               INTEGER NOT NULL DEFAULT 1 CHECK (vendavel IN (0, 1)),
  ativo                  INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  rascunho               INTEGER NOT NULL DEFAULT 0 CHECK (rascunho IN (0, 1)),
  proprietario           TEXT NOT NULL DEFAULT 'eu' CHECK (proprietario IN ('eu', 'conjuge', 'ambos')),
  atualizar_mensalmente  INTEGER NOT NULL DEFAULT 0 CHECK (atualizar_mensalmente IN (0, 1)),
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Divida (§2.1). Financiamento de um bem = dívida com asset_id (substitui Bem.saldo_devedor).
-- Saldo devedor atual = último balance_snapshot (alvo_tipo = 'divida'), sempre ≥ 0.
CREATE TABLE debts (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                   TEXT NOT NULL,
  tipo                   TEXT NOT NULL DEFAULT 'emprestimo' CHECK (tipo IN ('emprestimo', 'financiamento', 'consignado', 'outro')),
  asset_id               INTEGER REFERENCES assets (id) ON DELETE SET NULL,
  institution_id         INTEGER REFERENCES institutions (id) ON DELETE SET NULL,
  total_tomado_centavos  INTEGER CHECK (total_tomado_centavos IS NULL OR total_tomado_centavos >= 0),
  taxa_juros_anual       REAL,
  proprietario           TEXT NOT NULL DEFAULT 'eu' CHECK (proprietario IN ('eu', 'conjuge', 'ambos')),
  ativo                  INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  atualizar_mensalmente  INTEGER NOT NULL DEFAULT 1 CHECK (atualizar_mensalmente IN (0, 1)),
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─────────────────────────── Fechamento e snapshots ───────────────────────────

-- Fechamento (§7.2)
CREATE TABLE monthly_closings (
  id                           INTEGER PRIMARY KEY AUTOINCREMENT,
  mes                          TEXT NOT NULL UNIQUE CHECK (mes GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  data_referencia              TEXT NOT NULL CHECK (data_referencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  status                       TEXT NOT NULL DEFAULT 'concluido' CHECK (status IN ('rascunho', 'concluido')),
  concluido_em                 TEXT,
  pl_centavos                  INTEGER NOT NULL,
  ativos_centavos              INTEGER NOT NULL,
  passivos_centavos            INTEGER NOT NULL,
  patrimonio_liquido_centavos  INTEGER NOT NULL,
  aporte_real_centavos         INTEGER,
  aporte_fonte                 TEXT CHECK (aporte_fonte IS NULL OR aporte_fonte IN ('detalhado', 'informado', 'estimado')),
  nao_rastreado_centavos       INTEGER NOT NULL DEFAULT 0,
  resultado_meu_futuro_json    TEXT CHECK (resultado_meu_futuro_json IS NULL OR json_valid(resultado_meu_futuro_json)),
  resumo_json                  TEXT CHECK (resumo_json IS NULL OR json_valid(resumo_json))
);

-- SaldoSnapshot (§3.2 / §8): fonte da verdade histórica de contas so_saldo, produtos, bens e dívidas.
CREATE TABLE balance_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  alvo_tipo       TEXT NOT NULL CHECK (alvo_tipo IN ('conta', 'produto', 'bem', 'divida')),
  alvo_id         INTEGER NOT NULL,
  data            TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  valor_centavos  INTEGER NOT NULL,
  origem          TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'onboarding', 'fechamento', 'ofx', 'ajuste', 'importador_externo')),
  closing_id      INTEGER REFERENCES monthly_closings (id) ON DELETE SET NULL,
  observacao      TEXT,
  criado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (alvo_tipo, alvo_id, data)
);
CREATE INDEX idx_snapshots_alvo_data ON balance_snapshots (alvo_tipo, alvo_id, data DESC);

-- ─────────────────────────── Lançamentos (F2/F3) ───────────────────────────

-- LoteImportacao (§5.3 / IMP-1, IMP-2)
CREATE TABLE import_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id      INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  arquivo_nome    TEXT,
  hash_conteudo   TEXT,
  formato         TEXT NOT NULL CHECK (formato IN ('ofx', 'csv', 'colado', 'importador_externo')),
  importado_em    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  contagens_json  TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(contagens_json)),
  desfeito_em     TEXT
);
CREATE INDEX idx_import_batches_hash ON import_batches (hash_conteudo);

-- Parcelamento (§3.5)
CREATE TABLE installment_plans (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id            INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  descricao             TEXT NOT NULL,
  category_id           TEXT REFERENCES categories (id),
  valor_total_centavos  INTEGER NOT NULL CHECK (valor_total_centavos > 0),
  n                     INTEGER NOT NULL CHECK (n BETWEEN 2 AND 48),
  parcela_inicial       INTEGER NOT NULL DEFAULT 1 CHECK (parcela_inicial >= 1),
  data_compra           TEXT NOT NULL CHECK (data_compra GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  criado_em             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Recorrencia (§4.2)
CREATE TABLE recurrences (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao        TEXT NOT NULL,
  valor_centavos   INTEGER NOT NULL CHECK (valor_centavos <> 0),
  valor_variavel   INTEGER NOT NULL DEFAULT 0 CHECK (valor_variavel IN (0, 1)),
  category_id      TEXT REFERENCES categories (id),
  account_id       INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  frequencia       TEXT NOT NULL CHECK (frequencia IN ('semanal', 'mensal', 'anual', 'n_meses')),
  intervalo_meses  INTEGER CHECK (intervalo_meses IS NULL OR intervalo_meses > 0),
  dia              INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
  inicio           TEXT NOT NULL CHECK (inicio GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  fim              TEXT CHECK (fim IS NULL OR fim GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  regra_dia_util   TEXT NOT NULL DEFAULT 'manter' CHECK (regra_dia_util IN ('manter', 'antecipar', 'postergar')),
  ativa            INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Transacao (§2.1 + §8)
CREATE TABLE transactions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id             INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  data                   TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  valor_centavos         INTEGER NOT NULL CHECK (valor_centavos <> 0),
  descricao              TEXT NOT NULL DEFAULT '',
  descricao_normalizada  TEXT NOT NULL DEFAULT '',
  category_id            TEXT REFERENCES categories (id),
  tipo                   TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia', 'fatura_cartao', 'ajuste')),
  status                 TEXT NOT NULL DEFAULT 'realizado' CHECK (status IN ('previsto', 'realizado')),
  origem                 TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'recorrencia', 'ofx', 'csv', 'colado', 'ajuste', 'importador_externo')),
  fitid                  TEXT,
  hash_dedup             TEXT,
  lote_id                INTEGER REFERENCES import_batches (id) ON DELETE SET NULL,
  recorrencia_id         INTEGER REFERENCES recurrences (id) ON DELETE SET NULL,
  parcelamento_id        INTEGER REFERENCES installment_plans (id) ON DELETE CASCADE,
  parcela_k              INTEGER,
  parcela_n              INTEGER,
  competencia_fatura     TEXT CHECK (competencia_fatura IS NULL OR competencia_fatura GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  transferencia_par_id   INTEGER REFERENCES transactions (id) ON DELETE SET NULL,
  transacao_pai_id       INTEGER REFERENCES transactions (id) ON DELETE CASCADE,
  closing_id             INTEGER REFERENCES monthly_closings (id) ON DELETE SET NULL,
  ignorado               INTEGER NOT NULL DEFAULT 0 CHECK (ignorado IN (0, 1)),
  tags_json              TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  excluido_em            TEXT,
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK ((parcela_k IS NULL) = (parcela_n IS NULL))
);
CREATE INDEX idx_transactions_conta_data ON transactions (account_id, data);
CREATE INDEX idx_transactions_data ON transactions (data);
CREATE INDEX idx_transactions_hash ON transactions (hash_dedup);
CREATE INDEX idx_transactions_desc ON transactions (descricao_normalizada);
CREATE UNIQUE INDEX uq_transactions_fitid ON transactions (account_id, fitid) WHERE fitid IS NOT NULL;
CREATE UNIQUE INDEX uq_transactions_recorrencia ON transactions (recorrencia_id, data) WHERE recorrencia_id IS NOT NULL AND excluido_em IS NULL;

-- RegraCategorizacao (§6.2)
CREATE TABLE categorization_rules (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  campo                 TEXT NOT NULL CHECK (campo IN ('descricao_normalizada', 'valor', 'conta')),
  operador              TEXT NOT NULL CHECK (operador IN ('igual', 'contem', 'comeca_com', 'regex', 'entre')),
  valor                 TEXT NOT NULL,
  valor2                TEXT,
  category_id           TEXT REFERENCES categories (id),
  tags_json             TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  ignorar               INTEGER NOT NULL DEFAULT 0 CHECK (ignorar IN (0, 1)),
  marcar_transferencia  INTEGER NOT NULL DEFAULT 0 CHECK (marcar_transferencia IN (0, 1)),
  renomear              TEXT,
  prioridade            INTEGER NOT NULL DEFAULT 100,
  origem                TEXT NOT NULL DEFAULT 'usuario' CHECK (origem IN ('usuario', 'aprendida')),
  ativa                 INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- MetaGastoMensal (§2.1). mes NULL = meta padrão de todos os meses.
CREATE TABLE monthly_budgets (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id              TEXT NOT NULL REFERENCES categories (id),
  mes                      TEXT CHECK (mes IS NULL OR mes GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  valor_centavos           INTEGER NOT NULL CHECK (valor_centavos >= 0),
  meta_economia_centavos   INTEGER NOT NULL DEFAULT 0,
  licao_de_casa            INTEGER NOT NULL DEFAULT 0 CHECK (licao_de_casa IN (0, 1))
);
CREATE UNIQUE INDEX uq_monthly_budgets ON monthly_budgets (category_id, IFNULL(mes, '*'));

-- ════════════════════════════ Dados de referência ════════════════════════════

INSERT INTO budget_classifications (id, nome, ordem) VALUES
  ('renda',                     'Renda',                       1),
  ('despesas_obrigatorias',     'Despesas obrigatórias',       2),
  ('despesas_nao_obrigatorias', 'Despesas não obrigatórias',   3),
  ('empresa_autonomo',          'Empresa e autônomo',          4),
  ('projetos',                  'Projetos',                    5),
  ('financiamentos',            'Financiamentos',              6),
  ('dividas',                   'Dívidas',                     7),
  ('investimentos',             'Investimentos',               8),
  ('neutra',                    'Classificação neutra',        9);

INSERT INTO categories (id, nome, classificacao_id, icone, ordem) VALUES
  -- Renda
  ('salario',                 'Salário',                          'renda', '💼', 1),
  ('renda_extra',             'Renda extra / freelas',            'renda', '🧩', 2),
  ('aluguel_recebido',        'Aluguel recebido',                 'renda', '🏘️', 3),
  ('rendimentos',             'Rendimentos e dividendos',         'renda', '📈', 4),
  ('aposentadoria_inss',      'Aposentadoria / benefícios',       'renda', '🧓', 5),
  ('reembolsos',              'Reembolsos',                       'renda', '↩️', 6),
  ('outras_receitas',         'Outras receitas',                  'renda', '➕', 7),
  ('nao_rastreado_entrada',   'Não rastreado (entrada)',          'renda', '❔', 8),
  -- Despesas obrigatórias
  ('moradia',                 'Aluguel / prestação da casa',      'despesas_obrigatorias', '🏠', 10),
  ('condominio',              'Condomínio',                       'despesas_obrigatorias', '🏢', 11),
  ('contas_consumo',          'Luz, água e gás',                  'despesas_obrigatorias', '💡', 12),
  ('internet_telefone',       'Internet e telefone',              'despesas_obrigatorias', '📶', 13),
  ('mercado',                 'Mercado',                          'despesas_obrigatorias', '🛒', 14),
  ('saude',                   'Saúde e plano de saúde',           'despesas_obrigatorias', '🩺', 15),
  ('farmacia',                'Farmácia',                         'despesas_obrigatorias', '💊', 16),
  ('educacao',                'Educação',                         'despesas_obrigatorias', '🎓', 17),
  ('transporte',              'Transporte e combustível',         'despesas_obrigatorias', '🚗', 18),
  ('seguros',                 'Seguros',                          'despesas_obrigatorias', '🛡️', 19),
  ('impostos_taxas',          'Impostos e taxas',                 'despesas_obrigatorias', '🧾', 20),
  ('filhos',                  'Filhos e dependentes',             'despesas_obrigatorias', '🧸', 21),
  -- Despesas não obrigatórias
  ('restaurantes',            'Restaurantes e bares',             'despesas_nao_obrigatorias', '🍽️', 30),
  ('delivery',                'Delivery',                         'despesas_nao_obrigatorias', '🛵', 31),
  ('lazer',                   'Lazer e entretenimento',           'despesas_nao_obrigatorias', '🎟️', 32),
  ('viagens',                 'Viagens',                          'despesas_nao_obrigatorias', '✈️', 33),
  ('compras',                 'Compras',                          'despesas_nao_obrigatorias', '🛍️', 34),
  ('vestuario',               'Vestuário',                        'despesas_nao_obrigatorias', '👕', 35),
  ('beleza',                  'Beleza e cuidados pessoais',       'despesas_nao_obrigatorias', '💇', 36),
  ('assinaturas',             'Assinaturas e streaming',          'despesas_nao_obrigatorias', '📺', 37),
  ('presentes',               'Presentes e doações',              'despesas_nao_obrigatorias', '🎁', 38),
  ('pets',                    'Pets',                             'despesas_nao_obrigatorias', '🐾', 39),
  ('academia',                'Academia e esportes',              'despesas_nao_obrigatorias', '🏋️', 40),
  ('eletronicos',             'Eletrônicos',                      'despesas_nao_obrigatorias', '💻', 41),
  ('outras_despesas',         'Outras despesas',                  'despesas_nao_obrigatorias', '➖', 42),
  ('nao_rastreado_saida',     'Não rastreado (saída)',            'despesas_nao_obrigatorias', '❔', 43),
  -- Empresa e autônomo
  ('receita_empresa',         'Receita da empresa / autônomo',    'empresa_autonomo', '🏭', 50),
  ('despesa_empresa',         'Despesa da empresa / autônomo',    'empresa_autonomo', '📦', 51),
  ('impostos_empresa',        'Impostos da empresa (DAS etc.)',   'empresa_autonomo', '🧮', 52),
  -- Projetos
  ('projeto_de_vida',         'Projeto de vida',                  'projetos', '🎯', 60),
  -- Financiamentos
  ('financiamento_imovel',    'Financiamento imobiliário',        'financiamentos', '🏦', 70),
  ('financiamento_veiculo',   'Financiamento de veículo',         'financiamentos', '🚙', 71),
  -- Dívidas
  ('emprestimo',              'Empréstimo',                       'dividas', '💳', 80),
  ('juros_tarifas',           'Juros e tarifas bancárias',        'dividas', '📉', 81),
  -- Investimentos
  ('aplicacao',               'Aplicação em investimentos',       'investimentos', '🌱', 90),
  ('resgate',                 'Resgate de investimentos',         'investimentos', '🌾', 91),
  ('previdencia_privada',     'Previdência privada',              'investimentos', '🪺', 92),
  -- Neutra
  ('transferencia_propria',   'Transferência entre contas próprias', 'neutra', '🔁', 100),
  ('pagamento_fatura',        'Pagamento de fatura de cartão',    'neutra', '💳', 101),
  ('ajuste_neutro',           'Ajuste neutro',                    'neutra', '⚖️', 102);
