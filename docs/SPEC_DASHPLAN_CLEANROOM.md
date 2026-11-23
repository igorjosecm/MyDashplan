# SPEC_DASHPLAN_CLEANROOM — Especificação técnica *clean-room* do planejador financeiro

> **Escopo e método.** Esta especificação descreve **comportamento, dados e matemática** observados em artefatos locais da aplicação Dashplan, para orientar uma implementação **própria e independente**. Nenhum código-fonte, CSS, texto de interface ou ativo visual proprietário foi copiado: tudo foi convertido em requisitos funcionais, modelos de dados e equações.
>
> - **Fonte única:** `dashplan-limpo.har` (707 requisições, capturado em 19/11/2026). **Nenhuma requisição** foi feita ao servidor do Dashplan.
> - **Ferramenta:** REA (`rea-agents` 6.9.0) via MCP. Etapas: decodificação do HAR (`inspect_web_network_capture`), análise estática do JavaScript extraído (`analyze_javascript_application`) e reconstrução inerte (sem execução) da definição do app Bubble contida nos bundles.
> - **Dados pessoais:** IDs de registros, e-mails, nomes e valores financeiros do usuário **não aparecem** neste documento. O ID da URL de referência é citado como `<ID_CLIENTE_MASCARADO>`. Todos os números da §5 são **sintéticos**.

## Convenções de evidência

