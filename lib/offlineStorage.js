import { supabase } from './supabaseClient';

const CACHE_CLIENTS_KEY = 'crm_cached_clients';
const CACHE_INTERACTIONS_KEY = 'crm_pending_interactions';

// Salva clientes em cache para consulta offline
export const cacheClientsLocally = (clients) => {
  if (typeof window === 'undefined' || !clients) return;
  try {
    localStorage.setItem(CACHE_CLIENTS_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: clients
    }));
  } catch (e) {
    console.warn('Erro ao salvar cache de clientes:', e);
  }
};

// Recupera clientes do cache se offline
export const getCachedClientsLocally = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_CLIENTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.data || null;
  } catch (e) {
    return null;
  }
};

// Enfileira interação se o vendedor estiver sem sinal
export const queueOfflineInteraction = (interactionData) => {
  if (typeof window === 'undefined') return;
  try {
    const pending = getPendingInteractions();
    pending.push({
      ...interactionData,
      queued_at: new Date().toISOString()
    });
    localStorage.setItem(CACHE_INTERACTIONS_KEY, JSON.stringify(pending));
  } catch (e) {
    console.error('Erro ao enfileirar interação offline:', e);
  }
};

// Retorna interações pendentes
export const getPendingInteractions = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_INTERACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

// Sincroniza interações pendentes com o Supabase
export const syncPendingInteractions = async () => {
  if (typeof window === 'undefined' || !navigator.onLine) return { synced: 0 };
  const pending = getPendingInteractions();
  if (pending.length === 0) return { synced: 0 };

  let syncedCount = 0;
  const remaining = [];

  for (const item of pending) {
    try {
      // 1. Insere na tabela de interacoes
      const { error: errInteracao } = await supabase.from('interacoes').insert({
        cliente_id: item.cliente_id,
        tipo: item.tipo,
        status_funil: item.status_funil,
        motivo_objecao: item.motivo_objecao,
        observacoes: item.observacoes,
        data_retorno: item.data_retorno || null
      });

      // 2. Atualiza tabela de clientes
      const { error: errCliente } = await supabase.from('clientes').update({
        data_ultima_interacao: new Date().toISOString(),
        tipo_ultima_interacao: item.tipo,
        observacoes: item.observacoes,
        status_funil: item.status_funil,
        linha_interesse: item.linha_interesse,
        melhor_dia_compra: item.melhor_dia_compra ? parseInt(item.melhor_dia_compra) : null,
        data_retorno: item.data_retorno || null
      }).eq('id', item.cliente_id);

      if (!errInteracao && !errCliente) {
        syncedCount++;
      } else {
        remaining.push(item);
      }
    } catch (e) {
      remaining.push(item);
    }
  }

  localStorage.setItem(CACHE_INTERACTIONS_KEY, JSON.stringify(remaining));
  return { synced: syncedCount, remaining: remaining.length };
};
