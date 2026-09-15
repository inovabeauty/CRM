import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/authContext';

export default function Navbar({
  routeCount = 0,
  onOpenRouteModal,
  onOpenDailyReport,
  onOpenTeamModal,
  onOpenPwaInstall,
  selectedCity,
  onSelectCity,
  cities = [],
  funnelFilter,
  onSelectFunnelFilter,
  theme = 'dark',
  onToggleTheme,
  onSelectClient
}) {
  const { user, profile, isGestor, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSyncingErp, setIsSyncingErp] = useState(false);

  // Sincronização sob demanda com o ERP (pdv-crm-inova)
  const handleSyncErp = async () => {
    if (isSyncingErp) return;
    setIsSyncingErp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/sync-erp', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Sincronização com ERP Concluída!\n\n• ${data.totalErp} clientes do ERP processados\n• ${data.vinculadosExistentes} vinculados a salões existentes\n• ${data.criadosNovos} novos salões adicionados com compras\n• ${data.inadimplentesAtivos} alertas de inadimplência ativos\n• ${data.totalVendasConsolidadas} vendas consolidadas (R$ ${data.valorTotalFaturado?.toFixed(2)})`);
        window.dispatchEvent(new Event('refreshMap'));
      } else {
        alert('Erro ao sincronizar com ERP: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (e) {
      alert('Falha na comunicação com o servidor de sincronização: ' + e.message);
    } finally {
      setIsSyncingErp(false);
    }
  };

  // Autocomplete buscando no Supabase por multi-campos (nome, endereço, rua, bairro, dona)
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      const resetSearch = setTimeout(() => setSearchResults([]), 0);
      return () => clearTimeout(resetSearch);
    }
    const delaySearch = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome, latitude, longitude, categorias, whatsapp, status_funil, cidade, boleto_atrasado, data_ultima_compra, linha_interesse, melhor_dia_compra, observacoes, ultimas_compras, responsavel, instagram, telefone_alternativo, data_ultima_interacao, tipo_ultima_interacao, data_retorno, endereco, localizacao_pendente, erp_cliente_id, valor_total_comprado, qtd_compras')
          .or(`nome.ilike.%${term}%,endereco.ilike.%${term}%,responsavel.ilike.%${term}%,cidade.ilike.%${term}%,whatsapp.ilike.%${term}%`)
          .limit(25);
        if (!error && data) {
          setSearchResults(data);
          return;
        }
      } catch (e) {
        console.warn('Erro na busca multi-campos:', e);
      }

      // Fallback caso a query .or falhe
      try {
        const { data } = await supabase
          .from('clientes')
          .select('id, nome, latitude, longitude, categorias, whatsapp, status_funil, cidade, boleto_atrasado, data_ultima_compra, linha_interesse, melhor_dia_compra, observacoes, ultimas_compras, responsavel, instagram, telefone_alternativo, data_ultima_interacao, tipo_ultima_interacao, data_retorno, endereco, localizacao_pendente, erp_cliente_id, valor_total_comprado, qtd_compras')
          .ilike('nome', `%${term}%`)
          .limit(20);
        if (data) setSearchResults(data);
      } catch (err) {
        console.error('Erro no fallback de busca:', err);
      }
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const handleSelectResult = (client) => {
    setSearchQuery('');
    setSearchResults([]);
    if (onSelectClient) onSelectClient(client);
  };

  const totalClientsCount = cities.reduce((acc, c) => acc + c.count, 0);

  return (
    <header className="bg-base-100/95 backdrop-blur-md border-b border-base-200 z-[9999] shrink-0 sticky top-0 shadow-xs transition-colors pt-safe">
      {/* Linha 1: Marca & Botões de Ação Imediata */}
      <div className="px-3 md:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 shrink-0">
          <img
            src="/logo1.png"
            alt="Inova Beauty"
            className="h-7 w-auto object-contain drop-shadow-xs"
          />
          <span className="text-base md:text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-secondary">
            Inova Beauty
          </span>
          <span className="badge badge-ghost badge-xs font-mono font-bold opacity-70 uppercase tracking-widest hidden sm:inline">
            CRM
          </span>
        </div>

        {/* Ações Rápidas (Rota sempre visível + Menu Executivo limpo) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botão Rota do Dia (Sempre visível tanto no mobile quanto no desktop) */}
          <button
            onClick={onOpenRouteModal}
            className="btn btn-xs sm:btn-sm btn-secondary font-bold text-[11px] gap-1 shadow-xs rounded-xl"
            title="Abrir rota do dia"
          >
            <span>📍</span> Rota <span className="badge badge-xs badge-ghost bg-base-100/30 text-white font-mono">{routeCount}</span>
          </button>

          {/* Botões diretos no Desktop (ocultos no mobile para manter layout ultrafino e limpo) */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={onOpenDailyReport}
              className="btn btn-xs sm:btn-sm btn-outline btn-accent font-bold text-[11px] gap-1 shadow-xs rounded-xl"
              title="Relatório Diário de Fechamento (WhatsApp da Diretoria)"
            >
              <span>📤</span> Fechamento
            </button>

            <button
              type="button"
              onClick={handleSyncErp}
              disabled={isSyncingErp}
              className="btn btn-xs sm:btn-sm btn-ghost hover:bg-base-200 border border-base-300 font-bold text-[11px] gap-1 shadow-xs rounded-xl text-base-content/85"
              title="Sincronizar compras e clientes do ERP Inova"
            >
              <span className={isSyncingErp ? 'animate-spin' : ''}>🔄</span>
              <span>{isSyncingErp ? 'Sync...' : 'Sync ERP'}</span>
            </button>

            {isGestor && (
              <button
                type="button"
                onClick={onOpenTeamModal}
                className="btn btn-xs sm:btn-sm btn-primary font-bold text-[11px] gap-1 shadow-xs rounded-xl"
                title="Gerenciar Equipe e Carteiras de Vendedores"
              >
                <span>👥</span> Equipe
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              className="btn btn-circle btn-xs sm:btn-sm btn-ghost hover:bg-base-200"
              title={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
            >
              {theme === 'dark' ? <span className="text-sm">☀️</span> : <span className="text-sm">🌙</span>}
            </button>
          </div>

          {/* Menu Dropdown Executivo Unificado (Mobile e Desktop) */}
          {user && (
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-xs sm:btn-sm btn-ghost hover:bg-base-200 border border-base-300 rounded-xl px-2 gap-1.5 flex items-center cursor-pointer shadow-2xs">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                  {(profile?.nome || user?.email || 'U')[0].toUpperCase()}
                </div>
                <span className="text-[11px] font-semibold max-w-[80px] truncate hidden sm:inline">
                  {profile?.nome || user?.email?.split('@')[0]}
                </span>
                <span className="text-xs opacity-70">⋮</span>
              </label>
              <ul tabIndex={0} className="dropdown-content z-[100000] menu p-2 shadow-2xl bg-base-100 rounded-2xl w-60 border border-base-300 mt-2 text-xs space-y-0.5">
                <li className="menu-title px-2 py-1 text-base-content/70">
                  <span className="font-bold text-xs">{profile?.nome || 'Usuário'}</span>
                  <span className="text-[10px] block font-mono font-normal opacity-70 truncate">{user.email}</span>
                  <span className={`badge badge-xs font-semibold mt-1 ${isGestor ? 'badge-primary text-white' : 'badge-neutral'}`}>
                    {isGestor ? 'Gestor' : 'Vendedor'}
                  </span>
                </li>
                <div className="divider my-1"></div>
                
                {/* Itens móveis integrados */}
                <li className="md:hidden">
                  <button onClick={onOpenDailyReport} className="flex items-center gap-2">
                    <span>📤</span> Relatório de Fechamento
                  </button>
                </li>
                <li className="md:hidden">
                  <button onClick={handleSyncErp} disabled={isSyncingErp} className="flex items-center gap-2">
                    <span className={isSyncingErp ? 'animate-spin' : ''}>🔄</span> {isSyncingErp ? 'Sincronizando...' : 'Sincronizar ERP'}
                  </button>
                </li>
                {isGestor && (
                  <li>
                    <button onClick={onOpenTeamModal} className="flex items-center gap-2">
                      <span>👥</span> Gerenciar Equipe
                    </button>
                  </li>
                )}
                <li className="md:hidden">
                  <button onClick={onToggleTheme} className="flex items-center gap-2">
                    <span>{theme === 'dark' ? '☀️ Alternar Modo Claro' : '🌙 Alternar Modo Escuro'}</span>
                  </button>
                </li>
                <li>
                  <button onClick={onOpenPwaInstall} className="flex items-center gap-2 text-amber-500 font-medium">
                    <span>📲</span> Instalar App Celular (PWA)
                  </button>
                </li>
                <div className="divider my-1"></div>
                <li>
                  <button onClick={signOut} className="text-error font-medium flex items-center gap-2">
                    <span>🚪</span> Sair da Conta
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Linha 2: Barra de Busca Autocomplete */}
      <div className="px-3 md:px-4 pb-2">
        <div className="relative w-full">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-base-content/50 text-xs pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="Buscar salão, dona, bairro ou rua..."
              className="input input-sm input-bordered w-full pl-8 pr-8 text-xs rounded-xl bg-base-200/60 focus:bg-base-100 transition-all border-base-300 placeholder:text-base-content/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-2 text-xs opacity-60 hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full hover:bg-base-300"
              >
                ✕
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <ul className="absolute left-0 top-full mt-1.5 w-full bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-y-auto max-h-[55vh] z-[99999] overscroll-contain divide-y divide-base-200 animate-in fade-in-50 duration-150">
              <li className="px-3 py-1.5 text-[11px] font-semibold text-base-content/60 bg-base-200/90 sticky top-0 backdrop-blur z-10 flex justify-between">
                <span>{searchResults.length} salões encontrados</span>
                <span className="text-[10px] opacity-70">Toque para localizar no mapa</span>
              </li>
              {searchResults.map((c) => (
                <li
                  key={c.id}
                  className="hover:bg-base-200/80 cursor-pointer p-3 transition-colors text-left"
                  onClick={() => handleSelectResult(c)}
                >
                  <div className="font-bold text-sm truncate text-base-content flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{c.nome || 'Salão Sem Nome'}</span>
                      {c.localizacao_pendente && (
                        <span className="badge badge-xs badge-warning text-[9px] font-bold shrink-0">📍 Ajustar GPS</span>
                      )}
                    </div>
                    {(c.status_funil || c.boleto_atrasado) && (
                      <span className="badge badge-xs badge-ghost text-[10px] shrink-0 font-medium">
                        {c.boleto_atrasado || c.status_funil === 'em_atraso' ? '⛔ Em Atraso' : c.status_funil === 'cliente_ativo' ? '🟢 Ativo' : c.status_funil === 'negociacao' ? '🟡 Negociação' : c.status_funil === 'alerta_resgate' ? '🔴 Resgate' : '🔵 Prospect'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-base-content/65 flex justify-between mt-0.5">
                    <span className="truncate pr-2">
                      {c.endereco ? `${c.endereco} • ` : ''}{c.cidade} {c.responsavel ? `• Dona: ${c.responsavel}` : ''}
                    </span>
                    <span className="opacity-80 shrink-0 font-medium font-mono text-[11px]">
                      {c.whatsapp || 'Sem Whats'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Linha 3: Barra com Rolagem Horizontal para Seletores de Cidade e Funil */}
      <div className="px-3 md:px-4 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        {/* Seletor de Cidade com rolagem garantida */}
        <div className="shrink-0 flex items-center gap-1.5 bg-base-200/80 hover:bg-base-200 px-3 py-1.5 rounded-xl border border-base-300 transition-colors">
          <span className="text-xs">🏙️</span>
          <select
            className="bg-transparent text-xs font-semibold text-base-content focus:outline-none cursor-pointer pr-1"
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
          >
            <option value="">Todas as Cidades ({totalClientsCount})</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name} className="bg-base-100 text-base-content">
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>

        {/* Seletor de Funil com rolagem garantida */}
        <div className="shrink-0 flex items-center gap-1.5 bg-base-200/80 hover:bg-base-200 px-3 py-1.5 rounded-xl border border-base-300 transition-colors">
          <span className="text-xs">🎯</span>
          <select
            className="bg-transparent text-xs font-semibold text-base-content focus:outline-none cursor-pointer pr-1"
            value={funnelFilter}
            onChange={(e) => onSelectFunnelFilter(e.target.value)}
          >
            <option value="">Todo o Funil</option>
            <option value="prospect" className="bg-base-100 text-base-content">🔵 Prospects</option>
            <option value="negociacao" className="bg-base-100 text-base-content">🟡 Negociação</option>
            <option value="cliente_ativo" className="bg-base-100 text-base-content">🟢 Clientes Ativos</option>
            <option value="alerta_resgate" className="bg-base-100 text-base-content">🔴 Alerta Resgate</option>
            <option value="em_atraso" className="bg-base-100 text-base-content">⛔ Em Atraso (ERP)</option>
          </select>
        </div>
      </div>
    </header>
  );
}
