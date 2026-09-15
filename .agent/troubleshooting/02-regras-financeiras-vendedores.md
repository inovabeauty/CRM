# 02 — Regras Financeiras para Vendedores

> **Data:** 2026-03-06  
> **Status:** ✅ Implementado e verificado  
> **Princípio:** ADM tem controle TOTAL e IRRESTRITO. Vendedores são limitados pelas regras configuradas.

---

## Resumo

O sistema aplica regras financeiras (parcela mínima, prazo de vencimento por faixa de valor, limite de desconto) **apenas para vendedores**. Admin e Gestor **não têm nenhuma restrição**.

---

## Configurações no Supabase

Tabela: `configuracoes` (chave-valor)

| Chave | Valor Atual | Descrição |
|---|---|---|
| `boleto_parcela_minima` | 250 | Valor mínimo por parcela (R$) |
| `boleto_vencimento_padrao` | 30 | Dias padrão para vencimento |
| `boleto_regra_ate500` | 30 | Prazo máx. (dias) para compras ≤ R$500 |
| `boleto_regra_500a1000` | 60 | Prazo máx. (dias) para compras R$500–R$1000 |
| `boleto_regra_acima1000` | 90 | Prazo máx. (dias) para compras > R$1000 |
| `limite_desconto_vendedor` | 10 | Desconto máximo (%) para vendedores |
| `desconto_maximo` | 15 | Desconto máximo geral (%) |

**Para alterar:** Configurações > Financeiro (via admin)

---

## Arquitetura de Enforcement

### Camada 1: Server-side (`app/actions/vendas.ts`)

**Função `criarVenda()`** — Quando `role === 'vendedor'`:

1. **Desconto**: Valida `desconto_percentual ≤ limite_desconto_vendedor`
2. **Parcela mínima**: Cada boleto.valor deve ser ≥ `boleto_parcela_minima`
3. **Prazo máximo**: Data de vencimento de cada parcela não pode exceder o prazo da faixa de valor:
   - Total ≤ R$500 → `boleto_regra_ate500` dias
   - R$500 < Total ≤ R$1000 → `boleto_regra_500a1000` dias
   - Total > R$1000 → `boleto_regra_acima1000` dias

Se violado, retorna `{ success: false, error: "mensagem descritiva" }`

**Função `getFinancialRules()`** — Retorna todas as regras em um objeto tipado para o frontend.

### Camada 2: Client-side (`app/(dashboard)/pdv/page.tsx`)

- **Busca regras no load** via `getFinancialRules()`
- **Auto-calcula max parcelas**: `Math.floor(totalPagamento / parcelaMinima)`
- **Auto-calcula datas**: Distribui parcelas proporcionalmente dentro do prazo máximo
- **Bloqueia edição** de valor e data para vendedores (`readOnly`)
- **Badges visuais**:
  - Vendedor: `MÁX Xx • Xd` (laranja) + indicadores de regras
  - Admin: `ADM LIVRE` (verde) — sem restrições

### Bypass total para Admin/Gestor

- Server-side: O bloco `if (role === 'vendedor')` é o único que valida
- Client-side: `isSellerRestricted = userRole === 'vendedor'` controla tudo
- Se não é vendedor, **nada é validado nem bloqueado**

---

## Arquivos Envolvidos

| Arquivo | Responsabilidade |
|---|---|
| `app/actions/vendas.ts` | Server actions: `criarVenda()`, `getFinancialRules()`, `getSellerDiscountLimit()` |
| `app/(dashboard)/pdv/page.tsx` | Frontend PDV: UI de parcelas, badges, auto-cálculo |
| `app/(dashboard)/configuracoes/page.tsx` | Admin settings: `SectionFinanceiro` para editar regras |

---

## Como Modificar

### Alterar valores das regras
Acesse **Configurações > Financeiro** no painel admin e edite os campos. Sem código.

### Adicionar nova faixa de valor
1. Adicionar chave na tabela `configuracoes` (ex: `boleto_regra_1000a2000`)
2. Incluir no array `.in('chave', [...])` em `criarVenda()` e `getFinancialRules()`
3. Adicionar condição `else if` na lógica de `maxDias` (server e client)
4. Adicionar campo no `SectionFinanceiro` em `configuracoes/page.tsx`

### Remover restrições de vendedores
Basta remover o bloco `if (role === 'vendedor')` em `criarVenda()` e setar `isSellerRestricted = false` no PDV.
