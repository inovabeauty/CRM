import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabaseClient';
import { cacheClientsLocally, getCachedClientsLocally } from '../lib/offlineStorage';

if (typeof window !== 'undefined' && L.Icon?.Default?.prototype?._getIconUrl) {
  delete L.Icon.Default.prototype._getIconUrl;
}

const getIconColor = (status) => {
  switch(status) {
    case 'cliente_ativo': return 'bg-green-500';
    case 'alerta_resgate': return 'bg-red-500 animate-pulse';
    case 'negociacao': return 'bg-yellow-500';
    case 'nao_visitar': return 'bg-gray-800 opacity-50';
    default: return 'bg-blue-500';
  }
};

// Ícone customizado incluindo selo de verificação recente (Check), destaque de cartão virando, alerta ERP e localização pendente
const createCustomIcon = (status, ultimaInteracao, isCardDue, isCreditBlocked, isGpsPending) => {
  if (isGpsPending) {
    return L.divIcon({
      className: 'bg-transparent',
      html: `<div class="relative w-6 h-6 rounded-full border-2 border-amber-400 bg-amber-500 ring-4 ring-amber-400/40 shadow-xl flex items-center justify-center animate-pulse">
        <span class="text-[11px] leading-none">📍</span>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  const colorClass = isCreditBlocked ? 'bg-red-700' : getIconColor(status);
  let hasRecentCheck = false;
  
  if (ultimaInteracao) {
    const diasPassados = (new Date() - new Date(ultimaInteracao)) / (1000 * 60 * 60 * 24);
    if (diasPassados <= 15) hasRecentCheck = true;
  }

  const borderClass = isCreditBlocked
    ? 'border-2 border-red-500 ring-2 ring-red-500/80 shadow-red-500 animate-pulse'
    : isCardDue
      ? 'border-2 border-accent ring-2 ring-accent/60 shadow-accent'
      : 'border-2 border-white shadow-lg';

  const badgeContent = isCreditBlocked
    ? '<span class="text-[9px] leading-none">⛔</span>'
    : hasRecentCheck
      ? '<span class="text-[10px] font-bold text-white leading-none">✓</span>'
      : (isCardDue ? '<span class="text-[9px] leading-none">💳</span>' : '');

  return L.divIcon({
    className: 'bg-transparent',
    html: `<div class="relative w-5 h-5 rounded-full ${borderClass} ${colorClass} flex items-center justify-center">
      ${badgeContent}
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// Pino de geolocalização do Vendedor (GPS - Beacon Azul Google Maps com pulso de alta precisão)
const userGoogleMapsIcon = L.divIcon({
  className: 'bg-transparent',
  html: `
    <div class="relative flex items-center justify-center w-8 h-8 pointer-events-auto">
      <div class="absolute w-8 h-8 rounded-full bg-blue-500/35 animate-ping"></div>
      <div class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center ring-2 ring-blue-400/50">
        <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Captura de cliques no mapa no modo de adicionar ou reposicionar pino
function MapClickHandler({ isAddingMode, onMapClick, repositioningClient, onRepositionClick }) {
  useMapEvents({
    click(e) {
      if (repositioningClient && onRepositionClick) {
        onRepositionClick(e.latlng);
      } else if (isAddingMode) {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

// Manipulação de câmera e foco
function MapController({ searchTarget, userLoc, radiusMode, clients, cityFilter, repositioningClient, flyToCoords }) {
  const map = useMap();

  useEffect(() => {
    if (flyToCoords) {
      map.flyTo([flyToCoords.lat, flyToCoords.lng], flyToCoords.zoom || 17, { duration: 1.2 });
    }
  }, [flyToCoords, map]);

  useEffect(() => {
    if (repositioningClient && repositioningClient.latitude && repositioningClient.longitude) {
      map.flyTo([parseFloat(repositioningClient.latitude), parseFloat(repositioningClient.longitude)], 17, { duration: 1.2 });
    }
  }, [repositioningClient, map]);

  useEffect(() => {
    if (searchTarget && searchTarget.latitude && searchTarget.longitude) {
      map.flyTo([parseFloat(searchTarget.latitude), parseFloat(searchTarget.longitude)], 18, { duration: 1.5 });
    }
  }, [searchTarget, map]);
  
  useEffect(() => {
    if (userLoc && radiusMode) {
      map.flyTo(userLoc, 14, { duration: 1.5 });
    }
  }, [userLoc, radiusMode, map]);

  useEffect(() => {
    if (!radiusMode && !searchTarget && !repositioningClient && !flyToCoords && cityFilter && clients && clients.length > 0) {
      const coords = clients
        .filter(c => c.latitude && c.longitude)
        .map(c => [parseFloat(c.latitude), parseFloat(c.longitude)]);
      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [cityFilter, clients, radiusMode, searchTarget, repositioningClient, flyToCoords, map]);

  return null;
}

// Distância em KM (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

export default function LeafletMap({
  cityFilter,
  allowedCities = null,
  categoryFilter,
  funnelFilter,
  cardFilter = false,
  repurchaseFilter = false,
  creditAlertFilter = false,
  returnFilter = false,
  stalledFilter = false,
  searchTarget,
  onClientsLoaded,
  repositioningClient,
  onRepositionClick
}) {
  const [clients, setClients] = useState([]);
  const [userLoc, setUserLoc] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(25);
  const [isLocating, setIsLocating] = useState(false);
  const [flyToCoords, setFlyToCoords] = useState(null);
  const [radiusMode, setRadiusMode] = useState(false);
  const [isAddingMode, setIsAddingMode] = useState(false);

  // Monitoramento contínuo em segundo plano da localização do vendedor (GPS ao vivo estilo Google Maps)
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLoc([pos.coords.latitude, pos.coords.longitude]);
          setUserAccuracy(pos.coords.accuracy || 20);
        },
        () => {}, // fallback silencioso se permissão ainda não foi concedida
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    async function fetchClients() {
      try {
        let allData = [];
        let from = 0;
        const step = 1000;
        let queryError = null;

        while (true) {
          let query = supabase
            .from('clientes')
            .select('id, nome, latitude, longitude, categorias, whatsapp, status_funil, linha_interesse, melhor_dia_compra, observacoes, data_ultima_compra, boleto_atrasado, ultimas_compras, responsavel, instagram, telefone_alternativo, data_ultima_interacao, tipo_ultima_interacao, data_retorno, endereco, cidade, localizacao_pendente, erp_cliente_id, valor_total_comprado, qtd_compras')
            .not('latitude', 'is', null)
            .range(from, from + step - 1);

          if (cityFilter) {
            query = query.eq('cidade', cityFilter);
          } else if (allowedCities && allowedCities.length > 0) {
            query = query.in('cidade', allowedCities);
          }

          if (categoryFilter) query = query.contains('categorias', [categoryFilter]);
          if (funnelFilter) query = query.eq('status_funil', funnelFilter);

          const { data, error } = await query;
          if (error) {
            queryError = error;
            break;
          }
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < step) break;
          from += step;
        }

        if (!queryError && allData.length > 0) {
          setClients(allData);
          cacheClientsLocally(allData);
          if (onClientsLoaded) onClientsLoaded(allData);
        } else {
          // Fallback offline se houver falha de rede
          const cached = getCachedClientsLocally();
          if (cached) {
            let filtered = cached;
            if (cityFilter) {
              filtered = filtered.filter(c => c.cidade === cityFilter);
            } else if (allowedCities && allowedCities.length > 0) {
              filtered = filtered.filter(c => allowedCities.includes(c.cidade));
            }
            if (categoryFilter) filtered = filtered.filter(c => c.categorias?.includes(categoryFilter));
            if (funnelFilter) filtered = filtered.filter(c => c.status_funil === funnelFilter);
            setClients(filtered);
            if (onClientsLoaded) onClientsLoaded(filtered);
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar clientes do mapa, tentando cache:', e);
        const cached = getCachedClientsLocally();
        if (cached) {
          let filtered = cached;
          if (cityFilter) {
            filtered = filtered.filter(c => c.cidade === cityFilter);
          } else if (allowedCities && allowedCities.length > 0) {
            filtered = filtered.filter(c => allowedCities.includes(c.cidade));
          }
          setClients(filtered);
          if (onClientsLoaded) onClientsLoaded(filtered);
        }
      }
    }

    fetchClients();

    window.addEventListener('refreshMap', fetchClients);
    return () => window.removeEventListener('refreshMap', fetchClients);
  }, [cityFilter, allowedCities, categoryFilter, funnelFilter]);

  // Cálculo dos dias de virada do cartão (hoje + próximos 5 dias)
  const today = new Date().getDate();
  const nextDays = Array.from({ length: 6 }, (_, i) => ((today + i - 1) % 31) + 1);
  const hojeIso = new Date().toISOString().split('T')[0];
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

  // Aplicação de filtros combinados (Radar GPS, Retornos, Negociações Paradas, Cartão, Recompra & ERP)
  let displayedClients = clients;

  // Por padrão, oculta salões que fecharam ou não existem mais (inativos), a menos que o filtro de funil seja especificamente 'nao_visitar'
  if (funnelFilter !== 'nao_visitar') {
    displayedClients = displayedClients.filter((c) => c.status_funil !== 'nao_visitar');
  }

  if (returnFilter) {
    displayedClients = displayedClients.filter((c) => {
      if (!c.data_retorno) return false;
      return c.data_retorno <= hojeIso;
    });
  }

  if (stalledFilter) {
    displayedClients = displayedClients.filter((c) => {
      if (c.status_funil !== 'negociacao') return false;
      if (!c.data_ultima_interacao) return true;
      return new Date(c.data_ultima_interacao) <= seteDiasAtras;
    });
  }

  if (cardFilter) {
    displayedClients = displayedClients.filter((c) => {
      if (!c.melhor_dia_compra) return false;
      const dia = parseInt(c.melhor_dia_compra);
      return nextDays.includes(dia);
    });
  }

  if (repurchaseFilter) {
    displayedClients = displayedClients.filter((c) => {
      if (!c.data_ultima_compra) return false;
      const dias = Math.floor((new Date() - new Date(c.data_ultima_compra)) / (1000 * 60 * 60 * 24));
      return dias >= 25 && dias <= 45;
    });
  }

  if (creditAlertFilter) {
    displayedClients = displayedClients.filter((c) => c.boleto_atrasado === true);
  }

  if (radiusMode && userLoc) {
    displayedClients = displayedClients.filter(c => 
      getDistance(userLoc[0], userLoc[1], parseFloat(c.latitude), parseFloat(c.longitude)) <= 5
    );
  }

  // Obter localização exata de alta precisão (GPS) e focar no mapa
  const handleLocateUser = (center = true, openCreate = false) => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu celular ou navegador.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy || 20;

        setUserLoc([lat, lng]);
        setUserAccuracy(accuracy);
        setIsLocating(false);

        if (center) {
          setFlyToCoords({ lat, lng, zoom: 17, timestamp: Date.now() });
        }

        if (openCreate) {
          window.dispatchEvent(new CustomEvent('openCreateCard', { detail: { lat, lng } }));
          setIsAddingMode(false);
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Não foi possível obter a sua localização GPS.';
        if (err.code === 1) msg = 'Permissão de localização negada. Ative o GPS nas permissões do site/navegador no celular.';
        else if (err.code === 2) msg = 'Sinal de GPS fraco ou indisponível no momento.';
        else if (err.code === 3) msg = 'Tempo limite de busca GPS esgotado.';
        alert(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="relative w-full h-full">
      
      {/* 1. BARRA SUPERIOR QUANDO ESTIVER NO MODO "ADICIONAR SALÃO" (+) */}
      {isAddingMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-base-100/95 backdrop-blur-md text-base-content border border-base-300 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs animate-in slide-in-from-top duration-200 max-w-[94%] w-auto">
          <span className="text-base shrink-0">📍</span>
          <span className="font-semibold truncate">Toque no mapa ou use seu GPS:</span>
          {userLoc ? (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('openCreateCard', { detail: { lat: userLoc[0], lng: userLoc[1] } }));
                setIsAddingMode(false);
              }}
              className="btn btn-xs btn-primary font-bold rounded-xl gap-1 shrink-0 shadow-xs active:scale-95"
            >
              <span>📱</span> Usar Meu GPS
            </button>
          ) : (
            <button
              onClick={() => handleLocateUser(true, true)}
              className="btn btn-xs btn-primary font-bold rounded-xl gap-1 shrink-0 shadow-xs active:scale-95"
            >
              <span>📱</span> Pegar Meu GPS
            </button>
          )}
          <button
            onClick={() => setIsAddingMode(false)}
            className="btn btn-xs btn-ghost btn-circle text-xs shrink-0"
            title="Cancelar"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. TAG INFORMATIVA QUANDO O MODO RADAR 5KM ESTIVER ATIVO */}
      {radiusMode && (
        <div className="absolute bottom-6 right-20 z-[400] animate-in fade-in duration-200">
          <div className="badge badge-warning text-xs font-bold shadow-lg gap-1.5 py-3 px-3">
            <span>📡</span> Radar 5 km ativo
            <button onClick={() => setRadiusMode(false)} className="text-[11px] opacity-75 hover:opacity-100 font-bold ml-1">✕</button>
          </div>
        </div>
      )}

      {/* 3. STACK DE CONTROLES FLUTUANTES DO MAPA (DIREITA INFERIOR - TOUCH FIRST 44PX) */}
      <div className="absolute bottom-6 right-4 z-[400] flex flex-col items-center gap-2.5">
        
        {/* Botão A: Adicionar Cliente / Novo Salão (+) */}
        <button 
          onClick={() => setIsAddingMode(!isAddingMode)} 
          className={`btn btn-circle shadow-2xl border transition-all active:scale-95 ${
            isAddingMode 
              ? 'bg-rose-600 text-white hover:bg-rose-700 ring-4 ring-rose-500/30 border-rose-400' 
              : 'bg-primary text-primary-content hover:bg-primary/90 border-primary/40'
          }`} 
          title={isAddingMode ? 'Cancelar marcação' : 'Novo Salão'}
        >
          <span className="text-lg font-bold leading-none">{isAddingMode ? '✕' : '+'}</span>
        </button>

        {/* Botão B: Radar de Proximidade (5km) */}
        <button 
          onClick={() => {
            if (radiusMode) {
              setRadiusMode(false);
            } else {
              if (userLoc) {
                setRadiusMode(true);
              } else {
                handleLocateUser(true);
                setRadiusMode(true);
              }
            }
          }} 
          className={`btn btn-circle shadow-2xl border transition-all active:scale-95 ${
            radiusMode 
              ? 'bg-amber-500 text-white hover:bg-amber-600 ring-4 ring-amber-500/30 border-amber-400' 
              : 'bg-base-100 text-base-content/75 hover:text-base-content border-base-300'
          }`} 
          title={radiusMode ? 'Sair do Radar 5km' : 'Filtrar salões num raio de 5km de onde estou'}
        >
          <span className="text-sm">📡</span>
        </button>

        {/* Botão C: Minha Localização Atual GPS (Ícone Alvo/Crosshair Google Maps) */}
        <button 
          type="button"
          onClick={() => handleLocateUser(true)} 
          disabled={isLocating}
          className={`btn btn-circle shadow-2xl border transition-all active:scale-90 ${
            userLoc 
              ? 'bg-base-100 text-blue-600 border-blue-500/50 ring-2 ring-blue-500/20' 
              : 'bg-base-100 text-base-content/70 hover:text-base-content border-base-300'
          }`} 
          title="Centralizar no Meu GPS (Onde Estou)"
        >
          {isLocating ? (
            <span className="loading loading-spinner loading-xs text-blue-600"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </button>
      </div>

      <MapContainer 
        center={[-4.8780, -43.3537]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', zIndex: 0 }} 
        zoomControl={false}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          attribution='&copy; OpenStreetMap contributors'
        />

        <ZoomControl position="bottomleft" />
        
        <MapController 
          searchTarget={searchTarget} 
          userLoc={userLoc} 
          radiusMode={radiusMode} 
          clients={displayedClients}
          cityFilter={cityFilter}
          repositioningClient={repositioningClient}
          flyToCoords={flyToCoords}
        />
        
        <MapClickHandler 
          isAddingMode={isAddingMode} 
          onMapClick={(latlng) => {
            window.dispatchEvent(new CustomEvent('openCreateCard', { detail: latlng }));
            setIsAddingMode(false);
          }} 
          repositioningClient={repositioningClient}
          onRepositionClick={onRepositionClick}
        />
        
        {/* LOCALIZAÇÃO EXATA DO USUÁRIO (GPS ESTILO GOOGLE MAPS) */}
        {userLoc && (
          <>
            {/* Círculo Transparente de Precisão do GPS */}
            <Circle 
              center={userLoc} 
              radius={userAccuracy} 
              pathOptions={{ 
                color: '#2563eb', 
                fillColor: '#3b82f6', 
                fillOpacity: 0.15, 
                weight: 1.5 
              }} 
            />
            
            {/* Ponto Azul Pulsante com Popup de Ações */}
            <Marker position={userLoc} icon={userGoogleMapsIcon}>
              <Popup>
                <div className="p-1 text-center space-y-1.5 min-w-[140px]">
                  <div className="font-extrabold text-xs text-blue-600 flex items-center justify-center gap-1">
                    <span>📍</span> Você está aqui
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    Precisão: ±{Math.round(userAccuracy)}m
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('openCreateCard', { detail: { lat: userLoc[0], lng: userLoc[1] } }));
                    }}
                    className="btn btn-xs btn-primary w-full text-[11px] font-bold rounded-xl gap-1 shadow-xs"
                  >
                    <span>➕</span> Novo Salão Aqui
                  </button>
                </div>
              </Popup>
            </Marker>
          </>
        )}
        
        <MarkerClusterGroup 
          chunkedLoading 
          iconCreateFunction={(cluster) => L.divIcon({ 
            html: `<div class="flex items-center justify-center w-10 h-10 bg-primary text-primary-content rounded-full shadow-lg font-bold border-2 border-white"><span>${cluster.getChildCount()}</span></div>`, 
            className: 'bg-transparent', 
            iconSize: L.point(40, 40, true) 
          })}
        >
          {displayedClients.map((c) => {
            const isCardDue = c.melhor_dia_compra ? nextDays.includes(parseInt(c.melhor_dia_compra)) : false;
            return (
              <Marker 
                key={c.id} 
                position={[parseFloat(c.latitude), parseFloat(c.longitude)]} 
                icon={createCustomIcon(c.status_funil, c.data_ultima_interacao, isCardDue, c.boleto_atrasado, c.localizacao_pendente)} 
                eventHandlers={{ click: () => window.dispatchEvent(new CustomEvent('openClientCard', { detail: c })) }} 
              />
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
