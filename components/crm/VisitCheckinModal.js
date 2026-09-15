import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { queueOfflineInteraction } from '../../lib/offlineStorage';

const QUICK_TAGS = [
  { id: 'Dona Ausente', label: '🚪 Dona Ausente', color: 'badge-ghost', status_suggested: 'prospect' },
  { id: 'Sem Limite no Cartão', label: '💳 Sem Limite no Cartão', color: 'badge-warning', status_suggested: 'negociacao' },
  { id: 'Usa Concorrente', label: '⚔️ Usa Concorrente', color: 'badge-error', status_suggested: 'prospect' },
  { id: 'Deixou Amostra', label: '🎁 Deixou Amostra / Tabela', color: 'badge-info', status_suggested: 'negociacao' },
  { id: 'Pediu Retorno', label: '📅 Pediu Retorno', color: 'badge-accent', status_suggested: 'negociacao' },
  { id: 'Fechou Pedido', label: '🎉 Fechou Pedido!', color: 'badge-success', status_suggested: 'cliente_ativo' },
  { id: 'Salão Fechou', label: '🚫 Salão Fechou / Inexistente', color: 'badge-error', status_suggested: 'nao_visitar' },
  { id: 'Outro', label: '✏️ Outro...', color: 'badge-neutral', status_suggested: null }
];

