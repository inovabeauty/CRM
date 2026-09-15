import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function DailyReportModal({ isOpen, onClose, selectedCity }) {
  const [loading, setLoading] = useState(true);
  const [todayInteractions, setTodayInteractions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [customConsultantName, setCustomConsultantName] = useState('Consultor Inova');

  useEffect(() => {
    if (!isOpen) return;

    async function loadTodayReport() {
      setLoading(true);
      try {
        const todayIso = new Date().toISOString().split('T')[0];
        
        // 1. Busca interações de hoje na tabela interacoes
        const { data: interacoes, error } = await supabase
          .from('interacoes')
          .select('*, clientes(nome, cidade, responsavel, whatsapp)')
          .gte('created_at', `${todayIso}T00:00:00.000Z`)
          .order('created_at', { ascending: false });

        if (!error && interacoes && interacoes.length > 0) {
          setTodayInteractions(interacoes);
        } else {
          // Fallback buscando em clientes com data_ultima_interacao de hoje
          const { data: clientesHoje } = await supabase
            .from('clientes')
            .select('id, nome, cidade, responsavel, whatsapp, data_ultima_interacao, tipo_ultima_interacao, observacoes, data_retorno, status_funil')
            .gte('data_ultima_interacao', `${todayIso}T00:00:00`)
            .order('data_ultima_interacao', { ascending: false });

          if (clientesHoje) {
            setTodayInteractions(
              clientesHoje.map(c => ({
                id: c.id,
                tipo: c.tipo_ultima_interacao || 'Visita Realizada',
                observacoes: c.observacoes,
                data_retorno: c.data_retorno,
                status_funil: c.status_funil,
                created_at: c.data_ultima_interacao,
                clientes: {
                  nome: c.nome,
                  cidade: c.cidade,
                  responsavel: c.responsavel,
                  whatsapp: c.whatsapp
                }
              }))
            );
          }
        }
      } catch (err) {
        console.error('Erro ao compilar relatório diário:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTodayReport();
  }, [isOpen]);

  if (!isOpen) return null;

  // Cálculos de Resumo
  const totalAtendimentos = todayInteractions.length;
  const pedidosFechados = todayInteractions.filter(i => 
    i.motivo_objecao?.toLowerCase().includes('fechou') || i.observacoes?.toLowerCase().includes('fechou') || i.status_funil === 'cliente_ativo'
  ).length;

  const retornosAgendados = todayInteractions.filter(i => 
    i.motivo_objecao?.toLowerCase().includes('retorno') || i.data_retorno
  ).length;

  const amostrasEntregues = todayInteractions.filter(i => 
    i.motivo_objecao?.toLowerCase().includes('amostra') || i.observacoes?.toLowerCase().includes('amostra')
  ).length;

  const donasAusentes = todayInteractions.filter(i => 
    i.motivo_objecao?.toLowerCase().includes('ausente') || i.observacoes?.toLowerCase().includes('ausente')
  ).length;

  const semLimite = todayInteractions.filter(i => 
    i.motivo_objecao?.toLowerCase().includes('limite') || i.observacoes?.toLowerCase().includes('limite')
  ).length;

  const dataHojeFormatada = new Date().toLocaleDateString('pt-BR');

  const getReportText = () => {
    let text = `📊 *FECHAMENTO DIÁRIO DE CAMPO - INOVA BEAUTY*
📅 *Data:* ${dataHojeFormatada}
👤 *Consultor:* ${customConsultantName}
📍 *Região:* ${selectedCity || 'Geral (Rotas de Campo)'}

📈 *RESUMO DAS ATIVIDADES:*
• *Total de Salões Atendidos:* ${totalAtendimentos}
• 🎉 *Pedidos Fechados:* ${pedidosFechados}
• 📅 *Retornos Agendados:* ${retornosAgendados}
• 🎁 *Amostras / Lâminas Deixadas:* ${amostrasEntregues}
• 🚪 *Donas Ausentes:* ${donasAusentes}
• 💳 *Sem Limite no Cartão (Aguardando Virada):* ${semLimite}

📋 *DETALHAMENTO DOS SALÕES:*`;

    if (todayInteractions.length === 0) {
      text += `\nNenhuma visita ou interação registrada com a data de hoje ainda.`;
    } else {
      todayInteractions.forEach((item, idx) => {
        const nomeSalao = item.clientes?.nome || 'Salão';
        const cidadeSalao = item.clientes?.cidade ? ` (${item.clientes.cidade})` : '';
        const tag = item.motivo_objecao ? ` [${item.motivo_objecao}]` : '';
        const retorno = item.data_retorno ? ` -> Retorno: ${new Date(item.data_retorno + 'T12:00:00').toLocaleDateString('pt-BR')}` : '';
        text += `\n${idx + 1}. *${nomeSalao}*${cidadeSalao}${tag}${retorno}`;
      });
    }

    text += `\n\n✅ *Fechamento concluído via CRM Inova de Campo.*`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(getReportText())}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center z-[99999] p-2 md:p-4 animate-in fade-in duration-200">
      <div className="bg-base-100 w-full max-w-xl rounded-2xl md:rounded-3xl shadow-2xl border border-base-300 max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="p-4 bg-base-200/90 border-b border-base-300 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📤</span>
              <h2 className="text-base md:text-lg font-bold text-base-content">
                Fechamento Diário de Campo
              </h2>
              <span className="badge badge-primary badge-sm font-mono text-[10px]">1 Toque</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Relatório compilado do dia: <strong className="text-primary">{dataHojeFormatada}</strong>
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* Nome do Consultor */}
          <div className="bg-base-200 p-3 rounded-xl border border-base-300 flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-400 shrink-0">Nome do Consultor:</label>
            <input
              type="text"
              className="input input-bordered input-xs flex-1 text-xs font-bold"
              value={customConsultantName}
              onChange={(e) => setCustomConsultantName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>

          {/* Cards de Métricas do Dia */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-base-200 p-2.5 rounded-xl border border-base-300 text-center">
              <span className="text-[10px] text-gray-400 block">Total de Visitas</span>
              <span className="text-lg font-extrabold text-primary">{totalAtendimentos}</span>
            </div>
            <div className="bg-success/15 p-2.5 rounded-xl border border-success/30 text-center">
              <span className="text-[10px] text-success block">Pedidos Fechados</span>
              <span className="text-lg font-extrabold text-success">{pedidosFechados}</span>
            </div>
            <div className="bg-accent/15 p-2.5 rounded-xl border border-accent/30 text-center">
              <span className="text-[10px] text-accent block">Retornos Agendados</span>
              <span className="text-lg font-extrabold text-accent">{retornosAgendados}</span>
            </div>
          </div>

          {/* Pré-visualização do Relatório para WhatsApp */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold text-gray-400">
                Pré-visualização do Texto Formatado:
              </span>
              <span className="text-[10px] text-gray-500">Pronto para grupo de WhatsApp</span>
            </div>

            {loading ? (
              <div className="flex justify-center p-8 bg-base-200 rounded-xl">
                <span className="loading loading-spinner text-primary loading-sm"></span>
              </div>
            ) : (
              <div className="bg-[#0b141a] text-[#e9edef] p-3.5 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed border border-[#222e35] max-h-56 overflow-y-auto">
                {getReportText()}
              </div>
            )}
          </div>

        </div>

        {/* Rodapé com Ações */}
        <div className="p-3 bg-base-200/95 border-t border-base-300 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            onClick={handleShareWhatsApp}
            className="btn btn-sm btn-success text-white w-full sm:w-auto sm:flex-1 font-bold shadow-md gap-1.5 text-xs order-1 sm:order-3"
          >
            <span>📲</span> Enviar no WhatsApp
          </button>
          <div className="flex gap-2 w-full sm:w-auto sm:flex-1 order-2 sm:order-1">
            <button onClick={onClose} className="btn btn-sm btn-ghost flex-1 text-xs">
              Fechar
            </button>
            <button
              onClick={handleCopy}
              className="btn btn-sm btn-outline btn-primary flex-1 text-xs"
            >
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
