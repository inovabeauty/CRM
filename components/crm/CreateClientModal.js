import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { parseCoordinatesInput, getGoogleMapsUrl, formatCoordinates } from '../../lib/geoUtils';

const DEFAULT_CITIES = [
  'Caxias',
  'Bacabal',
  'Timon',
  'Codó',
  'São Luís',
  'Barra do Corda',
  'Presidente Dutra',
  'Pedreiras',
  'Lago da Pedra',
  'Coelho Neto',
  'Matões',
  'Parnarama'
];

export default function CreateClientModal({
  isOpen,
  onClose,
  initialData = {},
  onCreatedSuccess
}) {
  const [form, setForm] = useState({});
  const [smartCoordsInput, setSmartCoordsInput] = useState('');
  const [parseFeedback, setParseFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialLat = initialData.lat || initialData.latitude || '';
      const initialLng = initialData.lng || initialData.longitude || '';
      const hasInitialCoords = Boolean(initialLat && initialLng);

      setForm({
        latitude: initialLat ? Number(initialLat).toFixed(6) : '',
        longitude: initialLng ? Number(initialLng).toFixed(6) : '',
        status_funil: 'prospect',
        categorias: '{"Salão de Beleza"}',
        cidade: initialData.cidade || 'Caxias',
        nome: '',
        responsavel: '',
        whatsapp: '',
        endereco: '',
        localizacao_pendente: hasInitialCoords ? false : true
      });
      setSmartCoordsInput(hasInitialCoords ? formatCoordinates(initialLat, initialLng) : '');
      setParseFeedback(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleApplySmartCoords = (textToParse) => {
    const target = textToParse !== undefined ? textToParse : smartCoordsInput;
    if (!target || !target.trim()) {
      setParseFeedback({
        type: 'warning',
        message: 'Cole coordenadas ou o link do Google Maps para extrair.'
      });
      return;
    }

    const parsed = parseCoordinatesInput(target);
    if (parsed.success) {
      setForm((prev) => ({
        ...prev,
        latitude: parsed.lat.toString(),
        longitude: parsed.lng.toString(),
        localizacao_pendente: false
      }));
      setParseFeedback({
        type: 'success',
        message: `📍 Posição extraída com sucesso (${parsed.lat}, ${parsed.lng})!${
          parsed.wasInverted ? ' ⚡ Inversão Lat/Long corrigida automaticamente.' : ''
        }`
      });
    } else {
      setParseFeedback({
        type: 'error',
        message: parsed.error || 'Formato não reconhecido.'
      });
    }
  };

  const handleSmartInputChange = (e) => {
    const val = e.target.value;
    setSmartCoordsInput(val);
    if (val.includes('maps') || val.includes(',') || val.includes(';') || val.includes('@')) {
      handleApplySmartCoords(val);
    } else if (!val.trim()) {
      setParseFeedback(null);
    }
  };

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      alert('O nome do salão é obrigatório!');
      return;
    }

    const latNum = form.latitude ? parseFloat(form.latitude) : null;
    const lngNum = form.longitude ? parseFloat(form.longitude) : null;

    setIsSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        responsavel: form.responsavel?.trim() || null,
        whatsapp: form.whatsapp?.trim() || null,
        cidade: form.cidade,
        categorias: form.categorias,
        latitude: latNum,
        longitude: lngNum,
        status_funil: form.status_funil,
        endereco: form.endereco?.trim() || 'Cadastrado no CRM',
        localizacao_pendente: form.localizacao_pendente ?? (latNum && lngNum ? false : true)
      };

      const { data, error } = await supabase
        .from('clientes')
        .insert([payload])
        .select()
        .single();

      if (!error) {
        window.dispatchEvent(new Event('refreshMap'));
        if (onCreatedSuccess) onCreatedSuccess(data || payload);
        onClose();
      } else {
        alert('Erro ao cadastrar novo salão: ' + error.message);
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado na conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasValidCoords = Boolean(form.latitude && form.longitude && !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude)));

  return (
    <div className="absolute bottom-0 left-0 w-full bg-base-100 rounded-t-3xl shadow-[0_-15px_50px_rgba(0,0,0,0.5)] p-4 md:p-6 pb-8 md:pb-6 z-[1000] max-h-[90vh] overflow-y-auto transition-transform duration-300 border-t border-base-300">
      <div className="w-12 h-1 rounded-full bg-base-300 mx-auto -mt-1 mb-3 shrink-0"></div>
      
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <div>
            <h2 className="text-base md:text-lg font-bold text-success leading-tight">Cadastrar Novo Salão</h2>
            <p className="text-[11px] text-base-content/60">Adicione no escritório ou em campo com localização exata</p>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
      </div>

      <div className="space-y-3">
        {/* Nome do Salão */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-bold text-xs">Nome do Salão *</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Studio VIP Elegance"
            className="input input-sm input-bordered w-full text-xs font-semibold"
            value={form.nome || ''}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            autoFocus
          />
        </div>

        {/* Responsável e WhatsApp */}
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs">Responsável (Dona)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Joana"
              className="input input-sm input-bordered w-full text-xs"
              value={form.responsavel || ''}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs">WhatsApp</span>
            </label>
            <input
              type="text"
              placeholder="Ex: 5599981002000"
              className="input input-sm input-bordered w-full text-xs"
              value={form.whatsapp || ''}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </div>
        </div>

        {/* Cidade e Nicho */}
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs">Cidade *</span>
            </label>
            <select
              className="select select-sm select-bordered w-full text-xs font-medium"
              value={form.cidade || 'Caxias'}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            >
              {DEFAULT_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-xs">Nicho Primário</span>
            </label>
            <select
              className="select select-sm select-bordered w-full text-xs"
              value={form.categorias || '{"Salão de Beleza"}'}
              onChange={(e) => setForm({ ...form, categorias: e.target.value })}
            >
              <option value='{"Salão de Beleza"}'>Salão de Beleza</option>
              <option value='{"Maquiagem"}'>Maquiagem</option>
              <option value='{"Barbearia"}'>Barbearia</option>
              <option value='{"Clínica de Estética"}'>Estética</option>
            </select>
          </div>
        </div>

        {/* Endereço Descritivo (Opcional) */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text font-bold text-xs">Endereço (Rua, Número, Bairro)</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Rua São Pedro, 150, Centro"
            className="input input-sm input-bordered w-full text-xs"
            value={form.endereco || ''}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
          />
        </div>

        {/* BLOCO DE GEOLOCALIZAÇÃO INTELIGENTE & PREVIEW */}
        <div className="bg-base-200/80 p-3.5 rounded-2xl border border-base-300 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-base-content/80 flex items-center gap-1.5">
              <span>🎯</span> Coordenadas & Localização Exata
            </span>
            {hasValidCoords ? (
              <span className="badge badge-success badge-xs font-bold text-white gap-1 py-2">
                ✓ Ponto Definido
              </span>
            ) : (
              <span className="badge badge-warning badge-xs font-medium gap-1 py-2">
                ⚠️ Sem Coordenadas
              </span>
            )}
          </div>

          {/* Campo Inteligente: Colar Coordenadas ou Link do Google Maps */}
          <div className="form-control">
            <div className="join w-full">
              <input
                type="text"
                placeholder="Cole link do Maps ou coordenadas (-4.862415, -43.356210)"
                className="input input-sm input-bordered join-item w-full text-xs font-mono"
                value={smartCoordsInput}
                onChange={handleSmartInputChange}
              />
              <button
                type="button"
                onClick={() => handleApplySmartCoords()}
                className="btn btn-sm btn-primary join-item text-xs font-bold shrink-0"
                title="Extrair coordenadas do texto ou link"
              >
                Extrair
              </button>
            </div>
            <label className="label py-0.5">
              <span className="label-text-alt text-[10px] text-base-content/60">
                💡 Aceita coordenadas copiadas do Google Maps ou links compartilhados no WhatsApp
              </span>
            </label>
          </div>

          {/* Feedback do Parser */}
          {parseFeedback && (
            <div
              className={`p-2 rounded-xl text-xs flex items-center gap-1.5 animate-in fade-in duration-150 ${
                parseFeedback.type === 'success'
                  ? 'bg-success/15 border border-success/30 text-success'
                  : parseFeedback.type === 'warning'
                  ? 'bg-warning/15 border border-warning/30 text-warning'
                  : 'bg-error/15 border border-error/30 text-error'
              }`}
            >
              <span>{parseFeedback.type === 'success' ? '✓' : '⚠️'}</span>
              <span className="text-[11px] leading-tight">{parseFeedback.message}</span>
            </div>
          )}

          {/* Inputs de Latitude e Longitude para ajuste fino manual */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="form-control">
              <label className="label py-0.5">
                <span className="label-text font-bold text-[11px]">Latitude</span>
              </label>
              <input
                type="text"
                placeholder="Ex: -4.862415"
                className="input input-xs input-bordered w-full font-mono text-[11px]"
                value={form.latitude || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, latitude: val });
                }}
              />
            </div>
            <div className="form-control">
              <label className="label py-0.5">
                <span className="label-text font-bold text-[11px]">Longitude</span>
              </label>
              <input
                type="text"
                placeholder="Ex: -43.356210"
                className="input input-xs input-bordered w-full font-mono text-[11px]"
                value={form.longitude || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, longitude: val });
                }}
              />
            </div>
          </div>

          {/* Pré-visualização Instantânea do Ponto */}
          {hasValidCoords && (
            <div className="pt-1 flex items-center justify-between gap-2 border-t border-base-300/60">
              <div className="text-[11px] text-base-content/70 font-mono truncate">
                📍 {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
              </div>
              <a
                href={getGoogleMapsUrl(form.latitude, form.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-outline btn-info gap-1 rounded-xl font-bold shrink-0 shadow-2xs"
                title="Abre nova aba com o ponto exato no Google Maps para confirmação visual"
              >
                <span>👁️</span> Testar no Google Maps
              </a>
            </div>
          )}

          {/* Seletor de Status da Localização (Exata vs Pendente) */}
          <div className="pt-2 border-t border-base-300/60">
            <span className="text-[11px] font-bold block mb-1 text-base-content/70">
              Status da Localização:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, localizacao_pendente: false })}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  !form.localizacao_pendente
                    ? 'bg-success/20 border-success text-success shadow-xs'
                    : 'bg-base-100 border-base-300 text-base-content/60 hover:bg-base-200'
                }`}
              >
                <span>🟢</span> Exata (Confirmada)
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, localizacao_pendente: true })}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  form.localizacao_pendente
                    ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400 shadow-xs'
                    : 'bg-base-100 border-base-300 text-base-content/60 hover:bg-base-200'
                }`}
              >
                <span>🟡</span> Pendente em Campo
              </button>
            </div>
          </div>
        </div>

        {/* Ações de Fechamento */}
        <div className="flex gap-3 mt-4 pt-3 border-t border-base-200">
          <button onClick={onClose} className="btn btn-ghost btn-sm flex-1">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-success btn-sm flex-1 text-white font-bold shadow-md"
          >
            {isSaving ? <span className="loading loading-spinner loading-xs"></span> : 'Salvar Novo Salão'}
          </button>
        </div>
      </div>
    </div>
  );
}
