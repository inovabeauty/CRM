import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function PendingClientsModal({
  isOpen,
  onClose,
  clients = [],
  onSelectClient
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [livePending, setLivePending] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLivePending = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, latitude, longitude, categorias, whatsapp, status_funil, cidade, boleto_atrasado, data_ultima_compra, linha_interesse, melhor_dia_compra, observacoes, ultimas_compras, responsavel, instagram, telefone_alternativo, data_ultima_interacao, tipo_ultima_interacao, data_retorno, endereco, localizacao_pendente, erp_cliente_id, valor_total_comprado, qtd_compras')
        .eq('localizacao_pendente', true)
        .order('nome');
      if (!error && data) {
        setLivePending(data);
      }
    } catch (e) {
      console.warn('Erro ao carregar salões pendentes no modal:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLivePending();
    }
  }, [isOpen]);

  const sourceClients = livePending.length > 0 ? livePending : clients;

  const pendingClients = useMemo(() => {
    return sourceClients.filter((c) => c.localizacao_pendente === true);
  }, [sourceClients]);

  // Lista de cidades disponíveis entre os pendentes
  const availableCities = useMemo(() => {
    const cityMap = {};
    pendingClients.forEach((c) => {
      const city = c.cidade || 'Não informada';
      cityMap[city] = (cityMap[city] || 0) + 1;
    });
    return Object.entries(cityMap).sort((a, b) => b[1] - a[1]);
  }, [pendingClients]);

  // Filtro por texto e cidade
  const filteredList = useMemo(() => {
    return pendingClients.filter((c) => {
      if (cityFilter && c.cidade !== cityFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const name = (c.nome || '').toLowerCase();
      const resp = (c.responsavel || '').toLowerCase();
      const addr = (c.endereco || '').toLowerCase();
      const city = (c.cidade || '').toLowerCase();
      const phone = (c.whatsapp || c.telefone_alternativo || '').toLowerCase();
      return name.includes(term) || resp.includes(term) || addr.includes(term) || city.includes(term) || phone.includes(term);
    });
  }, [pendingClients, searchTerm, cityFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-base-100 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-base-300 max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
              📍
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-base-content leading-tight">
                  Salões com Localização Pendente
                </h2>
                <span className="badge badge-warning badge-sm font-bold shadow-2xs">
                  {pendingClients.length} salões
                </span>
              </div>
              <p className="text-[11px] text-base-content/60 mt-0.5">
                Salões do ERP que precisam de ajuste de coordenadas ou confirmação presencial no mapa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost text-base-content/70 hover:text-base-content shrink-0"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Barra de Busca e Filtros Rápidos */}
        <div className="p-3 border-b border-base-200 bg-base-100 space-y-2">
          <div className="form-control">
            <input
              type="text"
              placeholder="Buscar por salão, dona, endereço ou telefone..."
              className="input input-sm input-bordered w-full text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          {/* Chips de Cidades */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
            <button
              onClick={() => setCityFilter('')}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                cityFilter === ''
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-800 dark:text-amber-300'
                  : 'bg-base-200/80 border-base-300 text-base-content/70 hover:bg-base-200'
              }`}
            >
              Todas ({pendingClients.length})
            </button>
            {availableCities.map(([city, count]) => (
              <button
                key={city}
                onClick={() => setCityFilter(cityFilter === city ? '' : city)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  cityFilter === city
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-800 dark:text-amber-300'
                    : 'bg-base-200/80 border-base-300 text-base-content/70 hover:bg-base-200'
                }`}
              >
                {city} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Salões Pendentes */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-base-200/60">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-base-content/50 text-xs">
              <span className="text-3xl block mb-2">🎉</span>
              Nenhum salão pendente encontrado com os filtros atuais.
            </div>
          ) : (
            filteredList.map((client) => {
              const comprasCount = client.qtd_compras || (client.ultimas_compras ? client.ultimas_compras.length : 0);
              const valorTotal = client.valor_total_comprado || 0;

              return (
                <div
                  key={client.id}
                  className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-base-200/50 transition-colors"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-xs font-extrabold text-base-content truncate">
                        {client.nome}
                      </strong>
                      <span className="badge badge-warning badge-xs font-bold shadow-2xs">
                        ⚠️ Localização Pendente
                      </span>
                      {client.cidade && (
                        <span className="badge badge-ghost badge-xs font-medium text-base-content/70">
                          {client.cidade}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-base-content/70 flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                      {client.responsavel && (
                        <span>
                          Dona: <strong className="text-base-content">{client.responsavel}</strong>
                        </span>
                      )}
                      {(client.whatsapp || client.telefone_alternativo) && (
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          📞 {client.whatsapp || client.telefone_alternativo}
                        </span>
                      )}
                      {comprasCount > 0 && (
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          🛍️ {comprasCount} compras (R$ {Number(valorTotal).toFixed(2).replace('.', ',')})
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-base-content/60 truncate" title={client.endereco}>
                      📍 {client.endereco || 'Endereço não cadastrado'}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      if (onSelectClient) onSelectClient(client);
                    }}
                    className="btn btn-xs btn-primary font-bold rounded-xl gap-1 shrink-0 self-end sm:self-center shadow-xs"
                    title="Abrir ficha e posicionar no mapa"
                  >
                    <span>📍</span> Ver no Mapa
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="p-3 border-t border-base-200 bg-base-200/40 text-[11px] text-base-content/60 flex items-center justify-between">
          <span>
            Mostrando <strong>{filteredList.length}</strong> de <strong>{pendingClients.length}</strong> salões pendentes
          </span>
          <button onClick={onClose} className="btn btn-xs btn-ghost">
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
