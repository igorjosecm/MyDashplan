-- ════════════════════════════════════════════════════════════════════════════
-- seed_demo.sql — cenário FICTÍCIO de demonstração (gerado por scripts/generate-seed.ts; não edite à mão)
-- Pessoa: Ana Demo, nascida em 1988-04-20. Contas so_saldo, 1 bem, 1 dívida,
-- 2 fechamentos históricos (2026-08 e 2026-09) e 3 projetos de vida. Outubro fica em aberto para o fluxo
-- "Fechamento do mês"; os saldos de 30/09 deixam o selo de frescor do PL âmbar (> 35 dias).
-- Aplicar: npm run db:seed:local  (limpa os dados do usuário e recarrega este cenário)
-- ════════════════════════════════════════════════════════════════════════════

PRAGMA defer_foreign_keys = on;

DELETE FROM transactions;
DELETE FROM categorization_rules;
DELETE FROM monthly_budgets;
DELETE FROM recurrences;
DELETE FROM installment_plans;
DELETE FROM import_batches;
DELETE FROM balance_snapshots;
DELETE FROM monthly_closings;
DELETE FROM investment_product_goals;
DELETE FROM investment_products;
DELETE FROM debts;
DELETE FROM assets;
DELETE FROM accounts;
DELETE FROM csv_import_profiles;
DELETE FROM institutions;
DELETE FROM life_projects;
DELETE FROM financial_plans;
DELETE FROM client_profile;
DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'categorization_rules', 'monthly_budgets', 'recurrences', 'installment_plans', 'import_batches', 'balance_snapshots', 'monthly_closings', 'investment_product_goals', 'investment_products', 'debts', 'assets', 'accounts', 'csv_import_profiles', 'institutions', 'life_projects', 'financial_plans', 'client_profile');

INSERT INTO client_profile (id, nome, data_nascimento, onboarding_concluido, modo_pl_manual, pl_manual_centavos, onb1_respondido)
VALUES (1, 'Ana Demo', '1988-04-20', 1, 0, 0, 1);

INSERT INTO financial_plans (id, modo_taxa, taxa_real_anual_acumulacao, taxa_real_anual_aposentadoria, taxa_nominal_anual_acumulacao, taxa_nominal_anual_aposentadoria, inflacao_anual, idade_aposentadoria, expectativa_vida, renda_desejada_centavos, outras_rendas_centavos, meta_aporte_mensal_centavos, patrimonio_sucessao_centavos, colchao_seguranca_centavos, colchao_customizado)
VALUES (1, 'real', 0.04, 0.035, 0.0868, 0.0816, 0.045, 60, 90, 900000, 200000, 450000, 0, 3000000, 1);

INSERT INTO life_projects (id, nome, tipo, valor_centavos, data_inicial, data_final, parcelas, prazo, estagio, ativo, cod_projeto) VALUES
  (1, 'Viagem para a Europa', 'viagem', 2500000, '2028-07-01', '2028-07-01', 0, 'a_vista', 'sonho', 1, 'P-demo0001'),
  (2, 'Troca de carro', 'veiculo', 7200000, '2029-03-01', '2031-03-01', 24, 'a_prazo', 'essencial', 1, 'P-demo0002'),
  (3, 'Bônus / PLR investido', 'aporte_financeiro', 1500000, '2027-03-01', '2027-03-01', 0, 'a_vista', 'essencial', 1, 'P-demo0003');

INSERT INTO institutions (id, nome, cor) VALUES
  (1, 'Banco Aurora (fictício)', '#2563eb'),
  (2, 'Corretora Horizonte (fictícia)', '#0d9488'),
  (3, 'Seguradora Atlas (fictícia)', '#9333ea');

INSERT INTO accounts (id, institution_id, nome, tipo, modo_controle, conta_no_pl, saldo_inicial_centavos, data_ancora, dia_fechamento, dia_vencimento, limite_centavos, ordem) VALUES
  (1, 1, 'Conta corrente', 'corrente', 'detalhado', 0, 485000, '2026-07-31', NULL, NULL, NULL, 1),
  (2, 1, 'Reserva de emergência', 'poupanca', 'so_saldo', 0, 2800000, '2026-07-31', NULL, NULL, NULL, 2),
  (3, 2, 'Carteira de investimentos', 'investimento', 'so_saldo', 1, 17840000, '2026-07-31', NULL, NULL, NULL, 3),
  (4, 3, 'Previdência privada (PGBL)', 'previdencia', 'so_saldo', 1, 6230000, '2026-07-31', NULL, NULL, NULL, 4),
  (5, 1, 'Cartão Aurora', 'cartao', 'detalhado', 0, 0, '2026-07-31', 3, 10, 1500000, 5);

INSERT INTO assets (id, nome, classe, categoria, atualizar_mensalmente) VALUES (1, 'Apartamento', 'imovel', 'residencial', 0);

INSERT INTO debts (id, nome, tipo, asset_id, institution_id, total_tomado_centavos, taxa_juros_anual, atualizar_mensalmente)
VALUES (1, 'Financiamento do apartamento', 'financiamento', 1, 1, 42000000, 0.105, 1);

INSERT INTO monthly_closings (id, mes, data_referencia, status, concluido_em, pl_centavos, ativos_centavos, passivos_centavos,
  patrimonio_liquido_centavos, aporte_real_centavos, aporte_fonte, nao_rastreado_centavos, resultado_meu_futuro_json, resumo_json) VALUES
  (1, '2026-08', '2026-08-31', 'concluido', '2026-08-31T22:00:00Z', 24755000, 92150000, 29515000, 62635000, 400000, 'informado', 0, '{"hoje":"2026-09","pl":247550,"pnCP":1569561.16,"pCP":2439.98,"saldoAoAposentar":2240831.24,"mesIF":"2043-01","idadeIF":54}', '{"pct_comprometido":32}'),
  (2, '2026-09', '2026-09-30', 'concluido', '2026-09-30T22:00:00Z', 25360000, 92870000, 29348000, 63522000, 523959, 'estimado', 0, '{"hoje":"2026-10","pl":253600,"pnCP":1569561.16,"pCP":2423.9,"saldoAoAposentar":2242554.89,"mesIF":"2042-12","idadeIF":54}', '{"pct_comprometido":31.6}');

-- Saldos iniciais de bem e dívida (31/07) + snapshots gravados pelos fechamentos.
INSERT INTO balance_snapshots (alvo_tipo, alvo_id, data, valor_centavos, origem, closing_id) VALUES
  ('bem', 1, '2026-07-31', 64000000, 'manual', NULL),
  ('divida', 1, '2026-07-31', 29680000, 'manual', NULL),
  ('conta', 2, '2026-08-31', 2910000, 'fechamento', 1),
  ('conta', 3, '2026-08-31', 18395000, 'fechamento', 1),
  ('conta', 4, '2026-08-31', 6360000, 'fechamento', 1),
  ('divida', 1, '2026-08-31', 29515000, 'fechamento', 1),
  ('conta', 2, '2026-09-30', 3025000, 'fechamento', 2),
  ('conta', 3, '2026-09-30', 18872000, 'fechamento', 2),
  ('conta', 4, '2026-09-30', 6488000, 'fechamento', 2),
  ('divida', 1, '2026-09-30', 29348000, 'fechamento', 2);
