import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import ClientTimeline from './ClientTimeline';
import { getCategoryEmoji } from '../../lib/categoryUtils';
import { parseCoordinatesInput, getGoogleMapsUrl, formatCoordinates } from '../../lib/geoUtils';

export default function ClientDrawer({
  client,
  onClose,
  onUpdateClient,
  onAddToRoute,
  isClientInRoute = false,
  onOpenWhatsAppScripts,
  onOpenCheckin,
  onOpenProfitCalculator,
  onStartRepositionPin
}) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [editSmartCoordsInput, setEditSmartCoordsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingFunnel, setIsUpdatingFunnel] = useState(false);
  const [funnelFeedback, setFunnelFeedback] = useState(null);
  const [isFixingGps, setIsFixingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState(null);
  const [activeTab, setActiveTab] = useState('dados'); // 'dados' | 'timeline' | 'erp'

  if (!client) return null;

  // Handler para fixar localização com o GPS atual do consultor
  const handleFixCurrentGPS = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Geolocalização não disponível no seu dispositivo.');
      return;
    }

    setIsFixingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;

        const { error } = await supabase
          .from('clientes')
          .update({
            latitude: newLat,
            longitude: newLng,
            localizacao_pendente: false
          })
          .eq('id', client.id);

        if (!error) {
          const updated = { ...client, latitude: newLat, longitude: newLng, localizacao_pendente: false };
          if (onUpdateClient) onUpdateClient(updated);
          window.dispatchEvent(new Event('refreshMap'));
          alert('📍 Localização exata do salão fixada com sucesso na sua posição atual!');
        } else {
          alert('Erro ao atualizar coordenadas: ' + error.message);
        }
        setIsFixingGps(false);
      },
      (err) => {
        alert('Não foi possível obter sua localização GPS. Verifique a permissão no navegador: ' + err.message);
        setIsFixingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handler para troca rápida de funil com 1 toque
  const handleQuickFunnelChange = async (newStatus) => {
    if (client.status_funil === newStatus || isUpdatingFunnel) return;
    setIsUpdatingFunnel(true);

    const updatedClient = { ...client, status_funil: newStatus };
    if (onUpdateClient) onUpdateClient(updatedClient);

    try {
      const { error } = await supabase
        .from('clientes')
        .update({ status_funil: newStatus })
        .eq('id', client.id);

      if (!error) {
        window.dispatchEvent(new Event('refreshMap'));
        if (newStatus === 'cliente_ativo') {
          setFunnelFeedback('🎉 Promovido a Cliente Ativo!');
        } else if (newStatus === 'negociacao') {
          setFunnelFeedback('🟡 Colocado em Negociação!');
        } else if (newStatus === 'alerta_resgate') {
          setFunnelFeedback('🔴 Marcado para Resgate.');
        } else {
          setFunnelFeedback('🔵 Marcado como Prospect.');
        }
        setTimeout(() => setFunnelFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Erro ao atualizar funil:', err);
    } finally {
      setIsUpdatingFunnel(false);
    }
  };

  // Linhas de Interesse (Olenka x MUP Collor x Mup Makeup)
  const currentLinhas = (client.linha_interesse || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const hasOlenka = currentLinhas.some((s) => s.includes('olenka'));
  const hasMakeup = currentLinhas.some((s) => s.includes('makeup') || s.includes('make up') || s.includes('maquiagem'));
  const hasMup = currentLinhas.some((s) => s.includes('mup collor') || (s.includes('mup') && !s.includes('makeup')));

  const handleToggleBrand = async (brand) => {
    let nextOlenka = hasOlenka;
    let nextMup = hasMup;
    let nextMakeup = hasMakeup;

    if (brand === 'Olenka') nextOlenka = !nextOlenka;
    if (brand === 'MUP') nextMup = !nextMup;
    if (brand === 'Makeup') nextMakeup = !nextMakeup;

    const parts = [];
    if (nextOlenka) parts.push('Olenka Cosméticos');
    if (nextMup) parts.push('MUP Collor');
    if (nextMakeup) parts.push('Mup Makeup');
    const newLinha = parts.join(', ');

    const updated = { ...client, linha_interesse: newLinha };
    if (onUpdateClient) onUpdateClient(updated);

    await supabase.from('clientes').update({ linha_interesse: newLinha }).eq('id', client.id);
    window.dispatchEvent(new Event('refreshMap'));
  };

  const handleStartEditProfile = () => {
    const rawCats = Array.isArray(client.categorias)
      ? client.categorias
      : typeof client.categorias === 'string'
      ? client.categorias.replace(/[{""}]/g, '').split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    setGeocodeResult(null);
    setProfileForm({
      ...client,
      endereco: client.endereco || '',
      cidade: client.cidade || 'Caxias',
      latitude: client.latitude != null ? client.latitude.toString() : '',
      longitude: client.longitude != null ? client.longitude.toString() : '',
      localizacao_pendente: client.localizacao_pendente ?? false,
      categoriasList: rawCats
    });
    setEditSmartCoordsInput(
      client.latitude && client.longitude
        ? formatCoordinates(client.latitude, client.longitude)
        : ''
    );
    setIsEditingProfile(true);
  };

  const handleApplyEditSmartCoords = (textToParse) => {
    const target = textToParse !== undefined ? textToParse : editSmartCoordsInput;
    if (!target || !target.trim()) {
      setGeocodeResult({
        success: false,
        message: 'Cole coordenadas ou o link do Google Maps para extrair.'
      });
      return;
    }

    const parsed = parseCoordinatesInput(target);
    if (parsed.success) {
      setProfileForm((prev) => ({
        ...prev,
        latitude: parsed.lat.toString(),
        longitude: parsed.lng.toString(),
        localizacao_pendente: false
      }));
      setGeocodeResult({
        success: true,
        message: `📍 Posição extraída com sucesso (${parsed.lat}, ${parsed.lng})!${
          parsed.wasInverted ? ' ⚡ Inversão Lat/Long corrigida automaticamente.' : ''
        }`
      });
    } else {
      setGeocodeResult({
        success: false,
        message: parsed.error || 'Formato não reconhecido.'
      });
    }
  };

  // Busca automática de latitude/longitude pelo endereço digitado via OpenStreetMap
  const handleSearchCoordinates = async () => {
    if (!profileForm.endereco || !profileForm.endereco.trim()) {
      alert('Digite o endereço (rua, número ou bairro) para buscar as coordenadas.');
      return;
    }

    setIsGeocoding(true);
    setGeocodeResult(null);
    try {
      const city = profileForm.cidade || client.cidade || 'Caxias';
      const query = `${profileForm.endereco}, ${city}, Maranhão, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setProfileForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          localizacao_pendente: false
        }));
        setGeocodeResult({
          success: true,
          message: `📍 Localizado no mapa com sucesso (${lat.toFixed(4)}, ${lon.toFixed(4)})!`
        });
      } else {
        setGeocodeResult({
          success: false,
          message: '⚠️ Endereço exato não encontrado. Você pode usar o botão "Mover no Mapa" para posicionar visualmente.'
        });
      }
    } catch (err) {
      setGeocodeResult({
        success: false,
        message: 'Erro na busca de coordenadas: ' + err.message
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    let categoriasPg = profileForm.categorias;
    let categoriasParaOFront = profileForm.categorias;
    if (profileForm.categoriasList !== undefined) {
      const items = profileForm.categoriasList.filter(Boolean);
      categoriasPg = items.length > 0 ? `{${items.map((c) => `"${c}"`).join(',')}}` : null;
      categoriasParaOFront = items;
    }

    const latNum = profileForm.latitude ? parseFloat(profileForm.latitude) : null;
    const lngNum = profileForm.longitude ? parseFloat(profileForm.longitude) : null;
    const pendente = profileForm.localizacao_pendente ?? (latNum && lngNum ? false : true);

    const { error } = await supabase
      .from('clientes')
      .update({
        nome: profileForm.nome,
        responsavel: profileForm.responsavel,
        whatsapp: profileForm.whatsapp,
        telefone_alternativo: profileForm.telefone_alternativo,
        instagram: profileForm.instagram,
        categorias: categoriasPg,
        endereco: profileForm.endereco,
        cidade: profileForm.cidade,
        latitude: latNum,
        longitude: lngNum,
        localizacao_pendente: pendente
      })
      .eq('id', profileForm.id);

    if (!error) {
      window.dispatchEvent(new Event('refreshMap'));
      const updated = {
        ...profileForm,
        latitude: latNum,
        longitude: lngNum,
        categorias: categoriasParaOFront,
        localizacao_pendente: pendente
      };
      onUpdateClient(updated);
      setIsEditingProfile(false);
    } else {
      alert('Erro ao atualizar dados: ' + error.message);
    }
    setIsSaving(false);
  };

  const handleInactivateDirect = async () => {
    if (window.confirm(`Tem certeza que o salão "${client.nome}" fechou ou não existe mais?\n\nEle será inativado e removido imediatamente do mapa de visitas.`)) {
      await supabase.from('clientes').update({ status_funil: 'nao_visitar' }).eq('id', client.id);
      window.dispatchEvent(new Event('refreshMap'));
      onClose();
    }
  };

  const handleInactivate = async () => {
    if (window.confirm('Tem certeza que deseja inativar e ocultar este salão do mapa?')) {
      await supabase.from('clientes').update({ status_funil: 'nao_visitar' }).eq('id', client.id);
      window.dispatchEvent(new Event('refreshMap'));
      onClose();
    }
  };

  const handleReactivate = async () => {
    if (window.confirm('Tem certeza que deseja reativar este salão? Ele voltará para o status de Prospect.')) {
      await supabase.from('clientes').update({ status_funil: 'prospect' }).eq('id', client.id);
      window.dispatchEvent(new Event('refreshMap'));
      onClose();
    }
  };

  const handleDirectWhatsApp = () => {
    const rawPhone = (client.whatsapp || client.telefone || client.telefone_alternativo || '').toString().replace(/\D/g, '');
    if (!rawPhone) {
      alert('Este salão ainda não possui WhatsApp ou telefone cadastrado.\n\nClique no botão de lápis (editar) para adicionar o contato.');
      return;
    }
    const phone = !rawPhone.startsWith('55') && rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const rawCategorias = Array.isArray(client.categorias)
    ? client.categorias
    : typeof client.categorias === 'string'
    ? client.categorias.replace(/[{""}]/g, '').split(',').map((c) => c.trim()).filter(Boolean)
    : [];

  const diasSemCompra = client.data_ultima_compra
    ? Math.floor((new Date() - new Date(client.data_ultima_compra)) / (1000 * 60 * 60 * 24))
    : null;

  const hasCoordinates = Boolean(client.latitude && client.longitude);
  const destinationQuery = hasCoordinates
    ? `${client.latitude},${client.longitude}`
    : encodeURIComponent(`${client.endereco || client.nome}, ${client.cidade || 'Caxias'}`);

  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`;

  const wazeUrl = hasCoordinates
    ? `https://waze.com/ul?ll=${client.latitude},${client.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${destinationQuery}&navigate=yes`;

  const handleCloseDrawer = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    onClose();
  };

  return (
    <div className="absolute bottom-0 left-0 w-full bg-base-100 rounded-t-3xl shadow-[0_-15px_50px_rgba(0,0,0,0.5)] p-4 md:p-6 pb-8 md:pb-6 z-[1000] max-h-[88vh] overflow-y-auto transition-transform duration-300 border-t border-base-300">
      
      {/* MODO EDIÇÃO DE PERFIL */}
      {isEditingProfile ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-primary">Editar Cadastro do Salão</h2>
            <button
              onClick={() => setIsEditingProfile(false)}
              className="w-10 h-10 rounded-full bg-base-200/80 hover:bg-base-300 text-base-content/70 hover:text-base-content flex items-center justify-center text-lg font-bold transition-all active:scale-90 shrink-0 border border-base-300"
              title="Fechar edição"
              aria-label="Fechar edição"
            >
              ✕
            </button>
          </div>

          <div className="form-control">
            <label className="label py-1"><span className="label-text font-bold text-xs">Nome do Salão</span></label>
            <input
              type="text"
              className="input input-sm input-bordered w-full"
              value={profileForm.nome || ''}
              onChange={(e) => setProfileForm({ ...profileForm, nome: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text font-bold text-xs">Responsável (Dona)</span></label>
              <input
                type="text"
                placeholder="Ex: Maria"
                className="input input-sm input-bordered w-full"
                value={profileForm.responsavel || ''}
                onChange={(e) => setProfileForm({ ...profileForm, responsavel: e.target.value })}
              />
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text font-bold text-xs">WhatsApp Real</span></label>
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                value={profileForm.whatsapp || ''}
                onChange={(e) => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1"><span className="label-text font-bold text-xs">Instagram</span></label>
              <input
                type="text"
                placeholder="Ex: @salaorealce"
                className="input input-sm input-bordered w-full"
                value={profileForm.instagram || ''}
                onChange={(e) => setProfileForm({ ...profileForm, instagram: e.target.value })}
              />
            </div>
            <div className="form-control">
              <label className="label py-1"><span className="label-text font-bold text-xs">Telefone Alternativo</span></label>
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                value={profileForm.telefone_alternativo || ''}
                onChange={(e) => setProfileForm({ ...profileForm, telefone_alternativo: e.target.value })}
              />
            </div>
          </div>

          {/* Endereço e Geolocalização Avançada */}
          <div className="bg-base-200/80 p-3.5 rounded-2xl border border-base-300 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-base-content/80 flex items-center gap-1.5">
                <span>🎯</span> Endereço & Localização Exata
              </span>
              {profileForm.latitude && profileForm.longitude ? (
                <span className="badge badge-success badge-xs font-bold text-white gap-1 py-2">
                  ✓ Ponto Definido
                </span>
              ) : (
                <span className="badge badge-warning badge-xs font-medium gap-1 py-2">
                  ⚠️ Sem Coordenadas
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="form-control col-span-2">
                <label className="label py-0.5"><span className="label-text font-bold text-xs">Endereço (Rua, Número, Bairro)</span></label>
                <input
                  type="text"
                  placeholder="Ex: Rua São Pedro, 120, Centro"
                  className="input input-sm input-bordered w-full text-xs"
                  value={profileForm.endereco || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, endereco: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text font-bold text-xs">Cidade</span></label>
                <input
                  type="text"
                  placeholder="Ex: Caxias"
                  className="input input-sm input-bordered w-full text-xs"
                  value={profileForm.cidade || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, cidade: e.target.value })}
                />
              </div>
            </div>

            {/* Campo Inteligente: Colar Coordenadas ou Link do Google Maps */}
            <div className="form-control">
              <label className="label py-0.5">
                <span className="label-text font-bold text-[11px] text-primary">Colar Coordenadas ou Link do Google Maps</span>
              </label>
              <div className="join w-full">
                <input
                  type="text"
                  placeholder="Cole coordenadas (-4.862415, -43.356210) ou link do Maps"
                  className="input input-sm input-bordered join-item w-full text-xs font-mono"
                  value={editSmartCoordsInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditSmartCoordsInput(val);
                    if (val.includes('maps') || val.includes(',') || val.includes(';') || val.includes('@')) {
                      handleApplyEditSmartCoords(val);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleApplyEditSmartCoords()}
                  className="btn btn-sm btn-primary join-item text-xs font-bold shrink-0"
                  title="Extrair coordenadas do texto ou link"
                >
                  Extrair
                </button>
              </div>
            </div>

            {/* Feedback do Geocoding / Parser */}
            {geocodeResult && (
              <div className={`p-2 rounded-xl text-xs flex items-center gap-1.5 animate-in fade-in duration-150 ${geocodeResult.success ? 'bg-success/15 border border-success/30 text-success' : 'bg-warning/15 border border-warning/30 text-warning'}`}>
                <span>{geocodeResult.success ? '✓' : '⚠️'}</span>
                <span className="text-[11px] leading-tight">{geocodeResult.message}</span>
              </div>
            )}

            {/* Inputs de Latitude e Longitude para ajuste fino */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="form-control">
                <label className="label py-0.5">
                  <span className="label-text font-bold text-[11px]">Latitude</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: -4.862415"
                  className="input input-xs input-bordered w-full font-mono text-[11px]"
                  value={profileForm.latitude || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, latitude: e.target.value })}
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
                  value={profileForm.longitude || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, longitude: e.target.value })}
                />
              </div>
            </div>

            {/* Ações de Suporte: Buscar por Endereço e Preview no Maps */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-base-300/60">
              <button
                type="button"
                onClick={handleSearchCoordinates}
                disabled={isGeocoding}
                className="btn btn-xs btn-outline btn-primary rounded-xl font-bold gap-1"
                title="Localizar automaticamente as coordenadas pelo endereço"
              >
                <span>🔍</span> {isGeocoding ? 'Buscando...' : 'Buscar pelo Endereço'}
              </button>

              {profileForm.latitude && profileForm.longitude && (
                <a
                  href={getGoogleMapsUrl(profileForm.latitude, profileForm.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-xs btn-outline btn-info gap-1 rounded-xl font-bold shrink-0 shadow-2xs"
                  title="Abre nova aba com o ponto exato no Google Maps para confirmação visual"
                >
                  <span>👁️</span> Testar no Google Maps
                </a>
              )}
            </div>

            {/* Seletor de Status da Localização (Exata vs Pendente) */}
            <div className="pt-2 border-t border-base-300/60">
              <span className="text-[11px] font-bold block mb-1 text-base-content/70">
                Status da Posição:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProfileForm({ ...profileForm, localizacao_pendente: false })}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    !profileForm.localizacao_pendente
                      ? 'bg-success/20 border-success text-success shadow-xs'
                      : 'bg-base-100 border-base-300 text-base-content/60 hover:bg-base-200'
                  }`}
                >
                  <span>🟢</span> Exata (Confirmada)
                </button>
                <button
                  type="button"
                  onClick={() => setProfileForm({ ...profileForm, localizacao_pendente: true })}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    profileForm.localizacao_pendente
                      ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400 shadow-xs'
                      : 'bg-base-100 border-base-300 text-base-content/60 hover:bg-base-200'
                  }`}
                >
                  <span>🟡</span> Pendente em Campo
                </button>
              </div>
            </div>
          </div>

          <div className="form-control">
            <label className="label py-1"><span className="label-text font-bold text-xs">Categorias</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Salão de Beleza', 'Maquiagem', 'Barbearia', 'Clínica de Estética'].map((cat) => {
                const isChecked = profileForm.categoriasList?.includes(cat) || false;
                return (
                  <label key={cat} className="cursor-pointer flex items-center gap-1.5 bg-base-200 px-3 py-1.5 rounded-lg border border-base-300 text-xs">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary"
                      checked={isChecked}
                      onChange={(e) => {
                        const list = profileForm.categoriasList || [];
                        if (e.target.checked) {
                          setProfileForm({ ...profileForm, categoriasList: [...list, cat] });
                        } else {
                          setProfileForm({ ...profileForm, categoriasList: list.filter((c) => c !== cat) });
                        }
                      }}
                    />
                    <span>{cat}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-base-200">
            {profileForm.status_funil === 'nao_visitar' ? (
              <button onClick={handleReactivate} className="btn btn-success btn-outline flex-1 btn-sm">
                Reativar Salão
              </button>
            ) : (
              <button onClick={handleInactivate} className="btn btn-error btn-outline flex-1 btn-sm">
                Inativar Salão
              </button>
            )}

            <button onClick={handleSaveProfile} disabled={isSaving} className="btn btn-primary flex-1 btn-sm">
              {isSaving ? <span className="loading loading-spinner loading-xs"></span> : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      ) : (
        /* MODO VISUALIZAÇÃO COMPLETO - DESIGN REFINADO MOBILE FIRST COMPACTO */
        <div className="space-y-2 pb-4 md:pb-2">
          
          {/* Alça visual de Bottom Sheet para celular */}
          <div className="w-10 h-1 rounded-full bg-base-300 mx-auto -mt-1 mb-1.5 shrink-0"></div>

          {/* Cabeçalho */}
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base md:text-lg font-extrabold text-base-content leading-tight truncate">
                  {client.nome}
                </h2>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Botão Direto para o WhatsApp (PV) sem abrir modal de scripts */}
                  <button
                    onClick={handleDirectWhatsApp}
                    className="p-1 px-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold text-xs transition-all active:scale-95 shadow-xs"
                    title={client.whatsapp || client.telefone ? `Abrir WhatsApp no PV (${client.whatsapp || client.telefone})` : 'Abrir WhatsApp'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    <span>Whats</span>
                  </button>

                  <button
                    onClick={handleStartEditProfile}
                    className="p-1.5 rounded-xl border border-base-300/80 bg-base-200/60 hover:bg-base-200 text-base-content/70 hover:text-primary transition-all active:scale-95"
                    title="Editar Dados Cadastrais & Endereço"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>

                  <button
                    onClick={handleInactivateDirect}
                    className="p-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-all active:scale-95"
                    title="Salão Fechou / Inativar da Base (Remove do Mapa)"
                  >
                    <span className="text-xs leading-none">🚫</span>
                  </button>
                </div>
              </div>

              {/* SELETOR RÁPIDO DE FUNIL DE 1 TOQUE (SEGMENTED CONTROL COMPACTO) */}
              <div className="mt-1.5">
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60">
                    Etapa do Funil:
                  </span>
                  {funnelFeedback && (
                    <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                      {funnelFeedback}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1 p-0.5 bg-base-200/90 rounded-xl border border-base-300 shadow-inner">
                  {[
                    { id: 'prospect', dot: '🔵', text: 'Prospect', activeClass: 'bg-sky-500/15 border-sky-500/60 text-sky-800 dark:text-sky-300 font-bold shadow-xs' },
                    { id: 'negociacao', dot: '🟡', text: 'Negoc.', activeClass: 'bg-amber-500/15 border-amber-500/60 text-amber-800 dark:text-amber-300 font-bold shadow-xs' },
                    { id: 'cliente_ativo', dot: '🟢', text: 'Ativo', activeClass: 'bg-emerald-500/15 border-emerald-500/60 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs' },
                    { id: 'alerta_resgate', dot: '🔴', text: 'Resgate', activeClass: 'bg-rose-500/15 border-rose-500/60 text-rose-800 dark:text-rose-300 font-bold shadow-xs' },
                    { id: 'em_atraso', dot: '⛔', text: 'Atraso', activeClass: 'bg-rose-500/25 border-rose-500 text-rose-700 dark:text-rose-300 font-bold shadow-xs ring-2 ring-rose-500/30' }
                  ].map((stage) => {
                    const isCurrent = stage.id === 'em_atraso'
                      ? (client.status_funil === 'em_atraso' || client.boleto_atrasado)
                      : (client.status_funil || 'prospect') === stage.id && !client.boleto_atrasado;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => handleQuickFunnelChange(stage.id)}
                        disabled={isUpdatingFunnel}
                        className={`py-1 px-0.5 rounded-lg text-[10px] sm:text-[11px] transition-all border text-center flex items-center justify-center gap-0.5 overflow-hidden active:scale-95 ${
                          isCurrent
                            ? stage.activeClass
                            : 'border-transparent text-base-content/60 hover:text-base-content hover:bg-base-300/40 font-medium'
                        }`}
                      >
                        <span className="text-[10px] shrink-0 leading-none">{stage.dot}</span>
                        <span className="truncate leading-none">{stage.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Informações Básicas de Contato & Última Compra Discreta */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-base-content/75 items-center">
                {client.responsavel && (
                  <span>
                    Dona: <strong className="text-base-content">{client.responsavel}</strong>
                  </span>
                )}
                {(client.whatsapp || client.telefone) && (
                  <button
                    type="button"
                    onClick={handleDirectWhatsApp}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                    title="Conversar direto no WhatsApp"
                  >
                    <span>💬</span>
                    <span>{client.whatsapp || client.telefone}</span>
                  </button>
                )}
                {client.cidade && <span>Cidade: <strong className="text-base-content">{client.cidade}</strong></span>}
                
                {/* 3. Resumo Discreto de Última Compra */}
                {client.data_ultima_compra && (
                  <span className="text-base-content/70">
                    Última compra: <strong className="text-base-content/90 font-medium">{new Date(client.data_ultima_compra + 'T12:00:00').toLocaleDateString('pt-BR')}{client.ultimas_compras?.[0]?.valor ? ` (R$ ${Number(client.ultimas_compras[0].valor).toFixed(2).replace('.', ',')})` : ''}</strong>
                  </span>
                )}

                {client.telefone_alternativo && (
                  <span>Tel 2: <strong className="text-base-content">{client.telefone_alternativo}</strong></span>
                )}
                {client.instagram && (
                  <a
                    href={`https://instagram.com/${client.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <span>📷</span> {client.instagram}
                  </a>
                )}
              </div>

              {/* Badges de Categorias & Alertas Financeiros */}
              <div className="flex gap-1 mt-1.5 flex-wrap items-center">
                {rawCategorias.length > 0 ? (
                  rawCategorias.map((cat, idx) => (
                    <span key={idx} className="badge badge-xs bg-base-200 border-base-300 text-base-content font-medium gap-1 py-2">
                      <span>{getCategoryEmoji(cat)}</span> {cat}
                    </span>
                  ))
                ) : (
                  <span className="badge badge-xs bg-base-200 border-base-300 text-base-content/70 font-normal gap-1 py-2">
                    <span>✨</span> Salão Geral
                  </span>
                )}

                {client.boleto_atrasado && (
                  <span className="badge badge-error badge-xs font-bold shadow-xs text-white py-2">
                    ⚠️ ERP: Boleto em Atraso
                  </span>
                )}

                {diasSemCompra !== null && diasSemCompra >= 45 && (
                  <span className="badge badge-warning badge-xs font-bold shadow-xs text-base-content py-2">
                    ⏳ Últ. Compra há {diasSemCompra} dias
                  </span>
                )}

                {client.melhor_dia_compra && (
                  <span className="badge badge-xs bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold py-2">
                    💳 Cartão: Dia {client.melhor_dia_compra}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleCloseDrawer}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-base-200/90 hover:bg-base-300 text-base-content/70 hover:text-base-content flex items-center justify-center text-base font-bold transition-all active:scale-90 shrink-0 border border-base-300 shadow-xs"
              title="Fechar card"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          {/* BANNER SE O SALÃO ESTIVER MARCADO COMO NÃO VISITAR / FECHADO */}
          {client.status_funil === 'nao_visitar' && (
            <div className="bg-rose-500/15 border-2 border-rose-500/60 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="text-lg shrink-0">🚫</span>
                <div>
                  <strong className="block font-bold">Salão Fechado / Inativo</strong>
                  <span className="text-[11px] text-base-content/70">Este salão está inativo e oculto do mapa e rotas de visitas ativas.</span>
                </div>
              </div>
              <button
                onClick={handleReactivate}
                className="btn btn-xs btn-success btn-outline font-bold rounded-xl shrink-0"
                title="Reativar este salão e trazê-lo de volta ao mapa"
              >
                Reativar Salão
              </button>
            </div>
          )}

          {/* BARRA INTERATIVA DE ENDEREÇO & NAVEGAÇÃO GPS 1-TOQUE */}
          <div className="bg-base-200/80 border border-base-300 p-2 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 overflow-hidden flex-1 min-w-0">
                <span className="text-sm shrink-0 mt-0.5">📍</span>
                <div className="truncate">
                  <span className="font-bold text-base-content block truncate text-xs" title={client.endereco || 'Endereço não cadastrado'}>
                    {client.endereco || 'Endereço não cadastrado'}
                  </span>
                  <span className="text-[10px] text-base-content/60 flex items-center gap-1.5 flex-wrap">
                    <span>{client.cidade || 'Caxias'}</span>
                    {hasCoordinates ? (
                      <span className="font-mono">
                        • GPS: {parseFloat(client.latitude).toFixed(4)}, {parseFloat(client.longitude).toFixed(4)}
                      </span>
                    ) : (
                      <span>• Sem coordenadas GPS</span>
                    )}
                    {client.localizacao_pendente ? (
                      <span className="badge badge-warning badge-xs font-bold text-[9px] py-0 px-1.5 shadow-2xs">
                        ⚠️ Validação Pendente
                      </span>
                    ) : hasCoordinates ? (
                      <span className="badge badge-success badge-xs font-bold text-white text-[9px] py-0 px-1.5 shadow-2xs">
                        ✓ Posição Exata
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>

              {/* Botões de Navegação Direta 1-Toque */}
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-xs rounded-lg font-bold bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-700 dark:text-sky-300 gap-1 transition-all active:scale-95 shadow-2xs py-0.5"
                  title="Abrir rota no Google Maps"
                >
                  <span>🗺️</span> Maps
                </a>
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-xs rounded-lg font-bold bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 gap-1 transition-all active:scale-95 shadow-2xs py-0.5"
                  title="Navegar pelo Waze"
                >
                  <span>🚙</span> Waze
                </a>
              </div>
            </div>

            {/* Ações de ajuste de pino */}
            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-base-300/60">
              <button
                onClick={() => onStartRepositionPin && onStartRepositionPin(client)}
                className="btn btn-xs rounded-lg font-medium bg-base-100 hover:bg-base-300 border border-base-300 text-base-content/80 gap-1 transition-all active:scale-95 py-0.5"
                title="Toque no mapa para apontar o novo local deste salão"
              >
                <span>📌</span> Mover no Mapa
              </button>
              <button
                onClick={handleFixCurrentGPS}
                disabled={isFixingGps}
                className="btn btn-xs rounded-lg font-medium bg-base-100 hover:bg-base-300 border border-base-300 text-base-content/80 gap-1 transition-all active:scale-95 py-0.5"
                title="Fixar na minha localização GPS atual"
              >
                <span>📱</span> {isFixingGps ? 'GPS...' : 'Meu GPS'}
              </button>
            </div>
          </div>

          {/* BANNER DE LOCALIZAÇÃO GPS PENDENTE (ORIGEM ERP) */}
          {client.localizacao_pendente && (
            <div className="bg-amber-500/15 border-2 border-amber-500/60 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <span className="text-xl shrink-0">📍</span>
                <div>
                  <strong className="block font-bold">Localização GPS Pendente (Origem ERP)</strong>
                  <span className="text-[11px] text-base-content/70">
                    Este salão compra no ERP ({client.qtd_compras || 0} compras), mas o ponto exato na rua precisa ser confirmado na rota.
                  </span>
                </div>
              </div>
              <button
                onClick={handleFixCurrentGPS}
                disabled={isFixingGps}
                className="btn btn-xs btn-warning font-bold gap-1 rounded-xl shadow-xs shrink-0 self-end sm:self-center"
                title="Salva a latitude/longitude exata de onde você está agora como endereço do salão"
              >
                <span>📱</span> {isFixingGps ? 'Obtendo GPS...' : 'Fixar Meu GPS Aqui'}
              </button>
            </div>
          )}

          {/* BANNER DE BLINDAGEM FINANCEIRA ERP (SE HOUVER BOLETO EM ATRASO) */}
          {client.boleto_atrasado && (
            <div className="bg-error/15 border-2 border-error/50 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-error animate-pulse">
              <span className="text-lg">⛔</span>
              <div>
                <strong className="block font-bold">BLOQUEIO FINANCEIRO (ERP): Boleto em Atraso</strong>
                <span className="text-[11px] text-base-content/70">
                  Este salão possui pendência de pagamento no ERP. Vendas autorizadas estritamente à vista ou via cartão de crédito.
                </span>
              </div>
            </div>
          )}

          {/* AVISO DA JANELA DE RECOMPRA PREDITIVA (25 A 45 DIAS) */}
          {diasSemCompra !== null && diasSemCompra >= 25 && diasSemCompra <= 45 && (
            <div className="bg-amber-500/15 border border-amber-500/40 p-2.5 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5">
                <span>⏳</span>
                <span><strong>Janela de Recompra:</strong> Última compra há {diasSemCompra} dias (Momento ideal de reposição).</span>
              </div>
              <span className="badge badge-warning badge-xs font-bold shrink-0">Giro Alto</span>
            </div>
          )}

          {/* Seletor de Abas da Ficha (Segmented Control Refinado - Sem Quebra de Texto) */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-base-200/90 rounded-2xl border border-base-300 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('dados')}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1 ${
                activeTab === 'dados'
                  ? 'bg-base-100 text-base-content shadow-xs border border-base-300/80'
                  : 'text-base-content/60 hover:text-base-content hover:bg-base-300/30'
              }`}
            >
              <span>📋</span> Dados
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1 ${
                activeTab === 'timeline'
                  ? 'bg-base-100 text-base-content shadow-xs border border-base-300/80'
                  : 'text-base-content/60 hover:text-base-content hover:bg-base-300/30'
              }`}
            >
              <span>📜</span> Histórico
            </button>
            {client.ultimas_compras && client.ultimas_compras.length > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTab('erp')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1 ${
                  activeTab === 'erp'
                    ? 'bg-base-100 text-base-content shadow-xs border border-base-300/80'
                    : 'text-base-content/60 hover:text-base-content hover:bg-base-300/30'
                }`}
              >
                <span>📦</span> ERP ({client.qtd_compras || client.ultimas_compras.length})
              </button>
            ) : (
              <div className="py-2 px-1 rounded-xl text-xs text-base-content/30 text-center flex items-center justify-center gap-1 font-medium">
                <span>📦</span> Sem ERP
              </div>
            )}
          </div>

          {/* Conteúdo da Aba: DADOS */}
          {activeTab === 'dados' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              
              {/* MIX DE MARCAS INOVA BEAUTY (DESIGN LIMPO - SEM CORES EXCESSIVAS OU ROXO) */}
              <div className="bg-base-200/80 p-3 rounded-2xl border border-base-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-base-content flex items-center gap-1.5">
                    <span>💼</span> Mix de Marcas Inova Beauty
                  </span>
                  <span className="text-[10px] text-base-content/50 font-medium">Toque para alternar</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                  {/* Marca 1: Olenka */}
                  <button
                    type="button"
                    onClick={() => handleToggleBrand('Olenka')}
                    className={`p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-2 active:scale-95 ${
                      hasOlenka
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 shadow-xs'
                        : 'bg-base-100/70 hover:bg-base-100 border-base-300/80 text-base-content/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs truncate">🌿 Olenka</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-lg text-center block w-full ${hasOlenka ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-base-300/60 text-base-content/50'}`}>
                      {hasOlenka ? '✓ Bancada' : 'Não Usa'}
                    </span>
                  </button>

                  {/* Marca 2: MUP Collor (Bronze/Âmbar Elegante - Sem Roxo) */}
                  <button
                    type="button"
                    onClick={() => handleToggleBrand('MUP')}
                    className={`p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-2 active:scale-95 ${
                      hasMup
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300 shadow-xs'
                        : 'bg-base-100/70 hover:bg-base-100 border-base-300/80 text-base-content/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs truncate">🎨 MUP Collor</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-lg text-center block w-full ${hasMup ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-base-300/60 text-base-content/50'}`}>
                      {hasMup ? '✓ Bancada' : 'Não Usa'}
                    </span>
                  </button>

                  {/* Marca 3: Mup Makeup */}
                  <button
                    type="button"
                    onClick={() => handleToggleBrand('Makeup')}
                    className={`p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-2 active:scale-95 ${
                      hasMakeup
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-300 shadow-xs'
                        : 'bg-base-100/70 hover:bg-base-100 border-base-300/80 text-base-content/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs truncate">💄 Mup Makeup</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-lg text-center block w-full ${hasMakeup ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-base-300/60 text-base-content/50'}`}>
                      {hasMakeup ? '✓ Bancada' : 'Não Usa'}
                    </span>
                  </button>
                </div>

                {/* Radar Tático de Venda Cruzada (Alto Contraste em Light e Dark) */}
                <div className="p-3 rounded-2xl bg-base-100 border border-base-300 text-xs">
                  {hasOlenka && hasMup && hasMakeup ? (
                    <div className="text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                      <span className="text-base shrink-0">⭐</span>
                      <div>
                        <strong className="block font-bold">Salão Full Mix Inova Beauty:</strong>
                        <span className="text-base-content/75 text-[11px]">Salão blindado com as 3 marcas da distribuidora! Foco em reposição programada.</span>
                      </div>
                    </div>
                  ) : !hasOlenka && !hasMup && !hasMakeup ? (
                    <div className="text-sky-700 dark:text-sky-300 flex items-start gap-2">
                      <span className="text-base shrink-0">🎯</span>
                      <div>
                        <strong className="block font-bold">Salão Novo:</strong>
                        <span className="text-base-content/75 text-[11px]">Apresente os carros-chefe das marcas Inova Beauty para abrir o cadastro.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <span className="text-base shrink-0">💡</span>
                      <div>
                        <strong className="block font-bold">Oportunidade de Venda Cruzada:</strong>
                        <span className="text-base-content/80 text-[11px]">
                          Este salão já compra Inova Beauty! Apresente {[!hasOlenka && 'Olenka', !hasMup && 'MUP Collor', !hasMakeup && 'Mup Makeup'].filter(Boolean).join(' e ')} para aumentar o ticket médio na rota.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Informações Comerciais Complementares (Alto Contraste) */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-base-200/80 p-3.5 rounded-2xl border border-base-300">
                <div>
                  <span className="text-base-content/60 block font-semibold text-[11px]">Melhor Dia de Fechamento:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400 text-xs mt-0.5 block">
                    {client.melhor_dia_compra ? `Dia ${client.melhor_dia_compra}` : 'Não informado'}
                  </span>
                </div>
                <div>
                  <span className="text-base-content/60 block font-semibold text-[11px]">Data Retorno Marcado:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs mt-0.5 block">
                    {client.data_retorno ? new Date(client.data_retorno + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem agendamento'}
                  </span>
                </div>
              </div>

              {client.observacoes && (
                <div className="text-xs bg-base-200/80 p-3.5 rounded-2xl border border-base-300">
                  <span className="font-semibold text-base-content/60 block mb-1 text-[11px]">Última Observação Registrada:</span>
                  <p className="text-base-content font-medium text-xs leading-relaxed">{client.observacoes}</p>
                </div>
              )}

              {client.data_ultima_interacao && (
                <div className="text-xs bg-base-200/80 p-3 rounded-2xl border border-base-300 text-base-content/80 flex items-center justify-between">
                  <span>
                    🔄 Última: <strong className="text-base-content">{new Date(client.data_ultima_interacao).toLocaleDateString('pt-BR')}</strong> ({client.tipo_ultima_interacao || 'Visita'})
                  </span>
                  {client.data_retorno && (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      Retorno: {new Date(client.data_retorno + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Conteúdo da Aba: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="bg-base-200/60 p-3 rounded-2xl border border-base-300 animate-in fade-in duration-150">
              <ClientTimeline clientId={client.id} />
            </div>
          )}

          {/* Conteúdo da Aba: ERP */}
          {activeTab === 'erp' && client.ultimas_compras && (
            <div className="bg-base-200/80 p-3.5 rounded-2xl border border-base-300 space-y-2.5 animate-in fade-in duration-150">
              <span className="font-bold text-base-content/70 block text-xs">Histórico de Compras Faturadas:</span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {client.ultimas_compras.map((compra, idx) => (
                  <div key={idx} className="border-l-2 border-emerald-500 pl-3 py-1.5 bg-base-100 p-2.5 rounded-xl border border-base-300/60">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-base-content">{new Date(compra.data).toLocaleDateString('pt-BR')}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">R$ {compra.valor?.toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] text-base-content/70 mt-0.5">{compra.itens}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botão de Adicionar à Rota */}
          <div className="pt-1">
            <button
              onClick={() => onAddToRoute(client)}
              disabled={isClientInRoute}
              className={`w-full py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                isClientInRoute
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300 cursor-default'
                  : 'bg-base-200/80 hover:bg-base-200 border-base-300 text-base-content hover:border-base-content/30 active:scale-[0.99]'
              }`}
            >
              {isClientInRoute ? '✓ Salão já incluído na Rota do Dia' : '📍 Adicionar à Rota do Dia'}
            </button>
          </div>

          {/* Botões de Ação Imediata de Campo (Touch-First 44px) */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-base-300/80">
            {/* Botão de Calculadora de Lucro do Salão */}
            <button
              onClick={() => onOpenProfitCalculator && onOpenProfitCalculator(client)}
              className="min-h-[44px] py-2.5 px-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs transition-all active:scale-95"
              title="Simulador de Lucro do Salão"
            >
              <span>🧮</span> Lucro
            </button>

            {/* Botão de Scripts Dinâmicos com PNL */}
            <button
              onClick={() => onOpenWhatsAppScripts && onOpenWhatsAppScripts(client)}
              className="min-h-[44px] py-2.5 px-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-800 dark:text-sky-300 font-bold flex items-center justify-center gap-1.5 text-xs shadow-xs transition-all active:scale-95"
              title="Abrir scripts persuasivos de WhatsApp"
            >
              <span>💬</span> Scripts
            </button>

            {/* Botão de Check-in com Quick Tags */}
            <button
              onClick={() => onOpenCheckin && onOpenCheckin(client, 'Visita Realizada')}
              className="min-h-[44px] py-2.5 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center justify-center gap-1.5 text-xs shadow-md transition-all active:scale-95"
              title="Registrar visita com Quick Tags"
            >
              <span>📍</span> Visita
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
