# SPEC_ENTRADA_MANUAL — Entrada de dados sem Open Finance

> Complemento do [SPEC_DASHPLAN_CLEANROOM.md](SPEC_DASHPLAN_CLEANROOM.md).
> Aqui, "§x.y" aponta para uma seção daquele documento, e "R-xx" para uma regra de negócio dele.
> Todo o conteúdo abaixo é **[PROPOSTA]**: é design original, não comportamento observado no Dashplan.

---

## 0. Premissas

| # | Premissa | Consequência |
|---|---|---|
| P1 | O app é pessoal e gratuito, sem agregador pago (Pluggy, Belvo etc.). | Toda informação nasce de digitação, de arquivo exportado pelo banco ou de um snapshot de saldo. |
| P2 | Há um único usuário, com o campo `proprietario` (Eu / Cônjuge / Ambos) mantido como na §2.1. | Não há login multiusuário nem permissões. |
| P3 | O app é *local-first*: os dados ficam no dispositivo e o backup é explícito. | Não precisa de backend. Sincronização fica opcional, para depois. |
| P4 | O motor do Meu Futuro (§4) não muda. | A entrada manual só precisa alimentar as variáveis da §4.1. |

### A ideia central: o Meu Futuro precisa de pouco dado

Pela §4.1 e pela R-PA5, o motor só precisa de:

- data de nascimento;
- as premissas de `PlanejamentoFinanceiro`;
- os `ProjetoDeVida`;
- o **PL**, que é a Σ dos saldos de investimento.

Nenhuma transação individual entra no cálculo. Por isso o design separa a entrada de dados em **níveis de esforço**. O usuário ganha valor já no nível 0 e só sobe de nível se quiser:

| Nível | Esforço | O que o usuário informa | O que o app passa a oferecer |
|---|---|---|---|
| **0. Plano** | 5 min, uma vez | Nascimento, idade de aposentadoria, renda desejada, outras rendas, PL total (um número só), meta de aporte | Meu Futuro completo: gráfico, PN, parcela, IF (§4) |
| **1. Fechamento mensal** | 5–10 min/mês | O saldo de cada conta e investimento, a fatura do cartão e os saldos devedores | Patrimônio (R-PA1…5), evolução mês a mês, **aporte real × meta**, PL sempre atualizado |
| **2. Lançamentos** | Contínuo, opcional | Transações (rápidas, recorrentes ou importadas) | Lançamentos, orçamento e reserva (R-L1…4, R-O1…2) e categorias |

O nível 2 pode ficar restrito a algumas contas. Cada conta tem um `modo_controle`: `detalhado` (com transações) ou `so_saldo` (só snapshots). O caso típico é a conta corrente e o cartão em modo detalhado, e os investimentos só por saldo.

---

## 1. Arquitetura de entrada: uma caixa de entrada única

Todas as fontes de dados passam pelo mesmo pipeline. Assim, a deduplicação, a categorização e a revisão acontecem uma vez só, qualquer que seja a origem.

```
 Fontes                     Pipeline                                   Destino
 ───────────────            ─────────────────────────────────          ───────────────
 Quick-add manual ─┐
 Recorrência ──────┤        1. normalizar (valor em centavos com sinal,
 Import OFX ───────┼──▶        data, descrição_normalizada)
 Import CSV ───────┤        2. deduplicar / conciliar  ─────────────▶  Transacao
 Colar/compartilhar┤        3. categorizar (regras → histórico)         (status, origem)
 (futuro) Pluggy ──┘        4. detectar transferência própria
                            5. revisão: automática para o manual,
                               tela "Revisar" para os lotes
```

- O **quick-add** e a **confirmação de previsto** passam pelos passos 1–4 sem tela de revisão, porque o próprio usuário já revisou.
- **Importações** e **texto colado** sempre param na tela **Revisar** (§5.3).
- Uma fonte nova (por exemplo, um adaptador Open Finance no futuro, §9) só precisa produzir candidatos no formato normalizado.

---

## 2. Onboarding (nível 0)

Um wizard de 5 telas, com um campo por tela e um botão "pular" em todas. Os defaults vêm da §2.1.

