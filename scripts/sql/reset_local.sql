-- Apaga todos os dados do usuário (mantém budget_classifications e categories).
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
DELETE FROM sqlite_sequence WHERE name NOT IN ('budget_classifications', 'categories');