export default function VisitCheckinModal({ client, interactionType = 'Visita Realizada', isOpen, onClose, onSaveSuccess }) {
  const [selectedTag, setSelectedTag] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [statusFunil, setStatusFunil] = useState(client?.status_funil || 'prospect');
  const [linhaInteresse, setLinhaInteresse] = useState(client?.linha_interesse || '');
  const [melhorDiaCompra, setMelhorDiaCompra] = useState(client?.melhor_dia_compra || '');
  const [observacoes, setObservacoes] = useState('');
  const [dataRetorno, setDataRetorno] = useState(client?.data_retorno || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setStatusFunil(client.status_funil || 'prospect');
      setLinhaInteresse(client.linha_interesse || '');
      setMelhorDiaCompra(client.melhor_dia_compra || '');
      setDataRetorno(client.data_retorno || '');
      setSelectedTag('');
      setCustomTag('');
      setObservacoes('');
    }
  }, [client, isOpen]);

  if (!isOpen || !client) return null;

  const handleSelectTag = (tag) => {
    setSelectedTag(tag.id);
    if (tag.status_suggested) {
      setStatusFunil(tag.status_suggested);
    }
    // Se selecionou "Pediu Retorno", pré-preenche a data de retorno para 3 dias úteis se vazia
    if (tag.id === 'Pediu Retorno' && !dataRetorno) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3);
      setDataRetorno(defaultDate.toISOString().split('T')[0]);
    }
  };

  // Gerador de Link para Google Agenda
  const getGoogleCalendarUrl = () => {
    if (!dataRetorno) return null;
    const title = encodeURIComponent(`Retorno Inova Beauty: ${client.nome} (${client.responsavel || 'Contato'})`);
    const dateFormatted = dataRetorno.replace(/-/g, '');
    const dates = `${dateFormatted}T130000Z/${dateFormatted}T140000Z`;
    const details = encodeURIComponent(
      `Retorno de atendimento comercial Inova Beauty.\nSalão: ${client.nome}\nResponsável: ${client.responsavel || 'Não informado'}\nWhatsApp: ${client.whatsapp || ''}\nMotivo/Obs: ${selectedTag === 'Outro' ? customTag : selectedTag} - ${observacoes}`
    );
    const location = encodeURIComponent(`${client.endereco || ''} ${client.cidade || ''}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  const handleSave = async () => {
    setIsSaving(true);
    const motivoFinal = selectedTag === 'Outro' ? customTag : selectedTag;
    
    // Concatena tag de objeção e texto de observação para histórico completo
    const obsCompleta = motivoFinal 
      ? `[${motivoFinal}] ${observacoes}`.trim() 
      : (observacoes || '').trim();

    const payload = {
      cliente_id: client.id,
      tipo: interactionType,
      status_funil: statusFunil,
      motivo_objecao: motivoFinal || null,
      observacoes: obsCompleta,
      data_retorno: dataRetorno || null,
      linha_interesse: linhaInteresse,
      melhor_dia_compra: melhorDiaCompra
    };

    if (typeof window !== 'undefined' && !navigator.onLine) {
      // Offline mode: enfileira para envio posterior
      queueOfflineInteraction(payload);
      alert('📱 Sem conexão com a internet. O registro foi salvo no seu celular e será sincronizado assim que o sinal voltar!');
      setIsSaving(false);
      onClose();
      if (onSaveSuccess) onSaveSuccess({ ...client, ...payload });
      return;
    }

    try {
      // 1. Grava na nova tabela de interacoes (Timeline)
      await supabase.from('interacoes').insert({
        cliente_id: client.id,
        tipo: interactionType,
        status_funil: statusFunil,
        motivo_objecao: motivoFinal || null,
        observacoes: obsCompleta,
        data_retorno: dataRetorno || null
      });

      // 2. Atualiza ficha principal do cliente
      const { error } = await supabase.from('clientes').update({
        data_ultima_interacao: new Date().toISOString(),
        tipo_ultima_interacao: interactionType,
        observacoes: obsCompleta,
        status_funil: statusFunil,
        linha_interesse: linhaInteresse,
        melhor_dia_compra: melhorDiaCompra ? parseInt(melhorDiaCompra) : null,
        data_retorno: dataRetorno || null
      }).eq('id', client.id);

      if (!error) {
        window.dispatchEvent(new Event('refreshMap'));
        window.dispatchEvent(new CustomEvent('refreshTimeline', { detail: { clientId: client.id } }));
        if (onSaveSuccess) {
          onSaveSuccess({
            ...client,
            data_ultima_interacao: new Date().toISOString(),
            tipo_ultima_interacao: interactionType,
            observacoes: obsCompleta,
            status_funil: statusFunil,
            linha_interesse: linhaInteresse,
            melhor_dia_compra: melhorDiaCompra,
            data_retorno: dataRetorno
          });
        }
        onClose();
      } else {
        alert('Erro ao salvar no banco: ' + error.message);
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado. Salvando em cache local de segurança.');
      queueOfflineInteraction(payload);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const calendarUrl = getGoogleCalendarUrl();

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center z-[99999] p-2 md:p-4">
      <div className="bg-base-100 w-full max-w-lg rounded-2xl md:rounded-3xl shadow-2xl border border-base-300 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="p-4 bg-base-200/80 border-b border-base-300 flex justify-between items-center">
          <div>
            <span className="badge badge-primary badge-sm font-bold">{interactionType}</span>
            <h2 className="text-base md:text-lg font-bold text-base-content mt-0.5">
              Check-in no {client.nome}
            </h2>
            <p className="text-xs text-gray-500">
              {client.responsavel ? `Dona: ${client.responsavel} • ` : ''}{client.cidade}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>

        {/* Formulário com Scroll */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* Seção 1: Quick Tags de 1 Toque */}
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">
              ⚡ Resultado / Objeção Rápida (1 Toque):
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.map((tag) => {
                const isSelected = selectedTag === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleSelectTag(tag)}
                    className={`btn btn-xs rounded-lg transition-all ${
                      isSelected
                        ? 'btn-primary font-bold shadow-md scale-105'
                        : 'btn-outline border-base-300 hover:border-primary'
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>

            {/* Campo "Outro" Digitável */}
            {selectedTag === 'Outro' && (
              <div className="mt-2 animate-in fade-in duration-150">
                <input
                  type="text"
                  placeholder="Digite a objeção ou motivo específico..."
                  className="input input-bordered input-sm w-full text-xs"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Aviso de Inativação Definitiva */}
            {selectedTag === 'Salão Fechou' && (
              <div className="mt-2 p-2.5 rounded-xl bg-error/15 border border-error/40 text-xs text-error animate-in fade-in duration-150 flex items-start gap-2">
                <span className="text-base shrink-0">🚫</span>
                <div>
                  <strong className="block font-bold">Salão será inativado da base:</strong>
                  <span className="text-[11px] text-gray-300">Ao salvar o check-in, este salão será marcado como &quot;Não Visitar&quot; e ocultado imediatamente do mapa e das rotas de vendas.</span>
                </div>
              </div>
            )}
          </div>

          {/* Seção 2: Sincronização Google Agenda se pediu retorno */}
          {selectedTag === 'Pediu Retorno' && (
            <div className="bg-primary/10 border border-primary/30 p-3 rounded-xl space-y-2 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1">
                  📅 Sincronização de Retorno
                </span>
                {calendarUrl && (
                  <a
                    href={calendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-xs btn-primary gap-1"
                  >
                    <span>📆</span> Agendar no Google Agenda
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 shrink-0">Data do Retorno:</label>
                <input
                  type="date"
                  className="input input-bordered input-xs flex-1 text-xs"
                  value={dataRetorno}
                  onChange={(e) => setDataRetorno(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-gray-400 leading-tight">
                Toque em &quot;Agendar no Google Agenda&quot; para adicionar o lembrete direto com o telefone e dados do salão.
              </p>
            </div>
          )}

          {/* Seção 3: Status do Funil & Linha de Interesse */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs font-bold">Status Funil</span></label>
              <select
                className="select select-bordered select-sm w-full text-xs"
                value={statusFunil}
                onChange={(e) => setStatusFunil(e.target.value)}
              >
                <option value="prospect">🔵 Prospect</option>
                <option value="negociacao">🟡 Negociação</option>
                <option value="cliente_ativo">🟢 Cliente Ativo</option>
                <option value="alerta_resgate">🔴 Alerta de Resgate</option>
                <option value="nao_visitar">⚫ Não Visitar</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs font-bold">Linha de Interesse</span></label>
              <select
                className="select select-bordered select-sm w-full text-xs"
                value={linhaInteresse}
                onChange={(e) => setLinhaInteresse(e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="Olenka">Olenka</option>
                <option value="Mup Collor">Mup Collor</option>
                <option value="Mup Makeup">Mup Makeup</option>
                <option value="Misto">Misto (Full Inova)</option>
              </select>
            </div>
          </div>

          {/* Seção 4: Dia do Cartão & Agendamento de Retorno */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text text-xs font-bold">💳 Dia do Cartão</span></label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 15"
                className="input input-bordered input-sm w-full text-xs"
                value={melhorDiaCompra}
                onChange={(e) => setMelhorDiaCompra(e.target.value)}
              />
            </div>

            {selectedTag !== 'Pediu Retorno' && (
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs font-bold">Data de Retorno</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full text-xs"
                  value={dataRetorno}
                  onChange={(e) => setDataRetorno(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Seção 5: Observações Livres */}
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs font-bold">Detalhes & Observações</span></label>
            <textarea
              className="textarea textarea-bordered h-20 text-xs"
              placeholder="Ex: Gostou do botox, mas a dona estava atendendo noiva. Pediu para voltar na virada do cartão..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

        </div>

        {/* Rodapé com Ações */}
        <div className="p-3 bg-base-200/90 border-t border-base-300 flex gap-2 shrink-0">
          <button onClick={onClose} className="btn btn-sm btn-ghost flex-1">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-sm btn-primary flex-1 font-bold shadow-md"
          >
            {isSaving ? <span className="loading loading-spinner loading-xs"></span> : 'Salvar Registro'}
          </button>
        </div>

      </div>
    </div>
  );
}
