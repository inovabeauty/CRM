import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabaseClient';
import { syncPendingInteractions } from '../lib/offlineStorage';
import { useAuth } from '../lib/authContext';

// Componentes modulares do CRM
import Navbar from '../components/crm/Navbar';
import KpiBar from '../components/crm/KpiBar';
import FilterChips from '../components/crm/FilterChips';
import ClientDrawer from '../components/crm/ClientDrawer';
import WhatsAppScriptModal from '../components/crm/WhatsAppScriptModal';
import VisitCheckinModal from '../components/crm/VisitCheckinModal';
import RouteModal from '../components/crm/RouteModal';
import CreateClientModal from '../components/crm/CreateClientModal';
import ProfitCalculatorModal from '../components/crm/ProfitCalculatorModal';
import DailyReportModal from '../components/crm/DailyReportModal';
import TeamManagementModal from '../components/crm/TeamManagementModal';
import PwaInstallPrompt from '../components/crm/PwaInstallPrompt';

// Carregamento dinâmico do Leaflet para SSR compatível com Next.js
const MapComponent = dynamic(() => import('../components/LeafletMap'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-base-200">
      <div className="flex flex-col items-center gap-2">
        <span className="loading loading-spinner text-primary loading-lg"></span>
        <span className="text-xs text-gray-400 font-mono">Carregando mapa de salões...</span>
      </div>
    </div>
  )
});

// Fórmula de Haversine para cálculo de rotas e vizinho mais próximo
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