1. **Data de nascimento.**
2. **Com que idade quer se aposentar?** Slider, com default 65.
3. **Quanto quer ganhar por mês aposentado, em valores de hoje?** Logo abaixo vem a pergunta "Terá outras rendas, como INSS ou aluguel?". A tela explica, em uma linha, o que significa "valores de hoje" (o modelo é em termos reais, §4).
4. **Quanto você tem investido hoje?**
   - Opção A: um número total, que vira um snapshot de uma conta "Investimentos (geral)".
   - Opção B: "quero detalhar". Abre uma lista rápida de instituições, com nome e saldo.
5. **Quanto consegue investir por mês?** Vira `meta_aporte_mensal`.

O fim do wizard abre direto no **Meu Futuro**, já com o gráfico. As taxas (4% e 3,5% reais) ficam com o default e só aparecem em "Premissas avançadas".

**Regra ONB-1.** O app aceita PL informado manualmente enquanto não houver conta cadastrada. Quando a primeira conta de investimento recebe snapshot, ele pergunta: "Substituir o valor informado pela soma das contas?".

---

## 3. Contas, cartões e saldos

### 3.1 Cadastro de conta (mínimo de campos)

| Campo | Obrigatório | Observação |
|---|---|---|
| `nome` | sim | Sugestões a partir de uma lista de bancos brasileiros, com ícone genérico |
| `tipo` | sim | Corrente, Poupança/remunerada, Investimento, Cartão de crédito, Dinheiro, Outro (mapeia para `Bank`/`Savings`/`Credit` da §2.1) |
| `modo_controle` | sim | `detalhado` (default para corrente e cartão) ou `so_saldo` (default para investimento) |
| `saldo_inicial` + `data_ancora` | sim | "Qual o saldo hoje?" Sempre se pede o saldo de hoje; nunca se pede um saldo histórico |
| `conta_no_pl` | sim | Default é *sim* para Investimento e Poupança, *não* para Corrente. Implementa a R-PA5 de forma explícita e editável |
| `dia_fechamento`, `dia_vencimento`, `limite` | só para cartão | — |
| `proprietario` | não | Default "Eu" |

### 3.2 Como o saldo é calculado

- **Modo `detalhado`:**
  `saldo(t) = saldo_inicial + Σ valor das transações realizadas com data_ancora < data ≤ t + Σ ajustes`
- **Modo `so_saldo`:** o saldo é o **último `SaldoSnapshot`** com data ≤ t. Entre dois snapshots, o gráfico de evolução interpola em linha reta e mostra a linha tracejada, como "estimado".
- **Selo de frescor:** toda conta mostra "atualizado há N dias". Acima de 35 dias o selo fica âmbar. O Meu Futuro mostra "PL baseado em saldos de dd/mm" (§7).

### 3.3 Conferência de saldo e ajuste

Este é o mecanismo que deixa a entrada manual tolerante a erro: o usuário não precisa lançar 100% das transações.

1. O usuário digita o saldo real que vê no app do banco.
2. O app calcula `diferença = real − calculado`.
3. Se `|diferença| ≥ R$ 0,01`, o app oferece três opções:
   - **Criar ajuste** (padrão): uma `Transacao` com `origem = ajuste` e categoria **"Não rastreado"**. A categoria fica na classificação Despesas não obrigatórias se a diferença for negativa, ou Renda se for positiva, e pode ser trocada para Neutra.
   - **Revisar lançamentos:** abre a lista do período desde a última conferência.
   - **Importar extrato:** abre o fluxo da §5.

**Justificativa.** O ajuste aparece como "Não rastreado" nos totais (R-L2). Os totais ficam honestos, e o volume não rastreado vira um indicador de qualidade dos dados: o app mostra "R$ X não rastreados este mês".

### 3.4 Cartão de crédito sem Open Finance

O Dashplan recebia faturas e competências do agregador (R-C2, [OCULTO]). Aqui a regra é explícita.

**CC-1. Fatura de uma compra na data `d`.** Seja `F = dia_fechamento`, limitado ao último dia do mês. Seja `V = dia_vencimento`.

