export default function RouteModal({
  isOpen,
  onClose,
  routeList = [],
  onRemoveFromRoute,
  onClearRoute,
  onStartNavigation,
  onAutoAddNearest
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[10000] flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-base-100 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-base-200 flex flex-col gap-2 border-b border-base-300">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚗</span>
              <h2 className="font-bold text-lg text-base-content">Rota do Dia</h2>
              <span className="badge badge-secondary badge-sm font-bold">
                {routeList.length} paradas
              </span>
            </div>
            <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
          </div>

          {/* Botões de Rota Inteligente */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => onAutoAddNearest && onAutoAddNearest(true)}
              className="btn btn-sm btn-primary shadow-xs text-xs font-bold gap-1 rounded-xl"
              title="Prioriza salões com retornos hoje, cartão virando e negociações em aberto"
            >
              <span>🎯</span> Rota Comercial
            </button>
            <button
              onClick={() => onAutoAddNearest && onAutoAddNearest(false)}
              className="btn btn-sm btn-outline btn-primary shadow-xs text-xs font-bold gap-1 rounded-xl"
              title="Organiza pelo salão fisicamente mais próximo"
            >
              <span>⚡</span> Menor Distância
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {routeList.length === 0 ? (
            <div className="text-center text-gray-500 mt-12 space-y-2">
              <span className="text-4xl block">📍</span>
              <p className="text-xs font-medium">Nenhum salão selecionado na rota.</p>
              <p className="text-[11px] text-gray-400">
                Toque em &quot;🎯 Rota Comercial&quot; para priorizar salões com fechamento iminente ou selecione manualmente no mapa.
              </p>
            </div>
          ) : (
            routeList.map((client, index) => {
              const hojeIso = new Date().toISOString().split('T')[0];
              const isRetornoHoje = client.data_retorno && client.data_retorno <= hojeIso;
              const isNegociacao = client.status_funil === 'negociacao';
              
              return (
                <div
                  key={client.id}
                  className="flex justify-between items-center bg-base-200 p-3 rounded-xl shadow-xs border-l-4 border-secondary text-xs"
                >
                  <div className="pr-2 truncate">
                    <div className="font-bold text-sm truncate text-base-content flex items-center gap-1.5">
                      <span className="text-secondary font-mono">{index + 1}.</span> 
                      <span className="truncate">{client.nome}</span>
                      {isRetornoHoje && (
                        <span className="badge badge-xs badge-primary font-bold shrink-0">🔔 Retorno</span>
                      )}
                      {isNegociacao && !isRetornoHoje && (
                        <span className="badge badge-xs badge-warning font-bold shrink-0">🔥 Negociação</span>
                      )}
                    </div>
                    <div className="text-gray-400 truncate text-[11px] mt-0.5">
                      {client.responsavel ? `Resp: ${client.responsavel} • ` : ''}
                      {client.cidade || 'Salão'}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveFromRoute(client.id)}
                    className="btn btn-xs btn-error btn-square btn-outline shrink-0"
                    title="Remover parada"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 bg-base-200 border-t border-base-300 space-y-2">
          <button
            onClick={onStartNavigation}
            disabled={routeList.length === 0}
            className="btn btn-secondary w-full text-white font-bold btn-sm shadow-md"
          >
            🗺️ Iniciar Navegação no Google Maps
          </button>
          <button
            onClick={onClearRoute}
            disabled={routeList.length === 0}
            className="btn btn-ghost btn-xs w-full text-gray-400 hover:text-error"
          >
            Limpar Rota
          </button>
        </div>
      </div>
    </div>
  );
}
