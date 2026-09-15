# 03 — Integração: App "Gestão e Planner"

> **Data:** 2026-03-06  
> **Status:** ✅ Infraestrutura pronta no Supabase  
> **App Futuro:** Mobile 100% (Flutter ou React Native)

---

## Arquitetura

```
┌─────────────────────┐         ┌──────────────────────┐
│   ERP Inova Beauty  │         │  Gestão e Planner    │
│   Next.js (Web)     │         │  Mobile App          │
│                     │         │                      │
│  GRAVA vendas,      │         │  LÊ resumos,         │
│  boletos, estoque   │         │  projeções, KPIs     │
└────────┬────────────┘         └──────────┬───────────┘
         │                                 │
         ▼                                 ▼
    ┌─────────────────────────────────────────┐
    │         SUPABASE (banco único)          │
    │                                         │
    │  📊 vw_resumo_financeiro (View SQL)     │
    │  📋 vw_boletos_a_vencer (View SQL)      │
    │  🔌 Edge Function: resumo-financeiro    │
    └─────────────────────────────────────────┘
```

O app mobile **NÃO precisa de banco próprio**. Ele consome dados do mesmo Supabase via API REST.

---

## Credenciais de Acesso

| Item | Valor |
|---|---|
| **Supabase URL** | `https://sjiyxwkdmfbauksumbqm.supabase.co` |
| **Publishable Key** | `sb_publishable_z89BjiAeRx9jd536k9IYUw_JbKwwgy5` |
| **Edge Function** | `https://sjiyxwkdmfbauksumbqm.supabase.co/functions/v1/resumo-financeiro` |

> ⚠️ A Edge Function requer JWT no header `Authorization`. Para acesso público, usar a View diretamente com a API Key.

---

## Endpoints Disponíveis

### 1. View REST: Resumo Financeiro (KPIs)

```
GET https://sjiyxwkdmfbauksumbqm.supabase.co/rest/v1/vw_resumo_financeiro
Headers:
  apikey: sb_publishable_z89BjiAeRx9jd536k9IYUw_JbKwwgy5
```

**Resposta:**
```json
{
  "vendas_hoje_valor": 200.00,
  "vendas_hoje_qtd": 2,
  "vendas_mes_valor": 4895.00,
  "vendas_mes_qtd": 7,
  "projecao_30d_valor": 225.00,
  "projecao_30d_qtd": 3,
  "inadimplencia_valor": 0,
  "inadimplencia_qtd": 0,
  "ticket_medio": 699.29,
  "atualizado_em": "2026-03-06T22:58:52Z"
}
```

### 2. View REST: Boletos a Vencer (Agenda)

```
GET https://sjiyxwkdmfbauksumbqm.supabase.co/rest/v1/vw_boletos_a_vencer
Headers:
  apikey: sb_publishable_z89BjiAeRx9jd536k9IYUw_JbKwwgy5
```

**Filtrar por urgência:**
```
?urgencia=eq.vencido         → Boletos já vencidos
?urgencia=eq.vence_hoje      → Vencem hoje
?urgencia=eq.proximos_7d     → Próximos 7 dias
?urgencia=eq.proximos_30d    → Próximos 30 dias
```

**Resposta (cada boleto):**
```json
{
  "boleto_id": "uuid",
  "valor": 125.00,
  "data_vencimento": "2026-04-05",
  "numero_parcela": 2,
  "total_parcelas": 4,
  "status": "aberto",
  "dias_ate_vencimento": 30,
  "urgencia": "proximos_30d",
  "cliente_nome": "Fran Felipe Studio",
  "cliente_telefone": "(11) 99999-9999"
}
```

### 3. Edge Function: Resumo Formatado (requer JWT)

```
GET .../functions/v1/resumo-financeiro?tipo=resumo
GET .../functions/v1/resumo-financeiro?tipo=boletos
GET .../functions/v1/resumo-financeiro?tipo=boletos&urgencia=vencido
```

---

## Implementação no App Mobile

### Flutter (exemplo)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class InovaApiService {
  static const _baseUrl = 'https://sjiyxwkdmfbauksumbqm.supabase.co/rest/v1';
  static const _apiKey  = 'sb_publishable_z89BjiAeRx9jd536k9IYUw_JbKwwgy5';

  static Future<Map<String, dynamic>> getResumoFinanceiro() async {
    final res = await http.get(
      Uri.parse('$_baseUrl/vw_resumo_financeiro?select=*'),
      headers: {
        'apikey': _apiKey,
        'Authorization': 'Bearer $_apiKey',
      },
    );
    final data = jsonDecode(res.body);
    return data is List ? data.first : data;
  }

  static Future<List<dynamic>> getBoletosAVencer({String? urgencia}) async {
    var url = '$_baseUrl/vw_boletos_a_vencer?select=*&order=data_vencimento.asc';
    if (urgencia != null) url += '&urgencia=eq.$urgencia';

    final res = await http.get(
      Uri.parse(url),
      headers: {
        'apikey': _apiKey,
        'Authorization': 'Bearer $_apiKey',
      },
    );
    return jsonDecode(res.body);
  }
}
```

### React Native (exemplo)

```typescript
const SUPABASE_URL = 'https://sjiyxwkdmfbauksumbqm.supabase.co/rest/v1';
const API_KEY = 'sb_publishable_z89BjiAeRx9jd536k9IYUw_JbKwwgy5';

export async function getResumo() {
  const res = await fetch(`${SUPABASE_URL}/vw_resumo_financeiro?select=*`, {
    headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  });
  const data = await res.json();
  return data[0];
}

export async function getBoletos(urgencia?: string) {
  let url = `${SUPABASE_URL}/vw_boletos_a_vencer?select=*&order=data_vencimento.asc`;
  if (urgencia) url += `&urgencia=eq.${urgencia}`;

  const res = await fetch(url, {
    headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  });
  return res.json();
}
```

---

## Dados Disponíveis — Resumo

| Metric | Campo | Fonte |
|---|---|---|
| Vendas hoje (R$) | `vendas_hoje_valor` | `vw_resumo_financeiro` |
| Qtd vendas hoje | `vendas_hoje_qtd` | `vw_resumo_financeiro` |
| Vendas mês (R$) | `vendas_mes_valor` | `vw_resumo_financeiro` |
| Qtd vendas mês | `vendas_mes_qtd` | `vw_resumo_financeiro` |
| Projeção 30 dias (R$) | `projecao_30d_valor` | `vw_resumo_financeiro` |
| Inadimplência (R$) | `inadimplencia_valor` | `vw_resumo_financeiro` |
| Ticket médio | `ticket_medio` | `vw_resumo_financeiro` |
| Lista de boletos | vários campos | `vw_boletos_a_vencer` |
| Urgência por boleto | `urgencia` | `vw_boletos_a_vencer` |
| Dias até vencimento | `dias_ate_vencimento` | `vw_boletos_a_vencer` |

---

## Expansão Futura

Para adicionar mais dados ao app mobile, basta:

1. **Criar nova View SQL** no Supabase (ex: `vw_top_produtos`, `vw_comissao_vendedor`)
2. **Dar GRANT SELECT** para `anon` e `authenticated`
3. O app mobile consome via `GET /rest/v1/nome_da_view`

Nenhuma alteração no ERP é necessária.