- Se `dia(d) < F`, a fatura fecha no mês de `d`. Se não, fecha no mês seguinte. Compras feitas no próprio dia do fechamento caem na fatura seguinte; uma configuração por cartão permite mudar isso.
- O mês de vencimento é o mês de fechamento se `V > F`, ou o mês seguinte a ele se `V ≤ F`.
- A fatura é identificada pelo mês de vencimento (`competencia_fatura = AAAA-MM`).

**CC-2. Mês da despesa.** Por padrão, a despesa conta no **mês da compra**, coerente com a R-L1. Uma configuração global permite contar pelo mês da fatura.

**CC-3. Pagamento da fatura.** No vencimento, o app gera um **previsto** "Pagamento fatura <cartão> <mês>". O valor é o total da fatura e a categoria é "Pagamento de fatura", na classificação Neutra (R-T1). Ao confirmar, o app cria uma transferência da conta corrente escolhida para o cartão, o que zera a fatura.

**CC-4. Três modos de lançar o cartão.** O usuário escolhe o modo por cartão e pode trocar quando quiser:

| Modo | Esforço | Como funciona |
|---|---|---|
| Compra a compra | alto | Quick-add com conta = cartão (§4.1) |
| Importar fatura | baixo | CSV ou OFX da fatura (§5) |
| Só o total | mínimo | No fechamento, o usuário digita o total da fatura. Ele pode dividir entre algumas categorias ("Mercado 1.200 / Restaurante 400 / Outros 380"), e o app cria um lançamento por categoria |

**CC-5. Conciliação da fatura.** O usuário digita o total que aparece no app do banco, e o app mostra a diferença entre esse valor e Σ dos lançamentos da competência. A diferença é resolvida como na §3.3.

### 3.5 Parcelamento

No Dashplan, o cliente cria só a parcela 1/N e o servidor gera o resto (R-P1). Aqui tudo é gerado no cliente:

- **PAR-1.** Entidade `Parcelamento {valor_total, n, data_compra, conta, descricao, categoria}`. São aceitas de 2 a 48 parcelas; o Dashplan limitava a 12.
- **PAR-2.** O valor de cada parcela, em centavos, é `floor(total/n)`. A sobra `total − n·floor(total/n)` vai para a **1ª parcela**.
- **PAR-3.** A data da parcela k é `data_compra + (k−1) meses`, com o dia limitado ao último dia do mês. Cada parcela entra numa fatura pela CC-1.
- **PAR-4.** Todas as N parcelas são criadas já como `realizado` (a compra aconteceu) e com `parcela_k/parcela_n`. A descrição mostrada é "desc k/N".
- **PAR-5.** Editar ou excluir uma parcela pergunta o escopo: **só esta / esta e as seguintes / todas**.
- **PAR-6.** Uma "compra parcelada já em andamento" é cadastrada informando a parcela atual (por exemplo, 4/10). O app cria só as parcelas a partir dela.

### 3.6 Transferências entre contas próprias

- **TR-1.** Pelo quick-add, o usuário escolhe "Transferência", a conta de origem e a de destino. O app cria um par de transações ligadas por `transferencia_par_id`, na categoria "Transferência mesma titularidade", classificação Neutra (R-T1).
- **TR-2. Detecção automática na importação.** Uma saída numa conta própria e uma entrada de **mesmo valor absoluto** em outra conta própria, com até 2 dias de diferença, viram a sugestão "Parece uma transferência entre suas contas". Um toque as une.

---

## 4. Lançamentos manuais (nível 2)

### 4.1 Quick-add (meta: no máximo 5 s e 3 toques)

```
┌──────────────────────────────────┐
│  Despesa ▾        Hoje ▾  Nubank ▾│   ← tipo, data e conta: últimos usados
│                                  │
│           R$ 32,50               │   ← teclado numérico já aberto;
│                                  │     dígitos entram como centavos (3250 → 32,50)
│  [🍽 Restaurante] [🛒 Mercado]    │   ← 6 chips de categoria sugeridos
│  [🚗 Transporte]  [☕ Café]  ...  │
│                                  │
│  Descrição (opcional) ________   │
│  ☐ Parcelado   ☐ Repetir         │
│                                  │
│  [ Salvar ]  [ Salvar e outro ]  │
└──────────────────────────────────┘
        "Salvo · Desfazer" (snackbar de 5 s)
```