export default function Home() {
  const { user, profile, isGestor, isVendedor, userCities } = useAuth();

  // Filtros Globais
  const [selectedCity, setSelectedCity] = useState('');
  const [cities, setCities] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [funnelFilter, setFunnelFilter] = useState('');
  const [cardFilter, setCardFilter] = useState(false);
  const [repurchaseFilter, setRepurchaseFilter] = useState(false);
  const [creditAlertFilter, setCreditAlertFilter] = useState(false);
  const [returnFilter, setReturnFilter] = useState(false);
  const [stalledFilter, setStalledFilter] = useState(false);

  // Estados de Clientes e Ficha
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTarget, setSearchTarget] = useState(null);
  const [loadedClients, setLoadedClients] = useState([]);
  const [repositioningClient, setRepositioningClient] = useState(null);

  // Estados dos Modais
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  // Estados dos Modais
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [checkinType, setCheckinType] = useState('Visita Realizada');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialData, setCreateInitialData] = useState({});
  const [isProfitModalOpen, setIsProfitModalOpen] = useState(false);
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  // Inicialização e persistência do tema (Light / Dark)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inova_theme') || 'dark';
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('inova_theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
  };

  // Rota do Dia
  const [routeList, setRouteList] = useState([]);

  // Sincronização em segundo plano de interações salvas offline
  useEffect(() => {
    const handleOnline = async () => {
      const res = await syncPendingInteractions();
      if (res.synced > 0) {
        alert(`🚀 Conexão restabelecida! ${res.synced} interações da fila offline foram sincronizadas com o banco.`);
        window.dispatchEvent(new Event('refreshMap'));
      }
    };

    window.addEventListener('online', handleOnline);
    // Tenta sincronizar se já estiver online ao inicializar
    syncPendingInteractions();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

// Mapeamento canônico das cidades oficiais da praça comercial da Inova Beauty
const CITY_CANONICAL_MAP = {
  'timon': 'Timon',
  'timom': 'Timon',
  'caxias': 'Caxias',
  'bacabal': 'Bacabal',
  'codo': 'Codó',
  'barra do corda': 'Barra do Corda',
  'presidente dutra': 'Presidente Dutra',
  'pedreiras': 'Pedreiras',
  'lago da pedra': 'Lago da Pedra',
  'coelho neto': 'Coelho Neto',
  'matoes': 'Matões',
  'parnarama': 'Parnarama',
  'peritoro': 'Peritoró',
  'sao joao do soter': 'São João do Soter',
  'teresina': 'Teresina',
  'aldeias altas': 'Aldeias Altas',
  'coroata': 'Coroatá'
};

function getCanonicalCity(rawCity) {
  if (!rawCity) return null;
  const normalized = rawCity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return CITY_CANONICAL_MAP[normalized] || null;
}

  // Busca lista de cidades únicas cadastradas no Supabase (filtrada estritamente pelas cidades oficiais da Inova)
  useEffect(() => {
    async function loadCities() {
      try {
        let rawList = [];

        // Tenta buscar contagem agregada diretamente no PostgreSQL via RPC
        const { data: rpcData, error: rpcError } = await supabase.rpc('obter_contagem_cidades');
        if (!rpcError && rpcData && rpcData.length > 0) {
          rawList = rpcData.map(c => ({ name: c.cidade, count: parseInt(c.count) }));
        } else {
          // Fallback para paginação em lote se a RPC não responder
          let allClients = [];
          let from = 0;
          const step = 1000;
          while (true) {
            const { data, error } = await supabase
              .from('clientes')
              .select('cidade')
              .not('cidade', 'is', null)
              .range(from, from + step - 1);

            if (error || !data || data.length === 0) break;
            allClients = allClients.concat(data);
            if (data.length < step) break;
            from += step;
          }

          const cityCounts = allClients.reduce((acc, curr) => {
            const c = curr.cidade?.trim();
            if (c) acc[c] = (acc[c] || 0) + 1;
            return acc;
          }, {});

          rawList = Object.keys(cityCounts).map(name => ({ name, count: cityCounts[name] }));
        }

        // Consolida e filtra ESTRITAMENTE pelas cidades oficiais da Inova
        // Ignora qualquer lixo de ERP, variações de maiúsculas ou clientes de fora da praça
        const consolidated = {};
        for (const item of rawList) {
          const canonical = getCanonicalCity(item.name);
          if (canonical) {
            consolidated[canonical] = (consolidated[canonical] || 0) + item.count;
          }
        }

        const sortedCities = Object.keys(consolidated)
          .sort((a, b) => consolidated[b] - consolidated[a])
          .map(name => ({ name, count: consolidated[name] }));

        setCities(sortedCities);
      } catch (err) {
        console.error('Erro ao carregar lista de cidades:', err);
      }
    }
    loadCities();
  }, []);

  // Ouvintes de eventos globais do mapa (abrir ficha ou modal de criação por drop pin)
  useEffect(() => {
    const handleOpenCard = (e) => {
      setSelectedClient(e.detail);
      setIsCreateModalOpen(false);
    };

    const handleOpenCreate = (e) => {
      setCreateInitialData({
        lat: e.detail.lat,
        lng: e.detail.lng,
        cidade: selectedCity || 'Caxias'
      });
      setIsCreateModalOpen(true);
      setSelectedClient(null);
    };
    
    window.addEventListener('openClientCard', handleOpenCard);
    window.addEventListener('openCreateCard', handleOpenCreate);

    return () => {
      window.removeEventListener('openClientCard', handleOpenCard);
      window.removeEventListener('openCreateCard', handleOpenCreate);
    };
  }, [selectedCity]);

  // Controle de Rotas
  const addToRoute = (client) => {
    if (!routeList.find(c => c.id === client.id)) {
      setRouteList([...routeList, client]);
      setSelectedClient(null); // Fecha a ficha para o consultor continuar no mapa
    }
  };

  const removeFromRoute = (clientId) => {
    setRouteList(routeList.filter(c => c.id !== clientId));
  };

  // Iniciar Rota com Google Maps
  const startGoogleMapsRoute = () => {
    if (routeList.length === 0) return;
    const destination = routeList[routeList.length - 1];
    const destCoords = `${destination.latitude},${destination.longitude}`;
    const waypoints = routeList.slice(0, -1).map(c => `${c.latitude},${c.longitude}`).join('|');
    
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destCoords}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, '_blank');
  };

  // Algoritmo de Otimização de Rotas (Comercial vs Menor Distância)
  const addAllFilteredToRoute = async (prioritizeRevenue = true) => {
    let query = supabase.from('clientes').select('*').not('latitude', 'is', null);
    if (selectedCity) {
      query = query.eq('cidade', selectedCity);
    } else if (isVendedor && userCities && userCities.length > 0) {
      query = query.in('cidade', userCities);
    }
    if (categoryFilter) query = query.contains('categorias', [categoryFilter]);
    if (funnelFilter) query = query.eq('status_funil', funnelFilter);
    query = query.limit(500);
    
    const { data } = await query;
    if (data) {
      const quinzeDiasAtras = new Date();
      quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 15);
      const hojeIso = new Date().toISOString().split('T')[0];
      const today = new Date().getDate();
      const nextDays = Array.from({ length: 6 }, (_, i) => ((today + i - 1) % 31) + 1);

      let available = data.filter(c => {
        if (routeList.find(r => r.id === c.id)) return false;
        if (!c.data_ultima_interacao) return true;
        return new Date(c.data_ultima_interacao) < quinzeDiasAtras;
      });

      if (available.length === 0) {
        alert("Nenhum salão disponível (ou todos já foram atendidos nos últimos 15 dias)!");
        return;
      }

      // Pontuação comercial ("Dinheiro na Mesa")
      const getCommercialScore = (c) => {
        let score = 0;
        // 1. Retorno agendado para hoje ou atrasado (+1000)
        if (c.data_retorno && c.data_retorno <= hojeIso) score += 1000;
        // 2. Negociação em andamento (+600)
        if (c.status_funil === 'negociacao') score += 600;
        // 3. Cartão virando nesta semana (+400)
        if (c.melhor_dia_compra && nextDays.includes(parseInt(c.melhor_dia_compra))) score += 400;
        // 4. Recompra prevista 25-45d (+300)
        if (c.data_ultima_compra) {
          const dias = Math.floor((new Date() - new Date(c.data_ultima_compra)) / (1000 * 60 * 60 * 24));
          if (dias >= 25 && dias <= 45) score += 300;
        }
        // 5. Cliente ativo (+100)
        if (c.status_funil === 'cliente_ativo') score += 100;
        return score;
      };

      if (prioritizeRevenue) {
        available.sort((a, b) => getCommercialScore(b) - getCommercialScore(a));
      }

      const newRoute = [...routeList];
      let currentRef = null;

      if (newRoute.length > 0) {
        currentRef = newRoute[newRoute.length - 1];
      } else if (selectedClient && selectedClient.latitude) {
        currentRef = selectedClient;
      } else {
        currentRef = available[0]; 
        newRoute.push(currentRef);
        available = available.filter(c => c.id !== currentRef.id);
      }

      while (newRoute.length < 15 && available.length > 0) {
        if (prioritizeRevenue) {
          available.sort((a, b) => {
            const distA = getDistance(parseFloat(currentRef.latitude), parseFloat(currentRef.longitude), parseFloat(a.latitude), parseFloat(a.longitude));
            const distB = getDistance(parseFloat(currentRef.latitude), parseFloat(currentRef.longitude), parseFloat(b.latitude), parseFloat(b.longitude));
            const scoreA = getCommercialScore(a);
            const scoreB = getCommercialScore(b);
            // Cada 100 pontos comerciais compensam 1km de distância física
            return (distA - (scoreA / 100)) - (distB - (scoreB / 100));
          });
        } else {
          available.sort((a, b) => {
            const distA = getDistance(parseFloat(currentRef.latitude), parseFloat(currentRef.longitude), parseFloat(a.latitude), parseFloat(a.longitude));
            const distB = getDistance(parseFloat(currentRef.latitude), parseFloat(currentRef.longitude), parseFloat(b.latitude), parseFloat(b.longitude));
            return distA - distB;
          });
        }

        const nearest = available[0];
        newRoute.push(nearest);
        currentRef = nearest;
        available.shift();
      }

      setRouteList(newRoute);
    }
  };

  // Otimizador de Trajeto Inteligente (Menor Distância via Nearest Neighbor)
  const handleOptimizeRouteOrder = () => {
    if (routeList.length < 2) return;

    let unvisited = [...routeList];
    const optimized = [];

    const runNearestNeighbor = (startLat, startLng) => {
      let currentLat = startLat;
      let currentLng = startLng;

      while (unvisited.length > 0) {
        unvisited.sort((a, b) => {
          const distA = getDistance(currentLat, currentLng, parseFloat(a.latitude), parseFloat(a.longitude));
          const distB = getDistance(currentLat, currentLng, parseFloat(b.latitude), parseFloat(b.longitude));
          return distA - distB;
        });
        const nearest = unvisited.shift();
        optimized.push(nearest);
        currentLat = parseFloat(nearest.latitude);
        currentLng = parseFloat(nearest.longitude);
      }
      setRouteList(optimized);
      alert('⚡ Trajeto otimizado com sucesso! As paradas foram reordenadas pelo menor trajeto.');
    };

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => runNearestNeighbor(pos.coords.latitude, pos.coords.longitude),
        () => {
          const first = unvisited.shift();
          optimized.push(first);
          runNearestNeighbor(parseFloat(first.latitude), parseFloat(first.longitude));
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const first = unvisited.shift();
      optimized.push(first);
      runNearestNeighbor(parseFloat(first.latitude), parseFloat(first.longitude));
    }
  };

  // Disparo dos Modais de Vendas
  const handleOpenWhatsAppScripts = (client) => {
    setSelectedClient(client);
    setIsWhatsAppModalOpen(true);
  };

  const handleOpenCheckin = (client, type = 'Visita Realizada') => {
    setSelectedClient(client);
    setCheckinType(type);
    setIsCheckinModalOpen(true);
  };

  // Reposicionamento de Pino no Mapa
  const handleStartRepositionPin = (client) => {
    setSelectedClient(null);
    setRepositioningClient(client);
  };

  const handleRepositionClick = async (latlng) => {
    if (!repositioningClient) return;

    const confirmMove = window.confirm(
      `Deseja mover o pino do salão "${repositioningClient.nome}" para esta nova localização no mapa?\n\nNovas Coordenadas: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
    );
    if (!confirmMove) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          latitude: latlng.lat,
          longitude: latlng.lng,
          localizacao_pendente: false
        })
        .eq('id', repositioningClient.id);

      if (!error) {
        const updated = {
          ...repositioningClient,
          latitude: latlng.lat,
          longitude: latlng.lng,
          localizacao_pendente: false
        };
        window.dispatchEvent(new Event('refreshMap'));
        setRepositioningClient(null);
        setSelectedClient(updated);
        alert(`📍 Localização de "${repositioningClient.nome}" atualizada com sucesso no novo ponto do mapa!`);
      } else {
        alert('Erro ao atualizar localização: ' + error.message);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar: ' + err.message);
    }
  };

  const displayedCities = isVendedor && userCities && userCities.length > 0
    ? cities.filter(c => userCities.includes(c.name))
    : cities;

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-full overflow-hidden bg-base-200 text-base-content fixed inset-0" data-theme={theme}>
      <Head>
        <title>CRM Inova Beauty | Rotas & Máquina de Vendas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover"/>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
      </Head>

      {/* 1. Navbar Superior com Busca Autocomplete */}
      <Navbar
        routeCount={routeList.length}
        onOpenRouteModal={() => setIsRouteModalOpen(true)}
        onOpenDailyReport={() => setIsDailyReportModalOpen(true)}
        onOpenTeamModal={() => setIsTeamModalOpen(true)}
        onOpenPwaInstall={() => setIsPwaModalOpen(true)}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        cities={displayedCities}
        funnelFilter={funnelFilter}
        onSelectFunnelFilter={setFunnelFilter}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSelectClient={(client) => {
          setSearchTarget(client);
          setSelectedClient(client);
        }}
        onOpenCreateClient={() => {
          setCreateInitialData({
            cidade: selectedCity || 'Caxias'
          });
          setIsCreateModalOpen(true);
          setSelectedClient(null);
        }}
      />

      {/* 2. Mini KPI Bar Retrátil (Radar Comercial) */}
      <KpiBar
        clients={loadedClients}
        activeCardFilter={cardFilter}
        onToggleCardFilter={() => setCardFilter(!cardFilter)}
        activeRepurchaseFilter={repurchaseFilter}
        onToggleRepurchaseFilter={() => setRepurchaseFilter(!repurchaseFilter)}
        activeReturnFilter={returnFilter}
        onToggleReturnFilter={() => setReturnFilter(!returnFilter)}
        activeStalledFilter={stalledFilter}
        onToggleStalledFilter={() => setStalledFilter(!stalledFilter)}
        funnelFilter={funnelFilter}
        onSelectFunnelFilter={setFunnelFilter}
      />

      {/* 3. Chips Táticos de Filtro (Categorias, Retornos, Negociações, Cartão, Recompra & Inadimplentes) */}
      <FilterChips
        categoryFilter={categoryFilter}
        onSelectCategory={setCategoryFilter}
        activeCardFilter={cardFilter}
        onToggleCardFilter={() => setCardFilter(!cardFilter)}
        activeRepurchaseFilter={repurchaseFilter}
        onToggleRepurchaseFilter={() => setRepurchaseFilter(!repurchaseFilter)}
        activeCreditAlertFilter={creditAlertFilter}
        onToggleCreditAlertFilter={() => setCreditAlertFilter(!creditAlertFilter)}
        activeReturnFilter={returnFilter}
        onToggleReturnFilter={() => setReturnFilter(!returnFilter)}
        activeStalledFilter={stalledFilter}
        onToggleStalledFilter={() => setStalledFilter(!stalledFilter)}
      />

      {/* Banner Flutuante de Modo de Reposicionamento de Pino */}
      {repositioningClient && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1001] bg-base-900/95 border-2 border-primary text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300 max-w-md w-[92%] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl animate-bounce">📍</span>
            <div className="text-xs">
              <div className="font-extrabold text-sm text-primary">Mudar Endereço no Mapa</div>
              <div className="text-gray-200">
                Toque no novo ponto no mapa onde fica <strong>{repositioningClient.nome}</strong>.
              </div>
            </div>
          </div>
          <button 
            onClick={() => setRepositioningClient(null)} 
            className="btn btn-xs btn-outline btn-error rounded-xl font-bold shrink-0"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* 4. Área do Mapa Interativo Leaflet */}
      <main className="flex-1 relative z-0">
        <MapComponent 
          cityFilter={selectedCity} 
          allowedCities={isVendedor ? userCities : null}
          categoryFilter={categoryFilter} 
          funnelFilter={funnelFilter}
          cardFilter={cardFilter}
          repurchaseFilter={repurchaseFilter}
          creditAlertFilter={creditAlertFilter}
          returnFilter={returnFilter}
          stalledFilter={stalledFilter}
          searchTarget={searchTarget}
          onClientsLoaded={setLoadedClients}
          repositioningClient={repositioningClient}
          onRepositionClick={handleRepositionClick}
        />
      </main>

      {/* 5. Ficha do Cliente Completa (ClientDrawer) */}
      {selectedClient && !isWhatsAppModalOpen && !isCheckinModalOpen && !isProfitModalOpen && !repositioningClient && (
        <ClientDrawer
          client={selectedClient}
          onClose={() => {
            setSelectedClient(null);
            if (typeof window !== 'undefined') window.scrollTo(0, 0);
          }}
          onUpdateClient={(updated) => setSelectedClient(updated)}
          onAddToRoute={addToRoute}
          isClientInRoute={routeList.some(c => c.id === selectedClient.id)}
          onOpenWhatsAppScripts={handleOpenWhatsAppScripts}
          onOpenCheckin={handleOpenCheckin}
          onStartRepositionPin={handleStartRepositionPin}
          onOpenProfitCalculator={(client) => {
            setSelectedClient(client);
            setIsProfitModalOpen(true);
          }}
        />
      )}

      {/* 6. Modal da Central de Scripts WhatsApp (PNL, Combos & Venda Inversa) */}
      <WhatsAppScriptModal
        client={selectedClient}
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />

      {/* 7. Modal de Check-in com Quick Tags & Google Agenda */}
      <VisitCheckinModal
        client={selectedClient}
        interactionType={checkinType}
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        onSaveSuccess={(updatedClient) => setSelectedClient(updatedClient)}
      />

      {/* 8. Modal de Rotas do Dia & Navegação */}
      <RouteModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        routeList={routeList}
        onRemoveFromRoute={removeFromRoute}
        onClearRoute={() => setRouteList([])}
        onStartNavigation={startGoogleMapsRoute}
        onAutoAddNearest={addAllFilteredToRoute}
        onOptimizeRouteOrder={handleOptimizeRouteOrder}
      />

      {/* 9. Modal de Cadastro Rápido (Drop Pin) */}
      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        initialData={createInitialData}
        onCreatedSuccess={(newClient) => setSelectedClient(newClient)}
      />

      {/* 10. Modal da Calculadora de Lucro do Salão (Arma de Fechamento na Mesa) */}
      <ProfitCalculatorModal
        client={selectedClient}
        isOpen={isProfitModalOpen}
        onClose={() => setIsProfitModalOpen(false)}
      />

      {/* 11. Modal do Relatório Diário de Fechamento (1 Toque para WhatsApp da Diretoria) */}
      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onClose={() => setIsDailyReportModalOpen(false)}
        clients={loadedClients}
      />

      {/* 12. Modal de Gestão da Equipe & Carteiras (Apenas Gestor) */}
      {isGestor && (
        <TeamManagementModal
          isOpen={isTeamModalOpen}
          onClose={() => setIsTeamModalOpen(false)}
          availableCities={cities}
        />
      )}

      {/* 13. Modal de Instalação PWA no Celular */}
      <PwaInstallPrompt
        isOpen={isPwaModalOpen}
        onClose={() => setIsPwaModalOpen(false)}
      />

    </div>
  );
}
