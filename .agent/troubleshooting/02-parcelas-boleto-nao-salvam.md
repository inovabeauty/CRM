# Bug: Parcelas do Boleto Não Aparecem no Recibo e Não São Salvas no Banco

## Sintoma
Ao finalizar uma venda com forma de pagamento "Boleto" e configurar parcelas no PDV, o recibo exibe a mensagem *"Informações de parcelas não integradas neste recibo antigo"* ao invés de mostrar as datas e valores das parcelas. Ao verificar no banco de dados, a tabela `boletos` está vazia para essa venda.

## Diagnóstico (3 Causas Raiz)

### Causa 1: Prop `parcelas` não passada ao componente
Em `PDVPage.tsx`, o objeto `successModal` contém a propriedade `parcelas` (gerada pelo `useEffect` ao selecionar boleto), porém ao renderizar `<ConfirmationModal>`, essa propriedade **não era passada** como prop. Resultado: o recibo imediato nunca recebe os dados de parcelas.

### Causa 2: RLS bloqueia INSERT na tabela `boletos`
Em `vendas.ts`, a inserção de boletos usava o cliente Supabase normal (`supabase`, nível de usuário), mas a tabela `boletos` tem uma política RLS que só permite INSERT para quem satisfaz `is_admin()`. Um vendedor comum não consegue inserir boletos, e o erro é silencioso.

### Causa 3: CHECK Constraint no campo `status`
A tabela `boletos` possui um CHECK constraint (`boletos_status_check`) que só aceita: `'aberto'`, `'pago_parcial'`, `'pago'`, `'vencido'`, `'cancelado'`. O código tentava inserir com `status: 'pendente'`, que **não está na lista permitida**, causando erro de constraint e falhando a inserção inteira de forma silenciosa.

## Solução

### Fix 1 — `PDVPage.tsx`
Adicionar a prop `parcelas` ao componente `ConfirmationModal`:
```tsx
<ConfirmationModal
  // ... outras props
  parcelas={successModal.parcelas}  // <-- ADICIONADO
  onNewSale={novaVenda}
/>
```

### Fix 2 — `vendas.ts` (cliente Supabase)
Trocar `supabase` por `adminSupabase` (service client) na inserção de boletos:
```typescript
const { error: boletosError } = await adminSupabase  // era: supabase
  .from('boletos')
  .insert(boletosData)
```

### Fix 3 — `vendas.ts` (status e data_emissao)
Corrigir o status para um valor válido do CHECK constraint e o formato da data:
```typescript
status: 'aberto',                              // era: 'pendente'
data_emissao: new Date().toISOString().split('T')[0]  // era: new Date().toISOString()
```

## Aprendizado para Casos Semelhantes
1. **Sempre verificar CHECK constraints** ao inserir dados em tabelas do Supabase. Os erros de constraint violation podem ser silenciosos se o código não trata o `error` retornado de forma visível.
2. **Sempre verificar RLS policies** quando inserts falham silenciosamente. Use `createServiceClient()` para operações server-side que precisam contornar restrições de permissão.
3. **Sempre verificar se props estão sendo passadas** entre componentes React, especialmente quando o dado existe no estado mas não aparece na UI.
