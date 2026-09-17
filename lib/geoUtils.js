/**
 * Utilitários de Geolocalização para o CRM Inova Beauty
 * Permite extrair latitude e longitude de links do Google Maps,
 * coordenadas brutas com vírgula ou ponto, e detectar inversões comuns.
 */

export function parseCoordinatesInput(input) {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Entrada vazia.' };
  }

  const raw = input.trim();
  if (!raw) {
    return { success: false, error: 'Entrada vazia.' };
  }

  let lat = null;
  let lng = null;
  let source = 'coords';

  // 1. Tenta extrair de URLs do Google Maps
  // Padrão 1: /@(-?\d+\.\d+),(-?\d+\.\d+)
  const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    lat = parseFloat(atMatch[1]);
    lng = parseFloat(atMatch[2]);
    source = 'url_at';
  }

  // Padrão 2: ?q=(-?\d+\.\d+),(-?\d+\.\d+) ou ?ll= ou &query=
  if (lat === null) {
    const qMatch = raw.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (qMatch) {
      lat = parseFloat(qMatch[1]);
      lng = parseFloat(qMatch[2]);
      source = 'url_query';
    }
  }

  // Padrão 3: place/.../(-?\d+\.\d+),(-?\d+\.\d+)
  if (lat === null) {
    const placeMatch = raw.match(/place\/[^/]*\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (placeMatch) {
      lat = parseFloat(placeMatch[1]);
      lng = parseFloat(placeMatch[2]);
      source = 'url_place';
    }
  }

  // Padrão 4: geo:(-?\d+\.\d+),(-?\d+\.\d+)
  if (lat === null) {
    const geoMatch = raw.match(/geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (geoMatch) {
      lat = parseFloat(geoMatch[1]);
      lng = parseFloat(geoMatch[2]);
      source = 'geo_uri';
    }
  }

  // 2. Extrai coordenadas brutas de texto (aceita vírgula ou ponto decimal)
  if (lat === null) {
    // Procura por números decimais com sinal opcional (ex: -4.862415 ou -4,862415)
    const matches = raw.match(/-?\d+(?:[.,]\d+)?/g);
    if (matches && matches.length >= 2) {
      const num1 = parseFloat(matches[0].replace(',', '.'));
      const num2 = parseFloat(matches[1].replace(',', '.'));
      if (!isNaN(num1) && !isNaN(num2)) {
        lat = num1;
        lng = num2;
        source = 'raw_coords';
      }
    }
  }

  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return {
      success: false,
      error: 'Formato não reconhecido. Cole coordenadas (ex: -4.862415, -43.356210) ou um link do Google Maps.'
    };
  }

  // 3. Detecção e correção de inversão Lat/Long
  // No Brasil (especialmente Maranhão e Nordeste):
  // Latitude fica entre +5 e -33 (Maranhão: -1 a -10)
  // Longitude fica entre -34 e -74 (Maranhão: -41 a -48)
  let wasInverted = false;
  if (lat < -33 && lat > -75 && lng > -33 && lng < 10) {
    // Usuário colou Longitude primeiro e Latitude depois!
    const temp = lat;
    lat = lng;
    lng = temp;
    wasInverted = true;
  }

  // Validação geral de limites geográficos globais
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      success: false,
      error: 'Coordenadas fora dos limites do globo terrestre (Lat: -90 a 90, Lng: -180 a 180).'
    };
  }

  return {
    success: true,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    source,
    wasInverted
  };
}

export function getGoogleMapsUrl(lat, lng) {
  if (lat == null || lng == null) return '#';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function formatCoordinates(lat, lng) {
  if (lat == null || lng == null) return '';
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

export function maskBrazilianPhone(value) {
  if (!value) return '';
  let digits = value.toString().replace(/\D/g, '');
  // Se o usuário colou com 55 ou 5555 na frente, remove o DDI para manter apenas DDD + Número
  while (digits.startsWith('5555')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}
