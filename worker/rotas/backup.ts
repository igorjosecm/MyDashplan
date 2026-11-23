import { Hono } from 'hono';
import type { BackupArquivo } from '../../shared/types.ts';
import { agoraISO, atualizarCachesPlano, hojeLocal } from '../repo.ts';
import { requisicaoInvalida } from '../util.ts';

export const rotasBackup = new Hono<{ Bindings: Env }>();

/** Ordem de inserção (pais antes dos filhos). A exclusão usa a ordem inversa. */
export const TABELAS_BACKUP = [
  'budget_classifications',
  'categories',
  'client_profile',
  'financial_plans',
  'life_projects',
  'institutions',
  'csv_import_profiles',
  'accounts',
  'investment_products',
  'investment_product_goals',
  'assets',
  'debts',
  'monthly_closings',
  'balance_snapshots',
  'import_batches',
  'installment_plans',
  'recurrences',
  'transactions',
  'categorization_rules',
  'monthly_budgets',
] as const;

rotasBackup.get('/backup/export', async (c) => {
  const db = c.env.DB;
  const res = await db.batch(TABELAS_BACKUP.map((t) => db.prepare(`SELECT * FROM ${t} ORDER BY rowid`)));
  const arq: BackupArquivo = {
    formato: 'mydashplan-backup',
    versao: 1,
    exportado_em: agoraISO(),
    tabelas: Object.fromEntries(TABELAS_BACKUP.map((t, i) => [t, res[i].results as Record<string, unknown>[]])),
  };
  const nome = `mydashplan-backup-${hojeLocal()}.json`;
  return new Response(JSON.stringify(arq, null, 1), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${nome}"` },
  });
});

/** Restauração completa: substitui TODOS os dados, numa única transação (db.batch). */
rotasBackup.post('/backup/import', async (c) => {
  const db = c.env.DB;
  let arq: BackupArquivo;
  try {
    arq = await c.req.json<BackupArquivo>();
  } catch {
    return requisicaoInvalida('Arquivo não é um JSON válido.');
  }
  if (arq?.formato !== 'mydashplan-backup' || arq.versao !== 1 || typeof arq.tabelas !== 'object' || !arq.tabelas) {
    requisicaoInvalida('Arquivo não é um backup do MyDashplan (formato/versão desconhecidos).');
  }
  const desconhecidas = Object.keys(arq.tabelas).filter((t) => !(TABELAS_BACKUP as readonly string[]).includes(t));
  if (desconhecidas.length) requisicaoInvalida(`Tabelas desconhecidas no backup: ${desconhecidas.join(', ')}`);

  // Colunas reais de cada tabela: só elas são aceitas.
  const infos = await db.batch(TABELAS_BACKUP.map((t) => db.prepare(`SELECT name FROM pragma_table_info('${t}')`)));
  const colunas = new Map(TABELAS_BACKUP.map((t, i) => [t, new Set((infos[i].results as { name: string }[]).map((r) => r.name))]));

  const stmts: D1PreparedStatement[] = [db.prepare('PRAGMA defer_foreign_keys = on')];
  for (const t of [...TABELAS_BACKUP].reverse()) stmts.push(db.prepare(`DELETE FROM ${t}`));
  let linhas = 0;
  for (const t of TABELAS_BACKUP) {
    const rows = arq.tabelas[t] ?? [];
    if (!Array.isArray(rows)) requisicaoInvalida(`Tabela ${t} inválida.`);
    const cols = colunas.get(t)!;
    for (const row of rows) {
      const keys = Object.keys(row).filter((k) => cols.has(k));
      if (!keys.length) continue;
      const vals = keys.map((k) => {
        const v = row[k];
        if (v !== null && typeof v === 'object') requisicaoInvalida(`Valor inválido em ${t}.${k}.`);
        return v;
      });
      stmts.push(db.prepare(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...vals));
      linhas++;
    }
  }
  try {
    await db.batch(stmts);
  } catch (e) {
    requisicaoInvalida(`Falha ao restaurar (nada foi alterado): ${(e as Error).message}`);
  }
  await atualizarCachesPlano(db, hojeLocal());
  return c.json({ ok: true, linhas });
});
