import { Hono } from 'hono';
import { dataFinalProjeto, difMesesData, somarMesesData } from '../../shared/meu-futuro.ts';
import { frescorPL } from '../../shared/patrimonio.ts';
import { CAMPOS_PLANO_EDITAVEIS, type FuturoResposta, type ProjetoVida } from '../../shared/types.ts';
import {
  agoraISO,
  atualizarCachesPlano,
  hojeLocal,
  lerContas,
  lerPerfil,
  lerPlano,
  lerProjetos,
  listarFechamentos,
  perguntaOnb1,
} from '../repo.ts';
import { idParam, naoEncontrado, requisicaoInvalida, stmtUpdate } from '../util.ts';
import { corpo, zPlanoParcial, zProjeto, zProjetoParcial } from '../validacao.ts';

export const rotasFuturo = new Hono<{ Bindings: Env }>();

rotasFuturo.get('/future', async (c) => {
  const db = c.env.DB;
  const hoje = hojeLocal();
  const [perfil, plano, projetos, contas, fechamentos, onb1] = await Promise.all([
    lerPerfil(db),
    lerPlano(db),
    lerProjetos(db),
    lerContas(db, hoje),
    listarFechamentos(db),
    perguntaOnb1(db, hoje),
  ]);
  const resp: FuturoResposta = {
    hoje,
    perfil,
    plano,
    projetos,
    pl: frescorPL(contas, perfil, hoje),
    fechamentos: fechamentos.map((f) => ({ mes: f.mes, data_referencia: f.data_referencia, pl_centavos: f.pl_centavos })).reverse(),
    onb1,
  };
  return c.json(resp);
});

rotasFuturo.get('/future/plan', async (c) => c.json(await lerPlano(c.env.DB)));

rotasFuturo.put('/future/plan', corpo(zPlanoParcial), async (c) => {
  const db = c.env.DB;
  await lerPlano(db);
  const st = stmtUpdate(db, 'financial_plans', c.req.valid('json'), CAMPOS_PLANO_EDITAVEIS, 'id = 1', [], [`atualizado_em = '${agoraISO()}'`]);
  if (st) await st.run();
  await atualizarCachesPlano(db, hojeLocal());
  return c.json(await lerPlano(db));
});

// ─────────────────────────── Projetos de vida ───────────────────────────

const COLS_PROJETO = ['nome', 'tipo', 'valor_centavos', 'data_inicial', 'data_final', 'parcelas', 'prazo', 'estagio', 'ativo', 'observacao'] as const;

/** À vista ⇒ 0 parcelas; ajuste da meta não tem parcelas. */
function normalizarParcelas(prazo: string | undefined, tipo: string | undefined, parcelas: number | undefined): number | undefined {
  if (tipo === 'ajuste_meta' || prazo === 'a_vista') return 0;
  return parcelas;
}

rotasFuturo.get('/future/projects', async (c) => c.json(await lerProjetos(c.env.DB)));

rotasFuturo.post('/future/projects', corpo(zProjeto), async (c) => {
  const db = c.env.DB;
  const b = c.req.valid('json');
  const parcelas = normalizarParcelas(b.prazo, b.tipo, b.parcelas) ?? 0;
  if (b.prazo === 'a_prazo' && parcelas < 2) requisicaoInvalida('Projeto à prazo precisa de pelo menos 2 parcelas.');
  const cod = `P-${crypto.randomUUID().slice(0, 8)}`;
  const ocorrencias = b.repeticao?.ocorrencias ?? 1;
  const intervalo = b.repeticao?.intervalo_meses ?? null;
  const stmts = [];
  for (let k = 0; k < ocorrencias; k++) {
    const ini = k === 0 ? b.data_inicial : somarMesesData(b.data_inicial, k * intervalo!);
    stmts.push(
      db
        .prepare(
          `INSERT INTO life_projects (nome, tipo, valor_centavos, data_inicial, data_final, parcelas, prazo, estagio, ativo,
             repetindo, cod_projeto, repeticao_intervalo_meses, repeticao_indice, observacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          b.nome,
          b.tipo,
          b.valor_centavos,
          ini,
          dataFinalProjeto(ini, parcelas),
          parcelas,
          b.prazo,
          b.estagio,
          b.ativo,
          ocorrencias > 1 ? 1 : 0,
          cod,
          intervalo,
          k,
          b.observacao ?? null,
        ),
    );
  }
  await db.batch(stmts);
  await atualizarCachesPlano(db, hojeLocal());
  return c.json(await lerProjetos(db), 201);
});

async function lerProjeto(db: D1Database, id: number): Promise<ProjetoVida> {
  const p = await db.prepare('SELECT * FROM life_projects WHERE id = ?').bind(id).first<ProjetoVida>();
  return p ?? naoEncontrado('Projeto');
}

/** escopo: 'este' (padrão) ou 'todos' (todas as cópias com o mesmo cod_projeto — L2). */
rotasFuturo.put('/future/projects/:id', corpo(zProjetoParcial), async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  const escopo = c.req.query('escopo') === 'todos' ? 'todos' : 'este';
  const b = c.req.valid('json');
  const alvo = await lerProjeto(db, id);
  const grupo =
    escopo === 'todos'
      ? (await db.prepare('SELECT * FROM life_projects WHERE cod_projeto = ? ORDER BY repeticao_indice, id').bind(alvo.cod_projeto).all<ProjetoVida>()).results
      : [alvo];
  // Mudança de data em "todos": desloca todas as cópias pelo mesmo número de meses.
  const deslocamento = b.data_inicial ? difMesesData(alvo.data_inicial, b.data_inicial) : 0;
  const stmts = [];
  for (const p of grupo) {
    const tipo = b.tipo ?? p.tipo;
    const prazo = b.prazo ?? p.prazo;
    const parcelas = normalizarParcelas(prazo, tipo, b.parcelas ?? p.parcelas) ?? 0;
    if (prazo === 'a_prazo' && parcelas < 2) requisicaoInvalida('Projeto à prazo precisa de pelo menos 2 parcelas.');
    const dataInicial = p.id === alvo.id && b.data_inicial ? b.data_inicial : deslocamento ? somarMesesData(p.data_inicial, deslocamento) : p.data_inicial;
    const campos = { ...b, parcelas, data_inicial: dataInicial, data_final: dataFinalProjeto(dataInicial, parcelas) };
    const st = stmtUpdate(db, 'life_projects', campos, COLS_PROJETO, 'id = ?', [p.id], [`atualizado_em = '${agoraISO()}'`]);
    if (st) stmts.push(st);
  }
  if (stmts.length) await db.batch(stmts);
  await atualizarCachesPlano(db, hojeLocal());
  return c.json(await lerProjetos(db));
});

rotasFuturo.delete('/future/projects/:id', async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param('id'));
  const alvo = await lerProjeto(db, id);
  if (c.req.query('escopo') === 'todos') await db.prepare('DELETE FROM life_projects WHERE cod_projeto = ?').bind(alvo.cod_projeto).run();
  else await db.prepare('DELETE FROM life_projects WHERE id = ?').bind(id).run();
  await atualizarCachesPlano(db, hojeLocal());
  return c.json(await lerProjetos(db));
});
