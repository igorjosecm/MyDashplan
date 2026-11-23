# MyDashplan — Demo Fase 1

Planejador financeiro pessoal, com entrada manual de dados (sem Open Finance). A Fase 1 cobre três áreas:

- **Meu Futuro:** projeção até a independência financeira.
- **Patrimônio:** contas, bens e dívidas a partir de snapshots de saldo.
- **Fechamento do mês:** atualização guiada dos saldos.

Especificações de origem:

- [docs/SPEC_DASHPLAN_CLEANROOM.md](docs/SPEC_DASHPLAN_CLEANROOM.md): regras de negócio e matemática.
- [docs/SPEC_ENTRADA_MANUAL.md](docs/SPEC_ENTRADA_MANUAL.md): entrada manual e plano de fases.

## Stack

| Camada | Tecnologia |
|---|---|
| Front | React 19, TypeScript, Vite 8, Tailwind CSS 4, Apache ECharts 6 (importação modular) |
| API | Hono em **Cloudflare Workers com Static Assets**: um deploy só serve o front e `/api/*` |
| Banco | **Cloudflare D1** (SQLite), com migrações em [migrations/](migrations/) |
| Motor | [shared/finance-engine.ts](shared/finance-engine.ts), TypeScript puro usado pelo navegador e pelo worker, testado com Vitest |

Convenções do projeto:

- **Dinheiro:** `INTEGER` em centavos com sinal (`*_centavos`).
- **Datas:** `TEXT` no formato `AAAA-MM-DD`.

## Comandos

```bash
npm install
npm run db:seed:local    # aplica as migrações e carrega o cenário fictício de demonstração
npm run dev              # http://localhost:5173 (front + API + D1 local num só processo)

npm test                 # Vitest: regressão dos cenários A/B/C (§5) + modo corrigido + patrimônio
npm run build            # tsc -b + vite build (client + worker)

npm run db:migrate:local # só aplica as migrações pendentes
npm run db:reset:local   # zera os dados (mantém categorias), para testar o Onboarding
npm run seed:generate    # regenera migrations/seed_demo.sql usando o motor real
```

Para publicar na Cloudflare:

1. Rode `npx wrangler d1 create mydashplan` e copie o `database_id` para o [wrangler.jsonc](wrangler.jsonc).
2. Rode `npx wrangler d1 migrations apply DB --remote`.
3. Rode `npm run deploy`.

> **Atenção:** a API não tem autenticação, porque é um app pessoal. Antes de publicar, proteja a URL. O Cloudflare Access (gratuito) resolve isso.

## Estrutura

```
docs/        especificações (clean-room e entrada manual)
shared/      motor (finance-engine), ponte centavos↔motor (meu-futuro), patrimônio, tipos da API
worker/      Hono: rotas/{perfil,futuro,patrimonio,fechamentos,backup}.ts, repo.ts (D1), validacao.ts (zod)
src/         React: pages/, futuro/ (gráfico, cards, premissas, projetos), components/, lib/
migrations/  0001_init.sql (schema F1+F2+F3 e taxonomia), seed_demo.sql (gerado; não é migração)
scripts/     generate-seed.ts, db-reset-local.mjs, sql/reset_local.sql
```

## Modos do motor

Os dois modos são escolhidos pela opção `modoCompatibilidadeDashplan`.

| | `modoCompatibilidadeDashplan: true` | padrão (corrigido) |
|---|---|---|
| Expectativa de vida | `E_P = 90` (meta) e `E_F = 101` (gráfico), como em Q1 | uma única, configurável (padrão 90) |
| Mês de aposentadoria | diverge entre os motores (Q2) | critério único: o mês em que a idade é atingida |
| Taxa 0% (Q4) | — | segura; `PN_VR = null` (perpetuidade impossível) |
| `P_CP` negativo (Q7) | exibido negativo | piso 0, com o valor bruto preservado |
| "Ajuste da meta" | vale em qualquer mês | ajuste anterior a hoje vale desde o início; ignorado na aposentadoria |
| Independência (L9) | calculada | calculada, com marcador no gráfico |
| Nominal + IPCA (L10) | — | Fisher: `(1 + j_nom)/(1 + π) − 1` |

O modo de compatibilidade só é usado pela suíte de regressão. O app usa o modo corrigido.