- **QA-1. Abertura.** O botão flutuante fica em todas as telas. No PWA instalado também há um atalho de app ("Novo lançamento"), e no desktop a tecla `N`.
- **QA-2. Ordem dos campos.** Primeiro o **valor**, depois a **categoria**. Data, conta e tipo já vêm preenchidos com o último uso. Tocar num chip de categoria salva direto se a descrição estiver vazia, o que resulta em 2 toques mais o valor.
- **QA-3. Sugestão dos 6 chips,** em ordem:
  1. As regras que casam com a descrição já digitada (§6).
  2. As categorias mais frequentes para aquela conta, no mesmo período do dia (manhã, tarde ou noite) e no mesmo tipo de dia (útil ou fim de semana), nos últimos 90 dias.
  3. As categorias mais usadas no geral.
- **QA-4. Linha de comando opcional.** Um campo de texto aceita algo como `uber 23,90 nubank ontem`. O parser extrai:
  - o valor: o primeiro número com vírgula ou ponto;
  - a conta, por *match* com o nome ou apelido;
  - a data: hoje, ontem, `dd/mm` ou um dia da semana;
  - a descrição, que é o resto do texto e alimenta a §6.
- **QA-5. Favoritos.** Qualquer lançamento pode virar um modelo ("Café R$ 7,00 · Nubank"). Os modelos aparecem como chips no topo e criam o lançamento com um toque.
- **QA-6. Validação.**
  - O valor não pode ser 0.
  - Uma data futura só é aceita como `previsto`; o app pergunta antes.
  - Se já existe uma transação de mesmo valor na mesma conta em até 1 dia, o app avisa "possível duplicado" sem bloquear.
- **QA-7. Valores monetários** são guardados sempre como **inteiro em centavos com sinal** (negativo = saída). Isso substitui o par `valor_entrada` / `valor_saida` da §2.1 e evita erro de ponto flutuante.

### 4.2 Recorrências e previstos

No Dashplan, a recorrência vinha do Open Finance (R-P3, [INFERIDO]). Sem ele, é a recorrência que **mais reduz a digitação**: salário, aluguel, assinaturas, condomínio e contas de consumo.

- **REC-1. Entidade.**
  `Recorrencia {descricao, valor, valor_variavel: bool, categoria, conta, frequencia (semanal | mensal | anual | a cada N meses), dia, inicio, fim?, regra_dia_util (manter | antecipar | postergar)}`
- **REC-2. Geração.** O app gera instâncias `Transacao` com `status = previsto` desde hoje até o fim do mês seguinte. Elas são recriadas sempre que o app abre, e a operação é idempotente pela chave `(recorrencia_id, data_prevista)`.
- **REC-3. Na Home, um card "Para confirmar":**
  - **atrasados:** previstos com data ≤ hoje;
  - **próximos 7 dias.**

  Arrastar para a direita **confirma** com o mesmo valor, e o lançamento passa a `realizado`. Tocar abre a edição; esse é o caso das contas de luz e água, que vêm com `valor_variavel` e o campo de valor já focado. Arrastar para a esquerda faz **"não aconteceu este mês"**.
- **REC-4. Valor variável.** O valor sugerido é a média das 3 últimas confirmações.
- **REC-5. Efeito nos totais.** Um previsto **não** entra no realizado (R-L2). O mês ganha uma linha "Previsto até o fim do mês" e a projeção do saldo da conta: realizado + previstos restantes.
- **REC-6. Detecção de recorrência.** Depois de 3 meses com a mesma descrição normalizada, valor ±10% e dia ±3, o app sugere: "Parece recorrente. Criar recorrência?".
- **REC-7. Escopo de edição,** como num calendário: **só esta / esta e as futuras / todas**.

### 4.3 Lista de lançamentos: edição em massa

- Seleção múltipla, para trocar categoria, conta ou tags, marcar como ignorado ou excluir.
- **Divisão de transação:** uma compra de mercado pode virar "Mercado 300 + Farmácia 80". As partes ficam como filhas e a soma é validada contra o total.
- Filtro "Sem categoria". O alerta R-L3 aparece como um badge com atalho para esse filtro.
- **Exclusão com desfazer**, implementada como *soft delete* com `excluido_em`.

