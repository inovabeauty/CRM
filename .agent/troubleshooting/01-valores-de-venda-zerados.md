# Bug: Valores Totais de Venda Zerados ou Incorretos (Especialmente com Kits/Combos)

## Sintoma
O usuário adiciona diversos itens ao carrinho no PDV (incluindo Kits ou Combos de alto valor) e, ao finalizar a venda, o sistema processa corretamente a transação, mas o valor `total_final` no banco de dados e nos recibos impressos é armazenado com um valor muito inferior ao real (ex: apenas o subtotal dos produtos comuns incluídos, ignorando completamente os Kits e Combos).

## Diagnóstico
O backend em Node.js (Next.js server actions como `criarVenda`) realiza os cálculos matemáticos perfeitamente. Contudo, ao inserir o registro da venda no Supabase, a tabela `vendas` também dispara gatilhos (*Triggers* no Postgres).
Neste caso específico, havia um gatilho chamado `trg_total_venda` na tabela `vendas` (ou `venda_itens` dependendo de como foi estruturado) que executava a função `fn_atualizar_total_venda()`. 

Esse gatilho forçava o recalculo do `total` somando apenas as linhas da tabela `venda_itens`. Como o sistema arquitetura os **Kits** e **Combos** inserindo seus relacionamentos e identificadores dentro do campo `observacao` da tabela `vendas` (como metadados JSON `[SYS_EXTRAS]`) – e não na tabela padrão `venda_itens` –, a função do banco de dados encontrava um valor menor e sobrescrevia o cálculo correto que o Node.js havia feito.

## Solução (Como Resolver)
Para que a lógica de negócio do Next.js possua total controle sobre as regras de preços e promoções e persistência de Kits/Combos, os gatilhos no banco de dados que reescrevem o valor `total` autonomamente devem ser desativados ou mitigados.

**1. Comando SQL Executado (Remoção do Gatilho):**
```sql
DROP TRIGGER IF EXISTS trg_total_venda ON public.venda_itens; 
DROP FUNCTION IF EXISTS fn_atualizar_total_venda();
```

## Aprendizado para Casos Semelhantes
1. **Nunca duvide apenas do Payload Frontend/Backend:** Ao analisar problemas de gravação misteriosos ou "matemática inexplicável" no Supabase, audite diretamente os gatilhos (`Triggers`) nas tabelas afetadas. Eles frequentemente alteram o estado da aplicação pós-inserção (AFTER INSERT / UPDATE).
2. **Kits e Combos não ficam em `venda_itens`**: Pela arquitetura atual do sistema, lembre-se sempre que Kits e Combos são anexados dentro do campo `observacao` como JSON devido à ausência de uma tabela dedicada `venda_itens_kits`. Qualquer procedimento armazenado (Stored Procedure) ou relatórios de faturamento construídos em SQL puro precisarão extrair dados desse JSON ou eles incorrerão no mesmo bug deste gatilho de relatar subtotais vazios ou parciais.
