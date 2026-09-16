import { createClient } from '@supabase/supabase-js';

const erpUrl = process.env.ERP_SUPABASE_URL || 'https://sjiyxwkdmfbauksumbqm.supabase.co';
// Usa prioritariamente a chave ANON para garantir ausência de privilégios de escrita
const erpKey = process.env.ERP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqaXl4d2tkbWZiYXVrc3VtYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTg0OTMsImV4cCI6MjA4Nzc5NDQ5M30.t8J1xFhnxGJRNYnes17vAYxAKftvdad8iIUYxB75V4U';

// Cliente Supabase conectado ao ERP (pdv-crm-inova)
const rawClient = createClient(erpUrl, erpKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * BLINDAGEM DE SEGURANÇA UNIDIRECIONAL (SOMENTE-LEITURA)
 * Este proxy intercepta qualquer tentativa de escrita no banco do ERP.
 * Se algum código tentar executar .insert(), .update(), .delete() ou .upsert() no ERP,
 * a operação é interceptada e abortada imediatamente antes de qualquer requisição de rede.
 */
export const erpSupabase = new Proxy(rawClient, {
  get(target, prop) {
    if (prop === 'from') {
      return (tableName) => {
        const queryBuilder = target.from(tableName);
        return new Proxy(queryBuilder, {
          get(tableTarget, opProp) {
            if (['insert', 'update', 'delete', 'upsert'].includes(opProp)) {
              throw new Error(
                `[BLINDAGEM DE SEGURANÇA ERP] Operação proibida: O CRM funciona estritamente em modo SOMENTE-LEITURA com o ERP. A tentativa de executar "${opProp}" na tabela "${tableName}" foi bloqueada.`
              );
            }
            return typeof tableTarget[opProp] === 'function'
              ? tableTarget[opProp].bind(tableTarget)
              : tableTarget[opProp];
          }
        });
      };
    }
    return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
  }
});