---

## 5. Importação de extrato e fatura (sem Open Finance)

### 5.1 Formatos

| Formato | Origem típica | Prioridade |
|---|---|---|
| **OFX** | Opção "Exportar extrato" do internet banking da maioria dos bancos | MVP da importação |
| **CSV** | Faturas de cartão e bancos digitais. As colunas variam | MVP, com mapeador de colunas |
| **Texto colado** | Copiar e colar linhas do extrato ou da fatura vistos na tela | Fase seguinte |
| PDF | Fatura e extrato em PDF | Fora do escopo inicial: o parsing é frágil e depende de cada banco |

O app deve indicar, por instituição, qual formato ela oferece. Ele vai aprendendo isso pelos perfis salvos (§5.2).

### 5.2 Parsers

- **OFX.** Lê `STMTTRN`: `DTPOSTED`, `TRNAMT` e `FITID`, mais `NAME` ou `MEMO` para a descrição. `LEDGERBAL` dá o saldo final e permite uma conferência automática (§3.3). O OFX 1.x é SGML sem fechamento de tags, então o parser precisa ser tolerante. A codificação costuma ser latin-1; detectar pelo cabeçalho `CHARSET`.
- **CSV, com o mapeador `PerfilImportacaoCSV`.** Na primeira importação de cada instituição, um wizard:
  1. detecta o separador (`;` ou `,`) e a codificação;
  2. mostra as 5 primeiras linhas;
  3. pede ao usuário que aponte as colunas **Data**, **Descrição** e **Valor**, ou o par **Entrada/Saída**;
  4. pergunta o formato da data (`dd/mm/aaaa` e outros), o separador decimal e a convenção de sinal ("compras aparecem positivas?");
  5. pergunta quantas linhas de cabeçalho ou rodapé ignorar.

  O perfil fica salvo por conta e é reaplicado nas importações seguintes.
- **Parcelas no CSV de fatura.** Uma descrição com padrão `\b(\d{1,2})\s*/\s*(\d{1,2})\b` (por exemplo, "LOJA X 03/10") é reconhecida como parcela 3 de 10. O app procura um `Parcelamento` existente; se não houver, sugere criar a partir da parcela atual (PAR-6).

### 5.3 Deduplicação e conciliação

Cada linha importada passa por esta ordem de *match*:

1. **`FITID` igual** na mesma conta: já importada antes. A linha é descartada em silêncio.
2. **Hash exato** `(conta, data, valor_centavos, descricao_normalizada)` igual a uma transação existente: duplicada. Também descartada.
3. **Casamento com um previsto** da mesma conta, mesmo valor (ou ±15% se `valor_variavel`) e data ±5 dias: a linha **confirma o previsto**. Os dois são unidos, e a data e o valor do extrato prevalecem.
4. **Casamento com um lançamento manual** da mesma conta, mesmo valor e data ±3 dias: os dois são **unidos**. O manual mantém a categoria e a descrição escolhidas pelo usuário e recebe o `FITID`.
5. **Sem casamento:** a linha vira uma **transação nova**, categorizada pela §6.

Os casos 3 e 4 têm ambiguidade quando há mais de um candidato. Nesse caso o app não une automaticamente e manda a linha para a revisão.

**Tela Revisar importação:**

```
┌───────────────────────────────────────────────┐
│ Extrato Itaú · 01/11–22/11 · 47 linhas        │
│ Saldo do arquivo R$ 3.420,10 = calculado ✓    │
├───────────────────────────────────────────────┤
│ ▸ 31 novas           (28 categorizadas)       │
│ ▸ 9 já lançadas      (unidas com manuais)     │
│ ▸ 4 previstos confirmados                     │
│ ▸ 2 transferências entre contas?   [revisar]  │
│ ▸ 1 ambígua                         [revisar] │
│ ▸ 3 sem categoria                   [revisar] │
├───────────────────────────────────────────────┤
│        [ Confirmar tudo ]   [ Cancelar lote ] │
└───────────────────────────────────────────────┘
```

