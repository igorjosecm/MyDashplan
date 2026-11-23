import { HTTPException } from 'hono/http-exception';
import type { DB } from './repo.ts';

export const naoEncontrado = (o: string): never => {
  throw new HTTPException(404, { message: `${o} não encontrado(a).` });
};

export const requisicaoInvalida = (msg: string): never => {
  throw new HTTPException(400, { message: msg });
};

/**
 * UPDATE dinâmico só com colunas permitidas (as chaves já passaram por schema zod .strict()).
 * Retorna null se não houver nada a atualizar.
 */
export function stmtUpdate(
  db: DB,
  tabela: string,
  campos: Record<string, unknown>,
  permitidas: readonly string[],
  where: string,
  whereArgs: unknown[],
  extrasSQL: string[] = [],
): D1PreparedStatement | null {
  const cols = Object.keys(campos).filter((k) => permitidas.includes(k) && campos[k] !== undefined);
  const sets = [...cols.map((k) => `${k} = ?`), ...extrasSQL];
  if (!sets.length) return null;
  return db.prepare(`UPDATE ${tabela} SET ${sets.join(', ')} WHERE ${where}`).bind(...cols.map((k) => campos[k]), ...whereArgs);
}

export const idParam = (s: string): number => {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) requisicaoInvalida('Identificador inválido.');
  return n;
};

/** Normaliza descrição (§6.1) — usada nos lançamentos de ajuste. */
export function normalizarDescricao(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** INSERT do lançamento de ajuste "Não rastreado" (§3.3). */
export function stmtAjuste(db: DB, contaId: number, data: string, diferenca: number, descricao: string, mesFechamento: string | null) {
  return db
    .prepare(
      `INSERT INTO transactions (account_id, data, valor_centavos, descricao, descricao_normalizada, category_id, tipo, status, origem, closing_id)
       VALUES (?, ?, ?, ?, ?, ?, 'ajuste', 'realizado', 'ajuste', (SELECT id FROM monthly_closings WHERE mes = ?))`,
    )
    .bind(
      contaId,
      data,
      diferenca,
      descricao,
      normalizarDescricao(descricao),
      diferenca > 0 ? 'nao_rastreado_entrada' : 'nao_rastreado_saida',
      mesFechamento,
    );
}

/** UPSERT de SaldoSnapshot (um por alvo por dia). */
export function stmtSnapshot(
  db: DB,
  alvo: 'conta' | 'bem' | 'divida',
  alvoId: number,
  data: string,
  valor: number,
  origem: 'manual' | 'onboarding' | 'fechamento',
  mesFechamento: string | null = null,
  observacao: string | null = null,
) {
  return db
    .prepare(
      `INSERT INTO balance_snapshots (alvo_tipo, alvo_id, data, valor_centavos, origem, closing_id, observacao)
       VALUES (?, ?, ?, ?, ?, (SELECT id FROM monthly_closings WHERE mes = ?), ?)
       ON CONFLICT (alvo_tipo, alvo_id, data) DO UPDATE SET
         valor_centavos = excluded.valor_centavos, origem = excluded.origem,
         closing_id = excluded.closing_id, observacao = excluded.observacao`,
    )
    .bind(alvo, alvoId, data, valor, origem, mesFechamento, observacao);
}
