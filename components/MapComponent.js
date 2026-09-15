import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import 'leaflet/dist/leaflet.css';

export default function MapComponent({ cityFilter, categoryFilter }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Busca dados no Supabase
  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        let query = supabase
          .from('clientes')
          .select('id, nome, latitude, longitude, categorias, whatsapp, status_funil, cidade')
          .limit(5000);

        if (cityFilter) query = query.eq('cidade', cityFilter);
        if (categoryFilter) query = query.contains('categorias', [categoryFilter]);

        const { data, error } = await query;
        if (error) throw error;

        const validClients = (data || []).filter(
          c => !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude))
        );
        setClients(validClients);
      } catch (error) {
        console.error('Erro ao buscar clientes no Supabase:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, [cityFilter, categoryFilter]);

  // Inicializa o Mapa Leaflet
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      const L = (await import('leaflet')).default;

      // Evita reinicializar se já existir
      if (!mapInstanceRef.current && isMounted) {
        const map = L.map(mapContainerRef.current, {
          center: [-4.8780, -43.3537], // Padrão MA
          zoom: 12,
          zoomControl: true,
        });

        // Camada do OpenStreetMap (100% livre e gratuita)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        markersLayerRef.current = markersLayer;

        setTimeout(() => {
          map.invalidateSize();
        }, 200);
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Plota marcadores quando os clientes ou o mapa mudam
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || typeof window === 'undefined') return;

    async function plotMarkers() {
      const L = (await import('leaflet')).default;
      const markersLayer = markersLayerRef.current;
      const map = mapInstanceRef.current;

      markersLayer.clearLayers();

      if (!clients.length) return;

      const latLngs = [];

      clients.forEach(client => {
        const lat = parseFloat(client.latitude);
        const lng = parseFloat(client.longitude);
        if (isNaN(lat) || isNaN(lng)) return;

        latLngs.push([lat, lng]);

        const isAtivo = client.status_funil === 'cliente_ativo';

        // Pin personalizado via SVG / HTML
        const customIcon = L.divIcon({
          className: 'custom-pin-marker',
          html: `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              background-color: ${isAtivo ? '#10b981' : '#2563eb'};
              color: white;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.35);
              cursor: pointer;
            ">
              <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        marker.on('click', () => {
          window.dispatchEvent(new CustomEvent('openClientCard', { detail: client }));
        });

        markersLayer.addLayer(marker);
      });

      // Enquadra a visão nos pinos encontrados
      if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    }

    plotMarkers();
  }, [clients]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-100 bg-opacity-75">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '100%', zIndex: 0 }} />
    </div>
  );
}