- **IMP-1.** Cada importação gera um `LoteImportacao`. O lote pode ser **desfeito inteiro** por até 30 dias, o que remove as novas e desfaz as uniões.
- **IMP-2.** Um arquivo com o mesmo hash de conteúdo de um lote já importado gera o aviso "Este arquivo já foi importado em dd/mm".
- **IMP-3.** Se o arquivo trouxer saldo final (`LEDGERBAL` ou coluna de saldo), o app executa a conferência da §3.3 ao confirmar.

---

## 6. Categorização automática

O Dashplan tem a propagação "Classificar este e os seguintes" no servidor (R-L4, [OCULTO]). Aqui ela é local e explícita.

### 6.1 Normalização da descrição

`descricao_normalizada` é obtida assim:

1. passar para minúsculas e remover acentos;
2. remover datas, horários, `k/N` de parcela, sequências de 4 ou mais dígitos e números de documento;
3. remover ruído bancário comum, como `compra cartao`, `pix enviado`, `pix recebido`, `pagto`, `deb aut`, `ted`, `doc`, `transf`, `*` e espaços repetidos.

O resultado é a chave do "estabelecimento".

### 6.2 Regras

`RegraCategorizacao {condicao: {campo: descricao_normalizada | valor | conta, operador: igual | contem | comeca_com | regex | entre, valor}, acoes: {categoria?, tags?, ignorar?, marcar_transferencia?, renomear?}, prioridade, origem: usuario | aprendida}`

**Ordem de aplicação**, onde a primeira que casar vence:

1. regras do usuário, por prioridade;
2. regras aprendidas;
3. a categoria **mais frequente** no histórico para a mesma `descricao_normalizada`, com mínimo de 2 ocorrências;
4. sem categoria.

### 6.3 Aprendizado

- **CAT-1.** Ao recategorizar uma transação, um snackbar oferece "Sempre categorizar **ifood** como **Restaurante**? · [Sim] [Só esta]". O "Sim" cria uma regra `contem` aprendida e pergunta se ela deve ser aplicada também às N transações passadas sem categoria com a mesma chave.
- **CAT-2.** A tela "Regras" lista, edita e testa as regras, mostrando quantas transações cada uma casaria.
- **Métrica de qualidade:** a % de categorias sugeridas aceitas sem edição (§10).

---

## 7. Fechamento do mês (nível 1)

Este é o fluxo central do app manual: um ritual mensal guiado, que substitui a sincronização automática.

**Gatilho.** No dia 1 (configurável), o app mostra um lembrete (notificação do PWA, se permitida) e um banner na Home: "Fechar outubro · ~8 min". O fechamento pode ser feito a qualquer momento, e o app registra a data de referência.

**Passos.** Uma tela por grupo, com barra de progresso. O teclado numérico segue de campo em campo com "Próximo".

1. **Contas correntes.** Para cada conta, o app mostra "Calculado: R$ 2.340,00 · Confere? [✓] [Digitar real]". Uma divergência leva à §3.3.
2. **Cartões.** Para cada cartão, o app pede o total da fatura que fechou (CC-5). No modo "só o total", esta é a entrada principal (CC-4).
3. **Investimentos e contas `so_saldo`.**
   - Uma lista com o último valor de cada uma já preenchido. Basta digitar o novo saldo, ou tocar em "igual".
   - Um campo opcional, recolhido por padrão: "Quanto você aplicou (+) ou resgatou (−) este mês?".
4. **Bens e dívidas.** Aparecem só os itens marcados como "atualizar mensalmente", tipicamente o saldo devedor de financiamentos. Imóveis e veículos são revisados uma vez por ano (lembrete anual).
5. **Pendências.**
   - Transações sem categoria (R-L3).
   - Previstos não confirmados do mês, com as opções confirmar ou "não aconteceu".
   - O valor que ficou como "Não rastreado".
6. **Resumo,** a recompensa do ritual:
   - patrimônio líquido e Δ em relação ao mês anterior (R-PA3);
   - **aporte real × meta de aporte**;
   - renda, despesas e investido do mês (R-L2), com o orçamento por classificação (R-O1);
   - **efeito no Meu Futuro**: "Com este mês, sua independência financeira foi de 12/2048 para 10/2048". O app roda o motor da §4 com o PL novo e compara com a rodada do fechamento anterior.

