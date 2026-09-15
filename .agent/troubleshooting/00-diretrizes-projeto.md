# 00 — Diretrizes Fundamentais do Projeto

> **Criado:** 2026-03-06 | Atualização contínua

---

## 🔥 PDV = CORAÇÃO DO SISTEMA

O **PDV (Ponto de Venda)** é a parte primordial e prioritária de toda a aplicação.  
Toda a movimentação da empresa passa por ele.

### Regras invioláveis:

1. **Abertura rápida** — PDV deve carregar instantaneamente. Nenhuma query pesada no load inicial.
2. **Zero travamento** — Operações como busca de produtos, adição ao carrinho e finalização de venda devem ser fluidas.
3. **Prioridade de carregamento** — Dados do PDV têm precedência sobre qualquer outra aba.
4. **Todas as abas giram em torno do PDV** — Financeiro, Estoque, Clientes, Configurações existem para dar suporte ao PDV.

### Ao implementar qualquer funcionalidade:

- ⚡ Sempre considere o **impacto no PDV** antes de implementar
- 🚫 Nunca adicionar queries bloqueantes no fluxo do PDV
- 📦 Dados pré-carregados quando possível, lazy-load para o resto
- 🔄 Offline-first: o PDV já possui fila offline — manter e respeitar

---

## Hierarquia de Permissões

| Role | Nível | Restrições |
|---|---|---|
| **admin** | Mestre | ZERO restrições — controle total e irrestrito |
| **gestor** | Gerencial | Sem restrições financeiras (mesmo nível do admin em regras de venda) |
| **vendedor** | Operacional | Limitado por regras configuráveis (desconto, parcelas, prazos) |

---

## Documentação de Features

| Doc | Tópico |
|---|---|
| `01-valores-de-venda-zerados.md` | Bug fix: valores de venda zerados |
| `02-regras-financeiras-vendedores.md` | Regras financeiras (parcela mínima, vencimento, desconto) |
| `03-integracao-gestao-planner-app.md` | API de integração com app mobile "Gestão e Planner" |
