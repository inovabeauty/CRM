import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ClientTimeline({ clientId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interacoes')
        .select('*')
        .eq('cliente_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setTimeline(data);
      }
    } catch (err) {
      console.error('Erro ao buscar timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();

    const handleRefresh = (e) => {
      if (!e.detail?.clientId || e.detail.clientId === clientId) {
        fetchTimeline();
      }
    };

    window.addEventListener('refreshTimeline', handleRefresh);
    return () => window.removeEventListener('refreshTimeline', handleRefresh);
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <span className="loading loading-spinner text-primary loading-sm"></span>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="bg-base-200/50 p-4 rounded-xl text-center border border-dashed border-base-300">
        <span className="text-2xl block mb-1">📜</span>
        <p className="text-xs text-gray-400">
          Nenhuma interação arquivada na Linha do Tempo ainda.
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Ao registrar uma visita ou contato, cada histórico ficará gravado aqui em ordem cronológica.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400">
          📜 Linha do Tempo ({timeline.length} interações)
        </span>
        <button
          onClick={fetchTimeline}
          className="btn btn-ghost btn-xs text-[10px] text-primary"
        >
          Atualizar
        </button>
      </div>

      <div className="relative pl-6 border-l-2 border-primary/30 space-y-4">
        {timeline.map((item) => {
          const dataFormatada = item.created_at
            ? new Date(item.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Data não registrada';

          const isVisita = item.tipo?.includes('Visita');
          const isWhats = item.tipo?.includes('WhatsApp');

          return (
            <div key={item.id} className="relative group">
              {/* Ícone no eixo da timeline */}
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center text-[8px]">
                {isVisita ? '📍' : isWhats ? '💬' : '•'}
              </div>

              {/* Card do Evento */}
              <div className="bg-base-200 p-3 rounded-xl border border-base-300 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-base-content">
                      {item.tipo}
                    </span>
                    {item.motivo_objecao && (
                      <span className="badge badge-primary badge-outline badge-xs text-[10px]">
                        {item.motivo_objecao}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {dataFormatada}
                  </span>
                </div>

                {item.observacoes && (
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {item.observacoes}
                  </p>
                )}

                {item.data_retorno && (
                  <div className="text-[11px] text-accent flex items-center gap-1 mt-1 font-medium bg-accent/10 px-2 py-0.5 rounded">
                    <span>📅 Retorno previsto:</span>
                    <span>{new Date(item.data_retorno + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