### 7.1 Aporte real do mês

O app usa a primeira fonte disponível, nesta ordem:

1. **Detalhado:** Σ das transações do mês com classificação Investimentos (R-L2, "Investido").
2. **Informado:** o campo opcional do passo 3.
3. **Estimado:** `aporte_estimado = PL_m − PL_{m−1}·(1 + i_acc)`. Aparece rotulado "estimado; inclui variação de mercado", com `i_acc` da §4.2.

### 7.2 Entidade `Fechamento`

`Fechamento {mes (AAAA-MM), data_referencia, concluido_em, pl, patrimonio_liquido, aporte_real, aporte_fonte (detalhado | informado | estimado), nao_rastreado, resultado_meu_futuro {mes_IF, PN_CP, saldo_ao_aposentar}}`

Isso cria a **série histórica** que permite o gráfico **"planejado × realizado"** no Meu Futuro: os PLs reais aparecem como pontos sobre a curva projetada. Essa é uma funcionalidade nova em relação ao Dashplan.

---

## 8. Ajustes no modelo de dados (diferenças em relação à §2.1)

| Entidade | Mudança | Motivo |
|---|---|---|
| `InstituicaoFinanceira` | **remover** `conector_open_finance` | Não existe agregador |
| `Conta` | **+** `modo_controle`, `saldo_inicial`, `data_ancora`, `conta_no_pl`, `dia_fechamento`, `dia_vencimento`, `limite`, `perfil_importacao_id` | §3.1, §3.4, §5.2. O `limite_disponivel` passa a ser calculado: `limite − Σ das faturas em aberto` |
| `Transacao` | **substituir** `valor_entrada`/`valor_saida` por `valor_centavos` (inteiro com sinal) | QA-7 |
| `Transacao` | **+** `status` (previsto / realizado), `origem` (manual / recorrencia / ofx / csv / colado / ajuste / importador_externo), `fitid?`, `hash_dedup`, `lote_id?`, `recorrencia_id?`, `parcelamento_id?`, `parcela_k?`, `parcela_n?`, `competencia_fatura?`, `transferencia_par_id?`, `transacao_pai_id?` (divisão), `excluido_em?` | §3–§5 |
| `Transacao` | **remover** `BelvoId`, `IdContaOF`, `validacao_pendente`, `para_deletar` | Substituídos por `origem`, `status` e `excluido_em` |
| **novo** `SaldoSnapshot` | `{alvo_tipo: conta | produto | bem | divida, alvo_id, data, valor_centavos, origem: manual | fechamento | ofx | ajuste}` | §3.2, §7 |
| **novo** `Parcelamento` | ver PAR-1 | §3.5 |
| **novo** `Recorrencia` | ver REC-1 | §4.2 |
| **novo** `RegraCategorizacao` | ver §6.2 | §6 |
| **novo** `LoteImportacao` | `{conta, arquivo_nome, hash_conteudo, formato, importado_em, contagens{novas, unidas, previstos, descartadas}, desfeito_em?}` | IMP-1, IMP-2 |
| **novo** `PerfilImportacaoCSV` | `{instituicao, separador, encoding, linhas_ignorar, mapa_colunas, formato_data, separador_decimal, sinal_invertido}` | §5.2 |
| **novo** `Fechamento` | ver §7.2 | §7 |
| `ProdutoInvestimento` / `Bem` / `Divida` | o valor atual passa a vir do último `SaldoSnapshot`, e o campo `valor` deixa de existir | Mantém o histórico |

**PL do Meu Futuro,** que substitui a R-PA5:
`PL = Σ (último SaldoSnapshot ou saldo calculado) das contas e produtos com conta_no_pl = true e ativos`
Antes do primeiro snapshot, vale o PL informado no onboarding (ONB-1).

---

## 9. Atalhos de entrada, numa fase posterior