| Prefixo | Significado | Rastreabilidade |
|---|---|---|
| `HAR#n` | Entrada `n` do HAR (`/log/entries/n`). | REA Evidence `ev_96763a0d4b184bee39c477328b8ff0bf5d3fb81365f0495532bf891f0ec3398d` (decodificação completa: 707/707 registros, cópia normalizada com SHA-256 `1a9581da…c5a`; o original tem SHA-256 `f3448559…055a`). |
| `APP:<caminho>` | Nó da definição do app Bubble (`window.app`), reconstruída do bundle `dynamic_js` (**HAR#6**). Caminhos usam as chaves internas do Bubble. | Reconstrução feita só com `JSON.parse` dos literais, sem executar código do app. |
| `PLG:<elemento>` | Código do plugin privado **"Serafin Chart E Projeção" v24.1.15** (id `1680791402024x414748390613319700`), presente no bundle `static_js` (**HAR#5**, offsets 5.423.565–5.471.893). | REA Evidence `ev_655bac366f2fb09f1ccc87e1f6f48c481b670932c0e1c1a8c40b6853e008ae9e` (6 fontes JS analisadas, 0 falhas de parse). |
| `OS:<nome>` | *Option Set* do Bubble em `APP:option_sets/<nome>`. | idem `APP`. |
| `DT:<nome>` | *Data Type* do Bubble em `APP:user_types/<nome>`. | idem `APP`. |

Tags de certeza: **[COMPROVADO]**, **[INFERIDO]**, **[OCULTO / SERVER-SIDE]**.

---

## 1. Resumo de Stack e Mapa de Telas (`?menu=...`)

### 1.1 Plataforma e bibliotecas

| Achado | Evidência | Certeza |
|---|---|---|
| A aplicação é **Bubble.io**. O app interno se chama `dashplan2`, versão `live`, e a página é `sa_app`. | URLs `/package/run_css/…/dashplan2/live/sa_app/…` (HAR#2), `/package/static_js/…` (HAR#5) e `/package/dynamic_js/…` (HAR#6); runtime `run.js` (HAR#4); endpoints `/elasticsearch/*`, `/workflow/start` e `/apiservice/doapicallfromserver`. | [COMPROVADO] |
| O formato `<13 dígitos>x<18 dígitos>` é o ID padrão de *Thing* do Bubble (timestamp em ms + aleatório). Na URL de referência, ele identifica o registro exibido pela página (`PageThing`). | `APP:%p3/cnIRP` (página `sa_app`), com condições baseadas em `PageThing` e `URLparam(menu)`. | [COMPROVADO] |
| **ApexCharts** é a biblioteca do gráfico "Meu Futuro". O elemento do plugin cria `new ApexCharts(container, options)`. | `PLG:AAC` (Area Line Chart With Icons); `apexcharts@3.47.0` e `@3.46.0` em HAR#17 e HAR#19. | [COMPROVADO] |
| O plugin **"Apex Chart – 54 Charts & Graphs"** (`1583351916526x278359543482941440`) desenha as barras "Projetos por ano". | `APP:%ed/cnKST/…/cqziM` (tipo `…-ACU` BarChart Multiple Series). | [COMPROVADO] |
| O **Chart.js 2.9.3** (com os plugins datalabels, dragdata, gradient e annotation) também é carregado, mas é usado em outras telas, como Patrimônio. | HAR#11 e HAR#38–#42; gráficos `Chart-Bar/Line/Area` em `APP:%ed/cnMit1`. | [COMPROVADO] |
| Outras bibliotecas carregadas: **math.js** (avalia expressões de taxa), moment / moment-timezone, xlsx, jsPDF/html2pdf (exportação), papaparse, tesseract.js, supabase-js, Stripe v3 e Pluggy Connect v2.3.1 (Open Finance). | HAR#34, #18/#28/#29, #20, #21/#16, #12, #23, #24/#65, #66 e #611. | [COMPROVADO] |
| Plugin "Toolbox" (`Run javascript` / `Javascript to Bubble`): usado para cálculos auxiliares, como o "maior valor de projetos por ano" e a lista de parcelas. | `APP:%ed/cnKST/%wf/crWxk1`, `APP:%ed/cnKUs5/%wf/cndBd5`. | [COMPROVADO] |
| A leitura de dados usa `/elasticsearch/msearch`, `search`, `mget` e `maggregate`. **Os payloads de consulta e de escrita (`/elasticsearch/modify`) chegam cifrados** (campos `x`, `y`, `z`); só as respostas são legíveis. | HAR#106 e HAR#219 (corpo `{x,y,z}`); respostas legíveis em HAR#139, #174 e #440. | [COMPROVADO] |
| Os workflows client-side que precisam de servidor (por exemplo, "Make changes to a thing") são executados via `/workflow/start`. O corpo traz `item_id` (o workflow) e `element_id` (o elemento que disparou). | HAR#147, #175, #259 etc. | [COMPROVADO] |

### 1.2 Mapa de abas (`sa_app?menu=<valor>`)

Cada aba é um *Reusable Element* dentro do grupo "Main Content Group" (`APP:%p3/cnIRP/%el/cnISY`). A visibilidade depende de uma condição `URLparam(menu) == <valor>`.

| `menu=` | Reusable element | Componentes funcionais principais | Evidência | Certeza |
|---|---|---|---|---|
| `home` | `sa_view_home` | Checklist de "Primeiros passos" (etapas com status); componente **Bússola** (índices financeiros por categoria). | `APP:%ed/cnJrE3`; condição em `…/cnJsx4`; HAR#676 e #683–#690. | [COMPROVADO] |
| `lancamento` | `sa_view_lancamentos` | Lista mensal de transações, navegação por mês, totais (Renda, Despesas, Investido), categorização (individual ou em massa), criação manual com opção de parcelamento, tags, lixeira e aviso de token Open Finance. | `APP:%ed/cnKUs5`; HAR#419, #440, #466, #467 e #535–#557. | [COMPROVADO] |
| `meu futuro` | `sa_view_futuro` | **Gráfico de independência financeira**, sliders de premissas, configuração de taxas, mensagem de recomendação, cards "Reserva" e "Independência", Projetos de Vida (CRUD, prioridades, tabela e barras por ano). | `APP:%ed/cnKST`; HAR#0 e HAR#403. | [COMPROVADO] |
| *(vazio)* com `tipoplanejamento = simplificado` | `sa_view_futuro` | "Meu Futuro" é a tela padrão do plano simplificado. | `APP:%p3/cnIRP/%el/cnISY/%el/cnKcB/%s/1`. | [COMPROVADO] |
| `meuplano` | `sa_view_plano` (instância "sa_meu_orcamento") | Orçamento mensal (metas por classificação orçamentária), orçado × realizado, cálculo da reserva de emergência. | `APP:%ed/cnJye4`; HAR#349, #368 e #396–#400. | [COMPROVADO] |
| `meupatrimonio` | `sa_view_patrimonio` | Ativos (bens + investimentos), passivos (dívidas + financiamentos), patrimônio líquido, divisão "gerador de renda × uso pessoal", milhas. | `APP:%ed/cnMit1`; HAR#589 e #599. | [COMPROVADO] |
| `investimento` | `sa_view_ investimento` | Carteira por produto, categoria e classe de ativo; alocação por objetivo (Reserva / Independência / Projetos). | `APP:%ed/cnMcn`; HAR#613, #618 e #622–#639. | [COMPROVADO] |
| `protecao` | `sa_view_protecao` | Seguros (apólices, coberturas), necessidade de cobertura e orçamento de proteção. | `APP:%ed/crZwg`; HAR#641, #650 e #651. | [COMPROVADO] |
| `minhascontas` | `sa_view_contas` | Instituições e contas (Open Finance via Pluggy ou manuais), saldos, cartões com limite e uso. | `APP:%ed/cnQeq3`; HAR#653, #654 e #666. | [COMPROVADO] |
| `atualizar`, `checkout`, `edita`, `senha`, `lancamento_lixeira` | `sa_view_atualizar_contas`, `sa_view_checkout`, `sa_view_editar_cliente`, `sa_view_muda_senha`, `sa_view_lancamento_lixeira` | Telas utilitárias: atualização de conexões, assinatura (Stripe), edição de perfil, senha e lixeira. | Condições em `APP:%p3/cnIRP/%el/cnISY/%el/*`. | [COMPROVADO] |

---

## 2. Modelo de Dados Conceitual

### 2.1 Entidades

Os nomes de entidade e de campo abaixo são **sugestões** para a sua implementação. A coluna "origem" indica o *Data Type* correspondente observado no app.

#### `Cliente` (titular do planejamento)

- **Origem:** `DT:cliente`, com 699 campos, a maioria legada.
- **Campos relevantes:** `data_nascimento` (date). Referências para `bens[]`, `dividas[]` e `usuario`.
- **Evidência:** a projeção lê `cliente.cf_2__data_nascimento_cliente_date` (`APP:%ed/cnKST/…/cnMcL4/%p/AAu`).
- **Certeza:** [COMPROVADO]

#### `InstituicaoFinanceira`

- **Origem:** `DT:entidade_financeira1`.
- **Campos:**
  - `nome`, `apelido`
  - `saldo` (decimal)
  - `saldo_investimentos` (decimal; corresponde a "BalançoTotalDoInvestimento")
  - `inativa`, `desativada_por_inativacao` (bool)
  - `proprietario` (enum Cliente / Cônjuge / Ambos)
  - `conector_open_finance` (FK `OFDataProvider`, que tem `lastupdate`)
- **Evidência:** HAR#150 (chaves dos campos); `DT:entidade_financeira1`.
- **Certeza:** [COMPROVADO]

#### `Conta`

- **Origem:** `DT:contabanc_ria`.
- **Campos:**
  - `nome`, `instituicao` (FK), `saldo`
  - `tipo` (enum: `Bank` = não remunerada, `Savings` = remunerada, `Credit` = cartão, `Ignore`)
  - `subtipo` (`CHECKING`, `SAVINGS` ou `CREDIT_CARD`)
  - `ativa` (bool)
- **Evidência:** HAR#490 e #654; `OS:tipo_de_conta_banc_ria`.
- **Certeza:** [COMPROVADO]

#### `Cartao`

É uma especialização de `Conta` com `tipo = Credit`.

- **Campos:**
  - `limite_credito`, `limite_disponivel`
  - `bandeira`, `nivel`
  - `data_fechamento` (date), `dia_vencimento` (int)
  - `limite_flexivel` (bool)
- **Evidência:** `DT:contabanc_ria`; fórmulas de limite em `APP:%ed/cnQeq3` (ver §3.4).
- **Certeza:** [COMPROVADO]

#### `Transacao`

- **Origem:** `DT:opera__o_de_caixa`.
- **Campos:**
  - `data` (datetime), `mes_index` (0–11)
  - `valor_entrada` (`entrada`), `valor_saida` (`saída`)
  - `descricao`, `descricao_normalizada` (texto em minúsculas, só letras)
  - `categoria` (→ `CategoriaApp`), `tipo` (enum Receita / Despesa / Transferência entre contas / Fatura de cartão)
  - `conta` (FK), `instituicao` (FK), `tags[]`
  - `ignorado` (bool), `para_deletar` (bool, *soft delete*), `validacao_pendente` (bool)
  - `ids_externos` (`BelvoId`, `IdContaOF`)
- **Evidência:** HAR#440 e #467 (chaves); `APP:%ed/cnKUs5/%wf/cnOVM` (criação manual).
- **Certeza:** [COMPROVADO]

#### Parcelamento de transação

**Não existe entidade própria.** Cada parcela é uma `Transacao` cuja descrição termina em `k/N`. As parcelas seguintes são geradas no servidor.

- **Evidência:** `APP:%ed/cnKUs5/%wf/cnOVM` (descrição "… 1/N") e `…/cndBR5` (agenda o backend workflow `cmxqV4` com "Total de parcelas" e "Quantidade de parcelas").
- **Certeza:** [COMPROVADO] na parte do cliente; [OCULTO / SERVER-SIDE] na geração das parcelas.

#### Categorias

A taxonomia tem **dois níveis**:

1. **`CategoriaApp`** (`OS:classifica__o_serafin_app`), com cerca de 50 valores: Casa, Transporte, Alimentação, Saúde, Pagamento de fatura de cartão, Transferência de mesma titularidade etc. Cada valor tem índice, descrição, ícone e uma `classificacao_orcamentaria`.
2. **`ClassificacaoOrcamentaria`** (`OS:classifica__o_or_ament_ria`): Renda, Despesas obrigatórias (`custo_fixo`), Despesas não obrigatórias (`custo_variavel`), Empresa e autônomo, Projetos, Financiamentos, Dívidas, Investimentos e Classificação neutra.

- **Evidência:** `OS:classifica__o_serafin_app`, `OS:classifica__o_or_ament_ria`.
- **Certeza:** [COMPROVADO]

#### `MetaGastoMensal` (orçamento)

- **Origem:** `DT:meta_gasto_mensal`.
- **Campos:** `valor` (meta mensal), `meta_economia`, `categoria` (→ `CategoriaApp`), `licao_de_casa` (bool).
- **Evidência:** HAR#368 e #396–#400.
- **Certeza:** [COMPROVADO]

#### `Bem` (ativo real)

- **Origem:** `DT:bem`.
- **Campos:**
  - `nome`, `valor`
  - `saldo_devedor` (financiamento vinculado)
  - `classe` (Móvel / Imóvel)
  - `categoria` (Residencial, Veraneio, Comercial, Investimentos, Participação em empresa)
  - `vendavel`, `ativo`, `rascunho` (bool)
  - `proprietario`
- **Evidência:** HAR#599; `DT:bem`; `OS:tipo_de_bem` e `OS:tipo_de_bem1`.
- **Certeza:** [COMPROVADO]

#### `Divida`

- **Origem:** `DT:emprestimo`.
- **Campos:** `nome`, `total_tomado`, `saldo_devedor`, `proprietario`, `instituicao`.
- **Evidência:** HAR#599; `DT:emprestimo`.
- **Certeza:** [COMPROVADO]

#### `ProdutoInvestimento`

- **Origem:** `DT:produtos_de_investimento`.
- **Campos:**
  - `nome`, `valor_total`
  - `categoria` (Renda fixa, Renda variável, Fundos, COE, Previdência, Outros)
  - `classe_ativo` (CDB, LCI, IPCA+, Ações, FIIs etc.)
  - `liquidez_resgate`
  - `pct_reserva_emergencia`, `pct_independencia`
  - `objetivos[]` (→ `ObjetivoPorProduto`, com `percentual` e `projeto` opcional)
- **Evidência:** HAR#618 e #622; HAR#113 (`objetivos_produtos_investimentos`).
- **Certeza:** [COMPROVADO]

#### `ProjetoDeVida` (metas e eventos do "Meu Futuro")

- **Origem:** `DT:projeto_de_vida`.
- **Campos:**
  - `nome`, `valor`
  - `data_inicial`, `data_final`, `parcelas` (int)
  - `tipo` (enum `OS:projeto_de_vida___tipos`): Viagem, Família, Veículo, Casa, Hobby, Eletrônico, Educação, Outro, Profissional, Saúde, **Ajuste da meta** e **Aportes financeiros**
  - `prazo` (enum `OS:projeto_de_vida___prazo`): À vista, À prazo, Mês, Trimestre, Semestre, Ano
  - `estagio` (Essencial / Desejo / Sonho)
  - `ativo` (bool), `alocado` (decimal)
  - `repetindo` (bool), `cod_projeto` (texto)
  - `trecho_aereo`, `origem`, `destino` (viagens)
- **Evidência:** HAR#139 e #174 (chaves); `APP:%ed/cnKST/%wf/cqyNp` (criação).
- **Certeza:** [COMPROVADO]

#### `PlanejamentoFinanceiro` (cenário "Meu Futuro", 1 por cliente)

- **Origem:** `DT:proje__o_financeira` (44 campos ativos).
- **Premissas, com o default entre parênteses:**
  - `taxa_real_anual_acumulacao` (0,04)
  - `taxa_real_anual_aposentadoria` (0,035)
  - `idade_aposentadoria` (65)
  - `renda_desejada_aposentadoria` (0)
  - `outras_fontes_renda_projetadas` (0)
  - `meta_aporte_mensal`
  - `patrimonio_sucessao` (0)
  - `aliquota_ir` (0,15)
  - `aliquota_itcmd` (0)
  - `taxa_honorarios` (0,04)
  - `colchao_seguranca`, `colchao_customizado` (false)
- **Resultados gravados de volta:** ver §2.2.
- **Evidência:** `DT:proje__o_financeira` (valores `default_val`).
- **Certeza:** [COMPROVADO]

#### `ConstantesFinanceiras` (globais)

- **Valores:** taxa de juros 2,5; poupança das sobras 0,5; custo anual de inventário 0,12; redução de despesa na morte 0,2.
- **Uso:** não alimentam a aba Meu Futuro. Provavelmente servem à Proteção / Sucessão.
- **Evidência:** `OS:constantes_financeiras`.
- **Certeza:** [COMPROVADO] (valores); [INFERIDO] (uso)

### 2.2 Persistido × calculado em tempo de execução

| Dado | Persistido? | Como é obtido | Evidência | Certeza |
|---|---|---|---|---|
| Premissas do cenário (taxas, idade, renda, outras rendas, meta de aporte) | Sim, em `PlanejamentoFinanceiro`. | Sliders e inputs com *auto-binding* gravam direto no campo. | `APP:%ed/cnKST/…/cnKPI` (`bind_field`); workflows `crXGo1`, `crXGe1`, `cnPUy3`, `cqyCf`, `crSrD`. | [COMPROVADO] |
| Patrimônio investível inicial (`PL`) | Não. | Σ `saldo_investimentos` das instituições ativas do cliente. | `APP:…/cnMcL4/%p/ABM`. | [COMPROVADO] |
| Séries mensais do gráfico | Não. | Calculadas no navegador pelo plugin (`PLG:AAt`). | `PLG:AAt` (estados `arraySaldoReal` …). | [COMPROVADO] |
| `patrimonio_necessario_consumo` (`PN_CP`) | **Sim** (cache). | Calculado no cliente (`PLG:ABR`) e gravado de volta. | `APP:%ed/cnKST/%wf/cnMkk4`, ação 3. | [COMPROVADO] |
| `valor_aposentadoria_real` (= parcela mensal CP) | **Sim** (cache). | idem. | idem, ação 4. | [COMPROVADO] |
| `patrimonio_projetado_aposentadoria` | **Sim** (cache). | `saldoRealAoSeAposentar`. | idem, ação 5. | [COMPROVADO] |
| `saldo_real_longo_prazo` | **Sim**. | Saldo projetado no **72º mês** da série. | idem, ação 6 (`specific_item(72)`). | [COMPROVADO] |
| `acumulado_projetos_longo_prazo` | **Sim**. | Σ dos 72 primeiros meses de saídas para projetos, excluindo aportes. | idem, ação 7. | [COMPROVADO] |
| `acumulo_investimentos_longo_prazo` | **Sim**. | Σ dos 72 primeiros meses de (aporte + rendimento). | idem, ação 8. | [COMPROVADO] |
| A gravação de volta realmente acontece a cada recálculo. | — | Cerca de 30 chamadas `/workflow/start` com `item=cnMkc4` e `element=CálculosProjeção A`. | HAR#175, #211, #221 … #404. | [COMPROVADO] |
| Reserva de emergência (`colchao_seguranca`) | Sim. | 6 × Σ metas de "Despesas obrigatórias", salvo personalização. | `APP:%ed/cnJye4/%wf/cnMIK0`, `cncGB1`, `cncui5`. | [COMPROVADO] |
| Totais das abas Patrimônio e Lançamentos | Não. | Somatórios em tempo de execução (ver §3). | `APP:%ed/cnMit1`, `APP:%ed/cnKUs5`. | [COMPROVADO] |

### 2.3 Relacionamentos

```
Cliente 1─1 PlanejamentoFinanceiro
Cliente 1─N InstituicaoFinanceira 1─N Conta (Conta.tipo=Credit ⇒ Cartão)
Cliente 1─N Transacao N─1 Conta / N─1 InstituicaoFinanceira / N─1 CategoriaApp ─▶ ClassificacaoOrcamentaria
Cliente 1─N MetaGastoMensal N─1 CategoriaApp
Cliente 1─N Bem ; Cliente 1─N Divida
Cliente 1─N ProdutoInvestimento N─1 ContaInvestimento ; ProdutoInvestimento 1─N ObjetivoPorProduto N─1 ProjetoDeVida (opcional)
Cliente 1─N ProjetoDeVida
```

---

## 3. Regras de Negócio e Automações das Telas Gerais

### 3.1 Lançamentos: filtro de período e totais

- **R-L1. Janela mensal.** A tela começa no mês corrente.
  - Início da janela: **último dia do mês anterior às 23:59**, exclusivo na prática.
  - Fim da janela: **último dia do mês selecionado às 23:59**, inclusivo.
  - As buscas também filtram por `mes_index = mês − 1`.
  - Evidência: `APP:%ed/cnKUs5/%wf/cnLeA4`; consultas que usam `m_s_index_number` e `data_date gte/lte`.
  - Certeza: [COMPROVADO]
- **R-L2. Totais do mês.** Todos excluem `ignorado = true` e `para_deletar = true`.
  - **Renda** = Σ `entrada` das transações cuja classificação orçamentária é Renda.
  - **Despesas** = Σ das transações cuja classificação **não** é Renda, Investimentos nem Neutra, e cuja categoria não é "sem classificação".
  - **Investido** = Σ `entrada` das transações com classificação Investimentos.
  - Evidência: `APP:%ed/cnKUs5` (textos com `filtered` por `classificacao_orcamentaria`).
  - Certeza: [COMPROVADO]
- **R-L3. Sem categoria.** A tela conta as transações do período com categoria "sem classificação" e exibe um alerta.
  - Evidência: `APP:%ed/cnKUs5` (texto "N lançamentos sem categoria…").
  - Certeza: [COMPROVADO]
- **R-L4. Categorização em massa.** A opção "Classificar este e os seguintes" aplica a categoria a partir da data da transação. A propagação ocorre **no servidor** (agendamento de API workflow).
  - Evidência: `APP:%ed/cnKUs5`; HAR#535–#557 (`/workflow/start` com o botão "Aplicar todos").
  - Certeza: [COMPROVADO] (gatilho); [OCULTO / SERVER-SIDE] (critério de "seguintes", provavelmente por descrição normalizada ou estabelecimento: `OS:tipos_de_propaga__o` = Estabelecimento / Descrição)

### 3.2 Lançamentos parcelados e recorrentes

- **R-P1. Parcelamento manual.** Com o toggle "Lançamento parcelado" ligado e `N > 1`:
  1. O cliente cria a 1ª transação com a descrição `"<desc> 1/N"`.
  2. Um script Toolbox monta a lista `[1, …, N−1]`.
  3. O app agenda o backend workflow que cria as parcelas `2..N`.
  - O app limita a escolha de parcelas a `OS:parcelamento` (1x–12x).
  - Evidência: `APP:%ed/cnKUs5/%wf/cnOVM` (ações 1–2), `cndBd5` e `cndBR5`.
  - Certeza: [COMPROVADO] (cliente); [OCULTO / SERVER-SIDE] (data e valor de cada parcela)
- **R-P2. Recorrência de Projetos de Vida.** Ao criar um projeto com "repetição", o app agenda um backend workflow com estes parâmetros:
  - `meses` = intervalo (`OS:frequencia_repeticao_projetos`: 1, 3, 6, 12, 24, 36 ou 48 meses)
  - `total` = repetições − 1
  - `data inicial`
  - `codprojeto`, que agrupa as cópias
  - Evidência: `APP:%ed/cnKST/%wf/cqyNp`, ação 4.
  - Certeza: [COMPROVADO] (parâmetros); [OCULTO / SERVER-SIDE] (geração)
- **R-P3. Transações recorrentes (assinaturas, salário).** Não há entidade de recorrência para transações. A recorrência real vem do Open Finance; o orçamento usa `MetaGastoMensal`.
  - Evidência: ausência de campos de recorrência em `DT:opera__o_de_caixa`.
  - Certeza: [INFERIDO]

### 3.3 Transferências e neutralidade

- **R-T1.** "Transferência mesma titularidade" e "Pagamento fatura de cartão" pertencem à classificação orçamentária **Neutra**. Por isso ficam fora de Renda e de Despesas, o que evita dupla contagem: a despesa é registrada no lançamento do cartão, não no pagamento da fatura.
  - Evidência: `OS:classifica__o_serafin_app` (valores `cnOgu` e `cnOgv` → `classifica__o_neutra`); regra R-L2.
  - Certeza: [COMPROVADO]
- **R-T2.** `tipo` aceita "Transferência entre contas" e "Fatura de cartão" além de Receita e Despesa.
  - Evidência: `OS:tipo_de_lan_amento`.
  - Certeza: [COMPROVADO]

### 3.4 Cartões e fechamento de fatura

- **R-C1.** Os indicadores do cartão:
  - Limite total = `limite_disponivel + saldo`
  - Utilização (%) = `round(saldo / (limite_disponivel + saldo) × 100, 1)`
  - Totais da tela = Σ de cada grandeza sobre os cartões
  - Evidência: `APP:%ed/cnQeq3` (textos e barra de progresso).
  - Certeza: [COMPROVADO]
- **R-C2.** Existem os campos `data_fechamento` e `dia_vencimento`. A atribuição de uma transação a uma fatura (competência) não aparece no cliente; os dados vêm do Open Finance.
  - Evidência: `DT:contabanc_ria`.
  - Certeza: [OCULTO / SERVER-SIDE]

### 3.5 Patrimônio

- **R-PA1.** **Ativos** = Σ `Bem.valor` + Σ `InstituicaoFinanceira.saldo_investimentos`, considerando só instituições com `inativa ≠ true` e `desativada_por_inativacao ≠ true`.
  - Evidência: `APP:%ed/cnMit1` ("Input Total Ativos", "Input Balanço total investimentos").
  - Certeza: [COMPROVADO]
- **R-PA2.** **Passivos** = Σ `Divida.saldo_devedor` + Σ `Bem.saldo_devedor` (financiamentos).
  - Evidência: `APP:%ed/cnMit1` ("Input Total Passivos").
  - Certeza: [COMPROVADO]
- **R-PA3.** **Patrimônio líquido** = Ativos − Passivos. A tela também mostra o % comprometido: Passivos ÷ Ativos × 100.
  - Evidência: `APP:%ed/cnMit1` (textos "patrimônio líquido atual" e "% comprometido").
  - Certeza: [COMPROVADO]
- **R-PA4.** **Gerador de renda** = imóveis da categoria "Investimentos" + saldo dos investimentos financeiros. **Uso pessoal** = Ativos − Gerador de renda.
  - Evidência: `APP:%ed/cnMit1` ("Input Total bens geradores de renda", "Input Total Uso Pessoal").
  - Certeza: [COMPROVADO]
- **R-PA5.** **Patrimônio investível**, a entrada do "Meu Futuro", é **somente** Σ `saldo_investimentos` das instituições ativas. Bens, imóveis e dívidas **não entram**.
  - Evidência: `APP:…/cnMcL4/%p/ABM` e `…/cnNPS4/%p/ABU`.
  - Certeza: [COMPROVADO]

### 3.6 Orçamento e reserva de emergência

- **R-O1.** Os totais de orçamento por classificação somam `MetaGastoMensal.valor` filtrado pelas categorias de cada classificação: Renda, Despesas obrigatórias, Despesas não obrigatórias, Financiamentos, Dívidas, Empresa e autônomo, Projetos.
  - Evidência: `APP:%ed/cnKST/%el/crUmh0/%el/crWyB1` (as mesmas fórmulas estão em `cnJye4`).
  - Certeza: [COMPROVADO]
- **R-O2.** **Reserva de emergência** = `6 × Σ metas de Despesas obrigatórias`, recalculada sempre que essa soma muda, a menos que `colchao_customizado = true`.
  - Evidência: `APP:%ed/cnJye4/%wf/cnMIK0` e `cncui5`.
  - Certeza: [COMPROVADO]

---

## 4. Especificação Matemática Completa — Aba "Meu Futuro" (prioridade máxima)

O cálculo roda em **dois motores client-side** do plugin privado, alimentados por expressões Bubble:

- **Motor P (`PLG:ABR`, "Cálculos Patrimônios"):** calcula as metas, ou seja, o patrimônio necessário e a parcela mensal necessária.
- **Motor F (`PLG:AAt`, "Cálculos Projeção"):** gera a série mensal do gráfico.

Ambos são **[COMPROVADO]**. Toda a modelagem é **em termos reais** (taxas "reais", sem inflação explícita).

### 4.1 Variáveis de entrada

| Símbolo | Significado | Origem no app | Default | Evidência | Certeza |
|---|---|---|---|---|---|
| `D_nasc` | Data de nascimento. | `Cliente.data_nascimento`. Pode ser informada no popup "Simulação", que grava em Cliente e em User. | — | `…/cnMcL4/%p/AAu`; `%wf/crSHu`. | [COMPROVADO] |
| `I_apos` | Idade de aposentadoria. | `PF.idade_aposentadoria` (slider e input inteiro). | 65 | `…/cnKPI` (slider A); `DT:proje__o_financeira`. | [COMPROVADO] |
| `R_des` | Renda mensal desejada na aposentadoria, em R$ de hoje. | `PF.renda_desejada_aposentadoria` (slider de 0 a 30.000, passo 10). | 0 | `…/crKcL4` (min 0, max 30000, step 10). | [COMPROVADO] |
| `R_out` | Outras fontes de renda na aposentadoria (INSS, aluguel etc.). | `PF.outras_fontes_renda_projetadas` (slider, passo 10). | 0 | `…/cnMcL4/%p/AAy`. | [COMPROVADO] |
| `A_meta` | Aporte mensal planejado. | `PF.meta_aporte_mensal` (slider e input, botão "Salvar meta"). | — | `…/cnMcL4/%p/ABB`; `%wf/cqyCf`. | [COMPROVADO] |
| `PL` | Patrimônio investível inicial. | Σ `saldo_investimentos` das instituições ativas (R-PA5). | 0 | `…/cnMcL4/%p/ABM`. | [COMPROVADO] |
| `j_acc`, `j_ret` | Taxas **reais** anuais na acumulação e na aposentadoria. | `PF.taxa_real_anual_*`, no popup "Config. da simulação" (formato %; botão "restaurar padrão"). | 0,04 e 0,035 | `APP:%ed/cnKST/%el/cqyCq/custom_states`; `%wf/crSrD` e `crUgc0`. | [COMPROVADO] |
| `S` | Patrimônio de sucessão: valor a deixar no fim da vida. | `PF.patrimonio_sucessao`. | 0 | `…/cnNPS4/%p/ABZ`. | [COMPROVADO] |
| `E_F` | Expectativa de vida do **Motor F**: define o horizonte do gráfico. | **Constante 101.** | 101 | `…/cnMcL4/%p/AAw`. | [COMPROVADO] |
| `E_P` | Expectativa de vida do **Motor P**: define a duração da renda. | **Constante 90.** | 90 | `…/cnNPS4/%p/ABT`. | [COMPROVADO] |
| `A_rec` | "Aporte recomendado" (série não plotada). | **Constante 5000.** | 5000 | `…/cnMcL4/%p/ABC`. | [COMPROVADO] |
| Projetos | Lista de `ProjetoDeVida` ativos com datas inicial e final preenchidas: `(data_ini, data_fim, valor, tipo)`. | Repeating group de projetos do cliente. | — | `…/cnNPc4/%ds` (filtros: cliente, `ativo = true`, datas preenchidas). | [COMPROVADO] |
| Inflação | **Não existe** como entrada; o modelo trabalha em termos reais. | — | — | Nenhum campo ou binding de inflação no fluxo. | [COMPROVADO] (ausência no cliente) |
| Taxa de retirada segura | **Não existe** como entrada. Está implícita na perpetuidade de 4.4 (ver nota). | — | — | — | [INFERIDO] |
| IR, ITCMD e honorários | Existem campos em `PF`, mas **não alimentam** o Meu Futuro. | `PF.aliquota_ir` (0,15) etc. | — | Bindings de `cnMcL4` e `cnNPS4` sem esses campos. | [COMPROVADO] (não usado aqui) |

### 4.2 Conversão de taxa: anual real → mensal

Conversão **composta (equivalência de taxas)**, feita pelo elemento math.js:

```
i_acc = (1 + j_acc)^(1/12) − 1
i_ret = (1 + j_ret)^(1/12) − 1
```

- **Evidência:** `APP:%ed/cnKST/%el/crUff0/%el/crVkl1` e `crUfI0` (expressões math.js); plugin `PLG(Math.js)`.
- **Certeza:** [COMPROVADO]
- **Fisher:** não há conversão nominal → real no app, porque a entrada já é real. Se quiser aceitar taxas nominais, use Fisher: `j_real = (1 + j_nom)/(1 + π) − 1`. **Não** use subtração simples. [INFERIDO] (recomendação)

### 4.3 Calendário e idade

- **Idade num mês `(a, m)`:** anos completos entre `D_nasc − 1 min` e o **dia 1º** desse mês. Na prática, quem nasce no dia 1 já "faz anos" no próprio mês; os demais fazem no mês seguinte ao aniversário.
  - Evidência: `PLG:AAt` e `PLG:ABR` (função de idade por ano e mês).
  - Certeza: [COMPROVADO]
- **Diferença em meses:** `Δm(d1, d2) = 12·(ano2 − ano1) + (mês2 − mês1)`, ignorando os dias e com piso 0.
  - Evidência: `PLG:ABR` (função de diferença de meses).
  - Certeza: [COMPROVADO]
- **Periodicidade:** **mensal**, com pagamentos **no fim do período** (anuidade postecipada, `tipo = 0`).
  - Evidência: `PLG:ABR` (PMT/PV com `tipo = 0`); `PLG:AAt` (rendimento sobre o saldo anterior + aporte do mês).
  - Certeza: [COMPROVADO]

### 4.4 Motor P: patrimônio necessário e parcela mensal

Seja `hoje` a data corrente e `G = R_des − R_out` a necessidade líquida mensal.

1. `data_apos = D_nasc + I_apos anos`; `data_vida = D_nasc + E_P anos`.
2. Se `data_apos < hoje`, o cliente já está aposentado (`ja_aposentado = true`) e `data_apos := hoje`.
3. `n_acc = Δm(hoje, data_apos) + 1`, o número de meses de acumulação.
4. `n_ret = Δm(data_apos, data_vida)`, somando +1 se `ja_aposentado`.
5. **Patrimônio necessário "viver de renda"** (perpetuidade):
   `PN_VR = G / i_ret`
6. **Patrimônio necessário "consumo do patrimônio"** (anuidade de `n_ret` meses mais o valor presente da sucessão):
   `PN_CP = G·[1 − (1 + i_ret)^(−n_ret)]/i_ret + S·(1 + i_ret)^(−n_ret)`
7. **Parcela mensal necessária** para ir de `PL` a `PN` em `n_acc` meses (equivale a `−PMT(i_acc, n_acc, −PL, PN)` do Excel):
   `g = (1 + i_acc)^n_acc`
   `P_X = i_acc·(PN_X − PL·g)/(g − 1)` para `X ∈ {VR, CP}`; com `i_acc = 0`, `P_X = (PN_X − PL)/n_acc`.
8. Se `ja_aposentado`, então `P_VR = P_CP = 0`.

**Saídas:** `PN_VR`, `P_VR`, `PN_CP`, `P_CP`. Só os valores **CP** são exibidos e gravados.

- **Evidência:** `PLG:ABR` (estados `patrimônioNecessárioAposentadoriaViverDeRenda`, `parcelaMensalViverDeRenda`, `patrimônioNecessárioAposentadoriaConsumoPatrimônio`, `parcelaMensalConsumoPatrimônio`).
- **Certeza:** [COMPROVADO]
- **Nota:** `PN_VR` equivale a uma taxa de retirada de `12·i_ret` ao ano (≈ 3,44% a.a. com `j_ret = 3,5%`). [INFERIDO]

### 4.5 Motor F: projeção mensal (séries do gráfico)

Na implementação observada a constante se chama "anosAtéAposentadoria", mas o valor é `E_F − idade_atual`. Ela define `N_anos = E_F − idade(hoje)`.

A série percorre `N_anos` anos-calendário. O primeiro ano começa **no mês corrente** e os demais vão de janeiro a dezembro. Total de meses:

`T = (13 − mês_atual) + 12·(N_anos − 1)`

**Estado inicial**, antes do 1º mês e não plotado:

- `saldo₀ = principal₀ = recomendado₀ = PL`
- `aporte₀ = A_meta`. Se o cliente já estiver aposentado: `A_apos = R_out − R_des`.
- `consumo₀ = PL`. Se já estiver aposentado: `PN_CP`.

**Para cada mês `t = 1..T`** (o 1º é o mês corrente):

| Passo | Fórmula |
|---|---|
| Aposentado? | `apos_t = idade_t ≥ I_apos`; `virou_t = apos_t ∧ ¬apos_{t−1}` |
| Taxa | `i_t = apos_t ? i_ret : i_acc` |
| Aporte | `aporte_t = virou_t ? A_apos : aporte_{t−1}`, com `A_apos = R_out − R_des` (negativo = **saque**). Se existir um projeto do tipo **"Ajuste da meta"** iniciando em `(a, m)`, então `aporte_t = valor` desse projeto. **O novo valor persiste nos meses seguintes**, porque é herdado. |
| Fluxo de projetos | `FP_t = Σ_p v_p / max(1, n_p)` para os projetos `p` cujo mês está em `[mês(data_ini), mês(data_ini) + n_p − 1]` (ver 4.6). Para "Aportes financeiros", `v_p = −valor`, ou seja, uma entrada. "Ajuste da meta" fica de fora. |
| Fluxo sem aportes | `FPs_t`: igual a `FP_t`, mas excluindo "Aportes financeiros". |
| Rendimento | `ret_t = saldo_{t−1} · i_t` |
| **Patrimônio total projetado** | `saldo_t = saldo_{t−1} + ret_t − FP_t + aporte_t`. **Sem piso:** pode ficar negativo. |
| **Principal investido** | `principal_t = max(0, principal_{t−1} − FP_t + aporte_t)`. Não tem rendimento. |
| Acumulado no mês | `acum_t = aporte_t + ret_t` |
| Recomendado (não plotado) | `recomendado_t = recomendado_{t−1}·(1 + i_t) + (apos_t ? A_apos : A_rec)` |
| **Aposentadoria ideal** | `consumo_t = consumo_{t−1}·(1 + i_t) + (apos_t ? A_apos : P_CP)`. Ignora projetos. |
| Marco | `saldo_ao_aposentar = saldo_t` no mês em que `virou_t`. |

- **Arredondamento:** cada série publicada é arredondada em **2 casas** (`round(100·x)/100`). Os cálculos internos usam ponto flutuante sem arredondar. Os cards exibem BRL com 2 casas, separador de milhar "." e decimal ",".
- **Evidência:** `PLG:AAt` (estados `arraySaldoReal`, `arrayPrincipalInvestido`, `arrayConsumoPatrimônio`, `arrayAcumuladoRecomendado`, `arrayAcumuladoNoMês`, `saldoProjetos`, `saldoProjetosSemAporteFinanceiro`, `saldoRealAoSeAposentar` e `menorValorParaGráfico`).
- **Certeza:** [COMPROVADO]

### 4.6 Distribuição temporal dos projetos

Ao criar ou editar um projeto: `data_fim = data_ini + n_parcelas meses`. Para "À vista": `data_fim = data_ini` e `n_parcelas = 0`.

- Evidência: `APP:%ed/cnKST/%wf/cqyNp` (NewThing) e `cqyWc` (ChangeThing, ação 1).
- Certeza: [COMPROVADO]

No Motor F, `n_p = diferença fracionária em meses (data_fim − data_ini)`, com `n_p = 1` quando é 0. Um mês está "dentro" do projeto quando o **dia 5** desse mês fica estritamente entre o dia 1º do mês inicial e o dia **2** do mês final (ou o dia **20**, se `n_p < 1`). O efeito:

- **À vista:** 100% do valor sai no mês de `data_ini`.
- **À prazo em N parcelas:** `valor/N` por mês, durante N meses, começando no mês de `data_ini`.
- **Evidência:** `PLG:AAt` (funções de saldo de projetos e de pertinência ao intervalo).
- **Certeza:** [COMPROVADO]
- **Recomendação:** na sua versão, use diretamente "N meses a partir de `data_ini`" e evite a lógica de dias 2/5/20. [INFERIDO]

### 4.7 Séries plotadas no gráfico de independência financeira

O gráfico é de área do ApexCharts. As séries são adicionadas por workflow quando o motor publica `dados_atualizados`.

| # | Nome da série | Dados | Tipo | Evidência | Certeza |
|---|---|---|---|---|---|
| 1 | "Patrimônio total projetado" | `saldo_t` | Área com gradiente vertical (opacidade 0,5) | `APP:%ed/cnKST/%wf/cnMkk4`, ação 0 (`AAQ = arraySaldoReal`). | [COMPROVADO] |
| 2 | "Patrimônio principal investido" | `principal_t` | Área com gradiente (opacidade 0,6) | idem, ação 1 (`arrayPrincipalInvestido`). | [COMPROVADO] |
| 3 | "Aposentadoria ideal" | `consumo_t` | **Linha** com espessura 2 | idem, ação 2 (`arrayConsumoPatrimônio`). | [COMPROVADO] |

**Eixos e interação:**

- **Eixo X:** numérico, índice do mês, com cerca de 10 ticks. O rótulo do tick é a **idade** (`legenda = idade_t`).
- **Tooltip:** título "`Mmm/AAAA: N anos`" e valores em BRL.
- **Eixo Y:** formato BRL (pt-BR), sem rótulos visíveis.
- **Piso do eixo Y:** `y_min = 0` por padrão. Com o toggle "mostrar valores negativos" ligado, `y_min` é o menor valor entre as três séries dentro da janela de zoom.
  - Evidência: `PLG:AAC`; `APP:%ed/cnKST/%wf/crXKr0` e `crXJR0`.
  - Certeza: [COMPROVADO]
- **Marcadores (annotations):** ícones posicionados em `(x = mês, y = saldo_t)`:
  - no mês da aposentadoria;
  - no mês de início de cada projeto, com o ícone do tipo de projeto.
  - Vários marcadores no mesmo mês são empilhados verticalmente (`yIndex`). Tamanho: 32 px.
  - Evidência: `PLG:AAt` (anotações); `%wf/crChc1`.
  - Certeza: [COMPROVADO]
- **Zoom:** botões "2 anos", "5 anos", "10 anos" e "Máximo" aplicam `zoomX(0, k)` com `k = 24, 60, 120` ou `T`.
  - Evidência: `APP:%ed/cnKST/%wf/cnLSN` (24), `cnLRw` (60), `cnLSR` (120), `cnVsm2` (T).
  - Certeza: [COMPROVADO]
- **Legenda:** embaixo, centralizada. As cores seguem a identidade visual da empresa (white-label: cor primária configurável por `Empresa`).
  - Evidência: `crDIE2` (`defaultOptions`); condições `corprimaria_text`.
  - Certeza: [COMPROVADO]

### 4.8 Cards e indicadores da tela

| Indicador | Definição | Evidência | Certeza |
|---|---|---|---|
| Mensagem de recomendação | Se `P_CP ≠ 0`: "investir `P_CP`/mês para atingir `PN_CP`". Se `P_CP = 0` e `PN_CP ≠ 0`: "ter `PN_CP` acumulados". | `APP:…/cqxiu2` (condições sobre os estados `ABe` e `ABd`). | [COMPROVADO] |
| Card "Independência" | `PN_CP`; mostra R$ 0,00 quando < 1. | `APP:…/cqzck`. | [COMPROVADO] |
| Card "Reserva" | `PF.colchao_seguranca` (R-O2); oferece "criar reserva" quando < 1. | `APP:…/crVkT1`, `crVkZ1`. | [COMPROVADO] |
| Barras "Projetos 1 a 5 anos" | Σ `valor` dos projetos ativos (exceto Aportes financeiros e Aumento de renda) com `data_ini` em `[hoje + (k−1) anos, hoje + k anos]`, para `k = 1..4`; para "5 anos", `data_ini ≥ hoje + 5 anos`. A escala usa o maior valor entre os 5 anos. | `APP:%ed/cnKST/%el/crUmh0/%el/crWzU1/*` e `%wf/crWxk1`. | [COMPROVADO] |
| Valores gravados (72 meses) | `saldo_72`, Σ₁..₇₂ `FPs_t` e Σ₁..₇₂ `acum_t` (ver §2.2). | `%wf/cnMkk4`, ações 6–8. | [COMPROVADO] |
| Idade ou mês de independência financeira | **Não é exibido** pelo app. | — | [COMPROVADO] (ausência); a definição para a sua versão está em §6. |

### 4.9 Ordem de execução e reatividade

1. Ao abrir a aba, o `PlanejamentoFinanceiro` é carregado e as taxas personalizadas (> 0) substituem os defaults.
   - Evidência: `%wf/crUgc0`, `cqzDv`.
2. Os elementos math.js atualizam `i_acc` e `i_ret`.
3. O Motor P recalcula sempre que um binding muda.
4. O Motor F recalcula e dispara `dados_atualizados`. O workflow `cnMkk4` então:
   - (re)cria as 3 séries;
   - grava os caches em `PF` via `/workflow/start` (HAR#175 em diante);
   - atualiza o piso do eixo Y;
   - dispara a atualização das anotações (`crChc1`).
5. Cada movimento de slider grava no `PF`, o que reinicia o ciclo. No HAR, os sliders geraram cerca de 30 ciclos (HAR#175–#344).

Certeza: [COMPROVADO]

### 4.10 Peculiaridades observadas (para **não** replicar sem querer)

| # | Peculiaridade | Evidência | Certeza |
|---|---|---|---|
| Q1 | **Horizontes inconsistentes:** o Motor P dimensiona a renda até **90** anos, mas o gráfico vai até **100** (loop até 101). A linha "Aposentadoria ideal" chega a ≈ `S` aos 90 e **fica negativa** até os 100. | `cnMcL4/AAw = 101` × `cnNPS4/ABT = 90`. | [COMPROVADO] |
| Q2 | **Mês de aposentadoria diferente** entre os motores: o Motor P usa o mês do aniversário; o Motor F usa o mês seguinte, quando o aniversário não cai no dia 1. | Funções de idade e data em `PLG:ABR` e `PLG:AAt`. | [COMPROVADO] |
| Q3 | O Motor P calcula `idade_atual` em janeiro; o Motor F, no mês corrente. A variável do Motor P não afeta as saídas. | idem. | [COMPROVADO] |
| Q4 | Com taxa 0%, o math.js retorna 0 e o elemento **não publica** o resultado (é tratado como falso), então mantém a taxa anterior. | `PLG(Math.js)` (publica apenas se o resultado for verdadeiro). | [COMPROVADO] |
| Q5 | `A_rec = 5000` está fixo no código e a série "recomendado" não é plotada. | `cnMcL4/ABC`. | [COMPROVADO] |
| Q6 | O popup "Simulação" grava a idade e a renda desejada em campos que dependem de inputs com nomes repetidos ("Input GZ"), e grava `outras_fontes_renda`, **não** a versão `_projetadas` que o motor usa. | `%wf/crSHu`, ação 2. | [COMPROVADO]; o efeito real é [INFERIDO] |
| Q7 | `P_CP` pode sair **negativo** quando `PL·g > PN_CP`. A mensagem então exibiria um valor negativo, porque não há tratamento. | Fórmula 4.4. | [INFERIDO] |

---

## 5. Tabela de Validação Numérica (3 cenários de teste)

Os números abaixo vêm de uma **implementação clean-room independente** das equações da §4. Use-os como testes de aceitação da sua versão.

**Premissas comuns, fixas para reprodutibilidade:**

- `hoje = 11/2026`, `D_nasc = 15/06/1991` (35 anos), `I_apos = 65`, `E_F = 101`, `E_P = 90`, `S = 0`, `A_rec = 5000`.
- Projetos ativos com datas preenchidas.
- Primeiro mês projetado: 11/2026; último: 12/2091 (idade 100); **T = 782 meses**.
- `n_acc = 356`, `n_ret = 300`.
- "Mês k" é o k-ésimo mês da série; o mês 1 é 11/2026.
- Os valores estão em R$ reais (de hoje), com 2 casas.

### Entradas

| Entrada | A — Conservador | B — Moderado | C — Moderado + eventos |
|---|---|---|---|
| `j_acc` / `j_ret` (real a.a.) | 3,0% / 2,5% | 4,0% / 3,5% (defaults) | 4,0% / 3,5% |
| `i_acc` / `i_ret` (a.m.) | 0,246627% / 0,205984% | 0,327374% / 0,287090% | idem B |
| `PL` | 50.000,00 | 100.000,00 | 100.000,00 |
| `A_meta` (mensal) | 2.000,00 | 3.000,00 | 3.000,00 → **4.000,00 a partir de 01/2036** ("Ajuste da meta") |
| `R_des` / `R_out` | 8.000,00 / 2.000,00 | 10.000,00 / 2.500,00 | 10.000,00 / 2.500,00 |
| Eventos | — | — | ① Veículo **à vista** 80.000 em 03/2030 · ② Casa **24x** total 120.000 a partir de 01/2032 (5.000/mês) · ③ **Aporte financeiro** à vista 50.000 em 01/2035 · ④ Ajuste da meta 4.000 em 01/2036 |

### Resultados esperados

| Resultado | A — Conservador | B — Moderado | C — Moderado + eventos |
|---|---|---|---|
| `PN_VR` (viver de renda) | 2.912.852,87 | 2.612.422,36 | 2.612.422,36 |
| **`PN_CP` (card "Independência")** | **1.341.687,45** | **1.506.983,70** | **1.506.983,70** |
| `P_VR` | 4.907,50 | 3.409,11 | 3.409,11 |
| **`P_CP` (mensagem "investir X/mês")** | **2.146,53** | **1.765,10** | **1.765,10** |
| Marco 1 — `saldo` no mês 12 (10/2027) | 75.828,24 | 140.655,33 | 140.655,33 |
| Marco 2 — `saldo` no mês 60 (10/2031) | 187.125,63 | 320.202,36 | 235.076,91 |
| Marco 3 — `saldo` no mês 120 (10/2036) | 346.091,81 | 588.112,20 | 408.968,74 |
| `principal` no mês 120 | 290.000,00 | 460.000,00 | 320.000,00 |
| `saldo_72` (gravado em `PF`) | 217.067,64 | 369.665,78 | 230.392,25 |
| Σ₇₂ projetos sem aportes (gravado) | 0,00 | 0,00 | 130.000,00 |
| Σ₇₂ acumulado aporte + rendimento (gravado) | 167.067,64 | 269.665,78 | 260.392,25 |
| **`saldo_ao_aposentar`** (07/2056) | **1.254.892,22** | **2.336.544,71** | **2.304.173,46** |
| `saldo` aos 90 anos (06/2082 — 1º mês de junho com idade 90 pela regra do dia 1º) | −231.281,26 | 1.939.568,76 | 1.860.616,70 |
| **Patrimônio final** (`saldo`, 12/2091) | **−1.062.519,24** | **1.679.481,96** | **1.570.011,53** |
| `consumo` final ("Aposentadoria ideal", 12/2091) | −862.166,07 | −1.136.591,66 | −1.136.591,66 |
| **Mês de independência financeira** (1º mês com `saldo ≥ PN_CP`; métrica proposta) | **não atinge** | **12/2048 (57 anos)** | **12/2049 (58 anos)** |
| 1º mês com `saldo ≥ PN_VR` | não atinge | não atinge | não atinge |
| Patrimônio zera na aposentadoria | **05/2079 (87 anos)** | não zera | não zera |

**Leituras de controle:**

- **A:** o aporte de 2.000 fica abaixo de `P_CP` (2.146,53), por isso o patrimônio se esgota antes dos 90.
- **C:** os eventos ①② retiram 130.000 dentro da janela de 72 meses (80.000 + 10 × 5.000) e atrasam a independência em 12 meses. O aporte ③ e o ajuste ④ compensam parcialmente.
- **`n_acc` de 356 meses:** a aposentadoria é em 06/2056 no Motor P e em 07/2056 no Motor F (peculiaridade Q2).
- **Certeza da tabela:** [INFERIDO]. As equações são [COMPROVADO]; os números foram recalculados de forma independente, não capturados do app.

---

## 6. Matriz de Evidências e Lacunas (`[OCULTO / SERVER-SIDE]`)

| # | Lacuna | Por que não é comprovável no cliente | Evidência do limite | Premissa recomendada para a sua versão |
|---|---|---|---|---|
| L1 | Geração das parcelas 2..N de lançamentos parcelados (datas e valores). | Feita por backend workflow agendado (`cmxqV4`). | `APP:%ed/cnKUs5/%wf/cndBR5`. | Criar N transações em `data + (k−1) meses`, `valor_total/N` cada, com o centavo residual na última; descrição `k/N` e um `grupo_parcelamento_id` comum. |
| L2 | Repetição de Projetos de Vida. | Backend workflow `crAXj`. | `APP:%ed/cnKST/%wf/cqyNp`, ação 4. | Gerar `total` cópias com `data_ini + k·meses`; mesmo `cod_projeto`; editar ou excluir "somente este" ou "todos" (a UI tem as duas opções: `Popup Excluir Projeto`). |
| L3 | Critério de "Classificar este e os seguintes". | Propagação no servidor. | HAR#542–#557 (`/workflow/start`, "Aplicar todos"). | Aplicar a categoria às transações futuras do mesmo cliente com a mesma `descricao_normalizada` **ou** o mesmo estabelecimento, conforme a escolha do usuário (`OS:tipos_de_propaga__o`). |
| L4 | Fechamento de fatura (competência das compras). | Os dados vêm do Open Finance (Pluggy/Belvo); não há lógica no cliente. | `DT:contabanc_ria` (campos sem fórmula). | Competência = fatura cujo intervalo `(fechamento_anterior, fechamento]` contém a data da compra; vencimento = `dia_vencimento` do mês seguinte ao fechamento; pagamento de fatura = transação Neutra. |
| L5 | Consultas e filtros do lado do servidor (`/elasticsearch/*`) e regras de privacidade. | Requisições cifradas (`x/y/z`); privacy rules não aparecem no cliente. | HAR#106, #107, #219. | Restringir toda consulta a `cliente_id` do usuário autenticado (RLS ou policy) e excluir soft-deletes e ignorados no repositório. |
| L6 | Integrações via API Connector (`appconnector`: `dALRu`, `dAGqs`, `dALHC`, `cwhJF`, `dAIGS`) e Stripe. | Executadas pelo servidor do Bubble; só nomes e chaves aparecem. | HAR#134–#137, #142, #153, #160–#165, #210, #213–#214. | Fora do escopo do cálculo; tratar como integrações (assinatura, Open Finance, notificações). |
| L7 | Sincronização Open Finance (saldos, `saldo_investimentos`, transações). | Backend (`cngPa3`) e Pluggy. | `APP:%ed/cnKUs5/%wf/cnLeA4`, ação 3; HAR#611. | Importar diariamente; `saldo_investimentos` = Σ posições da instituição; marcar a data da atualização. |
| L8 | Cálculo da **Bússola** (índices da Home). | Workflows server-side disparados por condição. | HAR#683–#690. | Fora do escopo do Meu Futuro; especificar à parte se necessário. |
| L9 | Mês/idade de independência financeira. | O app **não calcula** esse indicador. | §4.8. | Definir `IF = 1º mês com saldo_t ≥ PN_CP` (também oferecer o critério `PN_VR`); exibir como card e como marcador no gráfico. |
| L10 | Inflação, impostos e taxas na projeção. | Não existem no fluxo (modelo real). | §4.1. | Manter o modelo real por padrão. Opcional: entrada nominal + IPCA com Fisher; IR sobre o rendimento na fase de saque, `ret_t·(1 − IR)` ou come-cotas, como opção explícita. |
| L11 | Horizonte de vida (Q1) e mês de aposentadoria (Q2). | É inconsistência do app, não lacuna de dados. | §4.10. | Usar **uma única** `E` (configurável, default 90 ou 95) nos dois motores e **um único** critério de mês de aposentadoria (mês em que a idade é atingida). |
| L12 | Tipo de projeto "Aumento de renda" (`aumento_de_renda`). | Aparece em filtros, mas não está mais no option set (foi removido). | `…/crWzU1` (filtros) × `OS:projeto_de_vida___tipos`. | Se for implementar: um evento que soma `valor` a `R_out` a partir de uma data. |
| L13 | Periodicidade "Mês/Trimestre/Semestre/Ano" para "Aportes financeiros". | O valor de `prazo` não é lido pelo Motor F; a recorrência provavelmente vem de L2. | `PLG:AAt` (só usa as datas) × `OS:projeto_de_vida___prazo`. | Modelar aporte recorrente como série de eventos (L2) ou como `Ajuste da meta` temporário. |
| L14 | Uso das `ConstantesFinanceiras` e das alíquotas IR/ITCMD/honorários. | Não fazem parte do Meu Futuro; provavelmente servem à aba Proteção / Sucessão (que tem workflows server-side). | `OS:constantes_financeiras`; HAR#650–#651. | Especificar junto com o módulo de Proteção. |

### Rastreabilidade e reprodutibilidade

- **Evidence REA:**
  - HAR: `ev_96763a0d4b184bee39c477328b8ff0bf5d3fb81365f0495532bf891f0ec3398d` (`inspect_web_network_capture`, 707 registros).
  - Plugin JS: `ev_655bac366f2fb09f1ccc87e1f6f48c481b670932c0e1c1a8c40b6853e008ae9e` (`analyze_javascript_application`).
- **Os IDs são derivados do conteúdo.** Rodar de novo sobre os mesmos bytes reproduz o mesmo ID.
- **Normalização do HAR:** a única alteração foi remover 8 campos `serverIPAddress` vazios, que o schema HAR 1.2 rejeita. O conteúdo das requisições não foi alterado.
- **Limites desta análise:**
  - É estática e passiva. Nenhum código do app foi executado e nenhuma URL do HAR foi acessada.
  - As consultas cifradas e os workflows de backend continuam desconhecidos (§6).
