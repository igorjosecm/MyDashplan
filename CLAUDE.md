# MyDashplan

Planejador financeiro pessoal com entrada manual de dados (sem Open Finance). A Fase 1 (demo) está concluída: Meu Futuro, Patrimônio e Fechamento do mês. A próxima etapa é a Fase 2: lançamentos, recorrências, cartão e orçamento.

## Stack

- **Runtime:** Cloudflare Workers com **Static Assets**. Um único deploy serve o front (build do Vite) e a API em `/api/*`, configurado em `wrangler.jsonc`.
- **API:** Hono, em `worker/`, com validação por zod.
- **Banco:** Cloudflare **D1** (SQLite), binding `DB`. Migrações em `migrations/NNNN_*.sql`; o padrão do `wrangler.jsonc` exclui `seed_demo.sql`.
- **Front:** React 19 + TypeScript + Vite + Tailwind 4, em `src/`.
  - Gráficos: **somente Apache ECharts**, com importação modular em `src/components/EChart.tsx`.
- **Testes:** Vitest, em `shared/**/*.test.ts`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `shared/` | Domínio puro, sem DOM e sem banco. `finance-engine.ts` é o motor do Meu Futuro; `meu-futuro.ts` converte centavos para o motor; `patrimonio.ts`; `types.ts` é o contrato da API. É usado igual pelo worker e pelo navegador. |
| `worker/` | `index.ts` (app Hono), `rotas/*.ts`, `repo.ts` (acesso ao D1), `validacao.ts`, `util.ts`. |
| `src/` | `pages/`, `futuro/` (componentes do Meu Futuro), `components/` (UI e ECharts), `lib/` (api, hooks, formatação). |
| `migrations/` | Schema SQL e `seed_demo.sql`. O seed é gerado por `scripts/generate-seed.ts`: não edite à mão. |
| `docs/` | Especificações (ver abaixo). |

## Regras obrigatórias

- **Dinheiro:** sempre `INTEGER` em **centavos com sinal** (`*_centavos`, negativo = saída). Nunca use float no banco nem na API.
  - Só o motor (`shared/finance-engine.ts`) trabalha em reais (`number`). A conversão fica em `shared/meu-futuro.ts`.
- **Datas:** sempre `TEXT` no formato `AAAA-MM-DD`, sem fuso. Meses usam `AAAA-MM`. "Hoje" vem de `hojeLocal()` (fuso America/Sao_Paulo).
- **Motor:** o modo `modoCompatibilidadeDashplan` existe só para a suíte de regressão (cenários A, B e C da §5). O app usa o modo corrigido.
  - Mudou o motor? Rode `npm test`. Os números da §5 precisam continuar batendo exatamente.
- **Clean-room:** não copie código, CSS nem textos proprietários. Os artefatos de análise ficam em `analise-rea/` e `pagina-salva/`. Eles contêm dados pessoais, são ignorados pelo Git e nunca devem ser lidos para dentro do código nem versionados.

## Especificações (`docs/`)

- `docs/SPEC_DASHPLAN_CLEANROOM.md` traz:
  - o modelo de dados (§2) e as regras de negócio (§3);
  - a matemática dos Motores P e F (§4);
  - os cenários de validação (§5) e as lacunas (§6).
- `docs/SPEC_ENTRADA_MANUAL.md` traz:
  - a entrada manual, com níveis 0/1/2, `SaldoSnapshot` e `Fechamento`;
  - os ajustes de schema (§8);
  - as fases F1 a F4 (§11).

## Comandos

```bash
npm run dev               # Vite + Workers runtime + D1 local em http://localhost:5173
npm test                  # Vitest
npm run build             # tsc -b (app, worker, node) + vite build
npm run db:migrate:local  # aplica migrações no D1 local
npm run db:seed:local     # migra e carrega o cenário fictício de demonstração
npm run db:reset:local    # zera os dados do usuário (para testar o Onboarding)
npm run seed:generate     # regenera migrations/seed_demo.sql com o motor real
npm run cf-typegen        # regenera worker-configuration.d.ts após mudar o wrangler.jsonc
```