| Recurso | Como funciona | Observação |
|---|---|---|
| **Share target do PWA** | O usuário compartilha o texto de um comprovante Pix ou de uma notificação com o app. O texto é parseado como em QA-4 e vai para a revisão | O Web Share Target funciona no Android/Chrome. No iOS, o equivalente é um Atalho que abre a URL `?novo=<texto>` |
| **Colar várias linhas** | O usuário cola várias linhas copiadas do app do banco, e o parser tenta reconhecer `data descrição valor` em cada uma | Sempre passa pela tela Revisar |
| **Atalhos de voz** | Siri Shortcuts ou Google Assistant abrem a URL de quick-add com o texto ditado | Sem custo, via deep link |
| **Adaptador Open Finance pessoal** | Uma fonte opcional que entrega candidatos ao pipeline da §1 | Ver a nota abaixo |

**Nota sobre Open Finance gratuito.** Existe o programa **Meu Pluggy**, descrito por terceiros como gratuito para projetos pessoais, e o Actual Budget tem integração documentada com ele. **Isso não foi confirmado na fonte oficial: verificar os termos e o preço antes de depender dele.** Há relato de transações de cartão do Nubank que aparecem e depois somem na API. Por isso a recomendação é tratá-lo só como mais uma fonte que alimenta a caixa de entrada (§1), com a mesma deduplicação, e nunca como fonte da verdade.

---

## 10. Metas de UX e telemetria local

Estas métricas são calculadas no próprio dispositivo e não são enviadas a lugar nenhum.

| Métrica | Meta |
|---|---|
| Tempo mediano do quick-add (abrir → salvar) | ≤ 5 s |
| Categorias sugeridas aceitas sem edição | ≥ 80% após 2 meses de uso |
| Duração do fechamento mensal | ≤ 10 min |
| Meses com fechamento concluído | ≥ 10 de 12 |
| "Não rastreado" em relação às despesas do mês | ≤ 10% |
| Contas com selo de frescor âmbar (> 35 dias) | 0 após o fechamento |

---

## 11. Plano de implementação em fases

| Fase | Escopo | Entrega de valor |
|---|---|---|
| **F1. Plano + saldos** | Onboarding (§2), contas em `so_saldo`, `SaldoSnapshot`, fechamento mensal com os passos 3, 4 e 6 (§7), motor do Meu Futuro (§4 do spec, validado contra a §5), Projetos de Vida, backup e restauração em JSON | Meu Futuro e Patrimônio completos com cerca de 10 min por mês |
| **F2. Lançamentos** | Quick-add (§4.1), categorias (§2.1 do spec), recorrências e previstos (§4.2), cartão com competência (§3.4), parcelamento (§3.5), transferências (§3.6), conferência de saldo (§3.3), totais R-L1…3, orçamento e reserva (R-O1, R-O2) | Controle de gastos completo, só com entrada manual |
| **F3. Importação** | OFX, CSV com perfis, deduplicação e conciliação (§5.3), regras e aprendizado (§6), lotes desfazíveis | Menos digitação para quem exporta extratos |
| **F4. Aceleradores** | Share target e texto colado, detecção de recorrência (REC-6), gráfico planejado × realizado, adaptador Open Finance opcional (§9) | Conveniência |

**Recomendações técnicas** (não são decisões fechadas):

- PWA *mobile-first*, instalável e offline.
- Persistência local em IndexedDB, por exemplo com Dexie, ou em SQLite WASM.
- Dinheiro sempre em centavos inteiros.
- Datas guardadas como `AAAA-MM-DD` sem fuso, para evitar o deslocamento de 1 dia da R-L1.
- Backup em arquivo JSON, opcionalmente cifrado com senha (AES-GCM via WebCrypto).
- Lembrete do fechamento via notificação local.

---

## 12. Decisões em aberto

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D1 | Plataforma | PWA / app nativo / desktop | **PWA**: um código só, roda no celular e no PC, sem loja |
| D2 | Sincronização entre dispositivos | nenhuma / arquivo manual / serviço próprio | **Nenhuma** na F1. Exportar e importar o backup resolve o uso por uma pessoa |
| D3 | Despesa de cartão no mês da compra ou da fatura | CC-2 | **Mês da compra** (coerente com a R-L1), com opção de trocar |
| D4 | O ajuste "Não rastreado" conta como despesa? | sim / neutro | **Sim**, para os totais ficarem honestos, com opção de marcar como neutro |
| D5 | Limite de parcelas | 12 / 48 | **48** |
