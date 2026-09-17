import { erpSupabase } from './erpClient.js';
import { supabase as crmSupabase } from './supabaseClient.js';

export const CITY_CENTROIDS = {
  'caxias': { lat: -4.8625, lng: -43.3644 },
  'timon': { lat: -5.0939, lng: -42.8367 },
  'codo': { lat: -4.4553, lng: -43.8856 },
  'teresina': { lat: -5.0919, lng: -42.8034 },
  'sao luis': { lat: -2.5307, lng: -44.3068 },
  'bacabal': { lat: -4.2403, lng: -44.7806 },
  'barra do corda': { lat: -5.5056, lng: -45.2444 },
  'coelho neto': { lat: -4.2564, lng: -43.0131 },
  'coroata': { lat: -4.1306, lng: -44.1239 },
  'presidente dutra': { lat: -5.2917, lng: -44.4917 },
  'pedreiras': { lat: -4.5681, lng: -44.5969 },
  'peritoro': { lat: -4.3806, lng: -44.3333 },
  'sao mateus': { lat: -4.0389, lng: -44.4722 },
  'matinha': { lat: -3.1000, lng: -45.0333 },
  'aldeias altas': { lat: -4.6289, lng: -43.4764 },
  'sao joao do soter': { lat: -5.0772, lng: -43.8117 },
  'matoes': { lat: -5.5186, lng: -43.2014 },
  'lago da pedra': { lat: -4.5706, lng: -45.1633 },
  'parnarama': { lat: -5.6811, lng: -43.0906 }
};

const CITY_CANONICAL_MAP = {
  'caxias': 'Caxias',
  'timon': 'Timon',
  'timom': 'Timon',
  'codo': 'Codó',
  'sao joao do soter': 'São João do Soter',
  'aldeias altas': 'Aldeias Altas',
  'matoes': 'Matões',
  'lago da pedra': 'Lago da Pedra',
  'teresina': 'Teresina',
  'bacabal': 'Bacabal',
  'barra do corda': 'Barra do Corda',
  'presidente dutra': 'Presidente Dutra',
  'pedreiras': 'Pedreiras',
  'coelho neto': 'Coelho Neto',
  'parnarama': 'Parnarama',
  'sao luis': 'São Luís'
};

export function cleanPhoneDigits(p) {
  if (!p) return '';
  let digits = p.toString().replace(/\D/g, '');
  // Corrige erro do ERP onde o 55 foi duplicado no campo de DDD
  while (digits.startsWith('5555')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  // Retorna os últimos 8 dígitos para comparação tolerante a variações de 9º dígito
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

export function formatPhoneForCrm(p) {
  if (!p) return null;
  let digits = p.toString().replace(/\D/g, '');
  while (digits.startsWith('5555')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (!digits) return null;

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function cleanNormalizedName(n) {
  if (!n) return '';
  return n.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ') // remove anotações entre parênteses como (BARBEARIA), (HOME CARE), etc.
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(salao|studio|beleza|hair|espaco|centro|atelie|estetica|cabeleireiro|cabeleireira|de|da|do|das|dos|e)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Motor Principal de Sincronização Unidirecional (ERP -> CRM)
 * REGRA: O ERP NUNCA É ALTERADO. O CRM apenas lê do ERP e atualiza sua própria base.
 */
export async function runErpSync(customCrmClient = null) {
  const db = customCrmClient || crmSupabase;
  const syncStartTime = new Date();
  const hojeIso = syncStartTime.toISOString().split('T')[0];

  // 1. CARREGA DADOS DO ERP (SOMENTE LEITURA)
  const [
    { data: erpClients, error: errClients },
    { data: erpVendas, error: errVendas },
    { data: erpItens, error: errItens },
    { data: erpBoletos, error: errBoletos }
  ] = await Promise.all([
    erpSupabase.from('clientes').select('id, nome_estabelecimento, nome_responsavel, telefone, cidade, endereco, bairro, ponto_referencia, ativo'),
    erpSupabase.from('vendas').select('id, cliente_id, total_final, data_venda, status, observacao, forma_pagamento').order('data_venda', { ascending: false }),
    erpSupabase.from('venda_itens').select('id, venda_id, produto_id, quantidade, preco_unitario, produtos(nome)'),
    erpSupabase.from('boletos').select('id, cliente_id, valor, data_vencimento, status')
  ]);

  if (errClients || errVendas) {
    throw new Error(`Erro ao conectar com ERP: ${errClients?.message || errVendas?.message}`);
  }

  // 2. MAPEIA ITENS VENDIDOS POR VENDA
  const itensPorVenda = (erpItens || []).reduce((acc, item) => {
    if (!acc[item.venda_id]) acc[item.venda_id] = [];
    const prodNome = item.produtos?.nome || 'Produto Profissional';
    acc[item.venda_id].push(`${prodNome} (x${item.quantidade})`);
    return acc;
  }, {});

  // 3. AGRUPA VENDAS POR CLIENTE DO ERP
  const vendasPorCliente = (erpVendas || []).reduce((acc, venda) => {
    if (venda.status === 'cancelada') return acc;
    if (!acc[venda.cliente_id]) acc[venda.cliente_id] = [];
    
    const itensNomes = itensPorVenda[venda.id] || [];
    acc[venda.cliente_id].push({
      id: venda.id,
      data: venda.data_venda ? venda.data_venda.split('T')[0] : hojeIso,
      valor: parseFloat(venda.total_final) || 0,
      forma_pagamento: venda.forma_pagamento || 'Outro',
      itens: itensNomes.length > 0 ? itensNomes.join(', ') : 'Venda balcão / kit profissional'
    });
    return acc;
  }, {});

  // 4. AGRUPA BOLETOS POR CLIENTE DO ERP
  const boletosAtrasadosPorCliente = (erpBoletos || []).reduce((acc, boleto) => {
    if (boleto.status === 'aberto' && boleto.data_vencimento < hojeIso) {
      acc[boleto.cliente_id] = true;
    }
    return acc;
  }, {});

  // 5. CARREGA TODOS OS CLIENTES DO CRM (COM PAGINAÇÃO SUPABASE)
  let crmClients = [];
  let from = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await db
      .from('clientes')
      .select('id, nome, responsavel, whatsapp, telefone_alternativo, cidade, endereco, latitude, longitude, erp_cliente_id, status_funil, linha_interesse, localizacao_pendente')
      .range(from, from + step - 1);

    if (error || !data || data.length === 0) break;
    crmClients = crmClients.concat(data);
    if (data.length < step) break;
    from += step;
  }

  // 6. PROCESSAMENTO E MATCHING
  let matchedCount = 0;
  let createdCount = 0;
  let overdueCount = 0;
  let totalRevenue = 0;
  let totalSalesSynced = 0;

  const matchReports = [];

  for (const ec of (erpClients || [])) {
    const comprasDoCliente = vendasPorCliente[ec.id] || [];
    const temBoletoAtrasado = Boolean(boletosAtrasadosPorCliente[ec.id]);
    if (temBoletoAtrasado) overdueCount++;

    const totalGasto = comprasDoCliente.reduce((sum, c) => sum + c.valor, 0);
    totalRevenue += totalGasto;
    totalSalesSynced += comprasDoCliente.length;

    // Detecta marcas compradas no ERP (Olenka x MUP Collor x Mup Makeup)
    const allItensStr = comprasDoCliente.map(c => c.itens).join(' ').toLowerCase();
    const hasOlenka = allItensStr.includes('olenka') || allItensStr.includes('royal look') || allItensStr.includes('botox') || allItensStr.includes('ph acid');
    const hasMakeup = allItensStr.includes('makeup') || allItensStr.includes('make up') || allItensStr.includes('maquiagem') || allItensStr.includes('batom') || allItensStr.includes('base ') || allItensStr.includes('sombra');
    const hasMup = (allItensStr.includes('mup') && !hasMakeup) || allItensStr.includes('mup collor') || allItensStr.includes('louro') || allItensStr.includes('castanho') || allItensStr.includes('ox');

    const brandList = [];
    if (hasOlenka) brandList.push('Olenka Cosméticos');
    if (hasMup) brandList.push('MUP Collor');
    if (hasMakeup) brandList.push('Mup Makeup');
    const linhaDetectada = brandList.length > 0 ? brandList.join(', ') : null;

    const dataUltimaCompra = comprasDoCliente.length > 0 ? comprasDoCliente[0].data : null;

    // Status do Funil inteligente pelo histórico do ERP
    let novoStatusFunil = 'cliente_ativo';
    if (temBoletoAtrasado) {
      novoStatusFunil = 'em_atraso';
    } else if (dataUltimaCompra) {
      const diasSemCompra = Math.floor((new Date() - new Date(dataUltimaCompra)) / (1000 * 60 * 60 * 24));
      if (diasSemCompra > 45) {
        novoStatusFunil = 'alerta_resgate';
      }
    }

    // Busca Match no CRM
    const ePhone = cleanPhoneDigits(ec.telefone);
    const eName = cleanNormalizedName(ec.nome_estabelecimento);
    const eResp = cleanNormalizedName(ec.nome_responsavel);
    const rawCityKey = (ec.cidade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const canonicalCity = CITY_CANONICAL_MAP[rawCityKey] || ec.cidade || 'Caxias';

    let match = null;
    let matchReason = '';

    // 1. Match exato por erp_cliente_id prévio
    match = crmClients.find(cc => cc.erp_cliente_id === ec.id);
    if (match) matchReason = 'ID ERP';

    // 2. Match por Telefone / WhatsApp
    if (!match && ePhone && ePhone.length >= 8) {
      match = crmClients.find(cc => {
        const cPhone1 = cleanPhoneDigits(cc.whatsapp);
        const cPhone2 = cleanPhoneDigits(cc.telefone_alternativo);
        return (cPhone1 && cPhone1 === ePhone) || (cPhone2 && cPhone2 === ePhone);
      });
      if (match) matchReason = `Telefone (${ec.telefone})`;
    }

    // 3. Match por Nome do Salão + Cidade
    if (!match && eName && eName.length >= 3) {
      match = crmClients.find(cc => {
        const cName = cleanNormalizedName(cc.nome);
        const cCity = cleanNormalizedName(cc.cidade);
        const cityMatch = !rawCityKey || !cCity || rawCityKey === cCity || rawCityKey.includes(cCity) || cCity.includes(rawCityKey);
        const nameMatch = cName === eName || (cName.includes(eName) && eName.length >= 4) || (eName.includes(cName) && cName.length >= 4);
        return cityMatch && nameMatch;
      });
      if (match) matchReason = `Nome (${ec.nome_estabelecimento}) + Cidade (${ec.cidade})`;
    }

    // 4. Match por Nome da Responsável + Cidade
    if (!match && eResp && eResp.length >= 4) {
      match = crmClients.find(cc => {
        const cResp = cleanNormalizedName(cc.responsavel);
        const cCity = cleanNormalizedName(cc.cidade);
        const cityMatch = !rawCityKey || !cCity || rawCityKey === cCity;
        return cityMatch && cResp && (cResp === eResp || cResp.includes(eResp) || eResp.includes(cResp));
      });
      if (match) matchReason = `Responsável (${ec.nome_responsavel})`;
    }

    // Ignorar clientes genéricos, de balcão ou fora da praça comercial da Inova (ex: Clientes Finais, Parauapebas, Marabá)
    const rawCheck = `${ec.nome_estabelecimento || ''} ${ec.nome_responsavel || ''} ${ec.cidade || ''}`.toLowerCase();
    if (
      rawCheck.includes('cliente final') ||
      rawCheck.includes('clientes finais') ||
      rawCheck.includes('consumidor') ||
      rawCheck.includes('balcao') ||
      rawCheck.includes('teste') ||
      rawCheck.includes('paraoapebas') ||
      rawCheck.includes('parauapebas') ||
      rawCheck.includes('maraba')
    ) {
      continue;
    }

    // APLICAÇÃO DO VÍNCULO OU INSERÇÃO COM LOCALIZACAO_PENDENTE = TRUE
    if (match) {
      // ATUALIZA SALÃO EXISTENTE NO CRM
      const updatePayload = {
        erp_cliente_id: ec.id,
        data_ultima_compra: dataUltimaCompra || match.data_ultima_compra,
        ultimas_compras: comprasDoCliente.slice(0, 10),
        boleto_atrasado: temBoletoAtrasado,
        valor_total_comprado: totalGasto,
        qtd_compras: comprasDoCliente.length
      };

      if (!match.whatsapp && ec.telefone) {
        updatePayload.whatsapp = formatPhoneForCrm(ec.telefone);
      }
      if (!match.responsavel && ec.nome_responsavel) {
        updatePayload.responsavel = ec.nome_responsavel.trim();
      }

      if (temBoletoAtrasado) {
        updatePayload.status_funil = 'em_atraso';
      } else if (match.status_funil === 'em_atraso') {
        updatePayload.status_funil = novoStatusFunil;
      } else if (novoStatusFunil && (!match.status_funil || match.status_funil === 'prospect' || match.status_funil === 'negociacao')) {
        updatePayload.status_funil = novoStatusFunil;
      }
      if (linhaDetectada && !match.linha_interesse) {
        updatePayload.linha_interesse = linhaDetectada;
      }

      await db.from('clientes').update(updatePayload).eq('id', match.id);
      matchedCount++;
      matchReports.push({
        status: 'VINCULADO',
        erp: ec.nome_estabelecimento,
        crm: match.nome,
        cidade: match.cidade || canonicalCity,
        motivo: matchReason,
        compras: comprasDoCliente.length,
        inadimplente: temBoletoAtrasado
      });

    } else {
      // SALÃO DO ERP NÃO EXISTENTE NO CRM -> INSERE AUTOMATICAMENTE COM LOCALIZAÇÃO PENDENTE!
      const centroid = CITY_CENTROIDS[rawCityKey] || CITY_CENTROIDS['caxias'];
      // Jitter aleatório (~50 metros) para evitar sobreposição total de pinos na praça central
      const jitterLat = (Math.random() - 0.5) * 0.006;
      const jitterLng = (Math.random() - 0.5) * 0.006;

      let primaryCategory = '{"Salão de Beleza"}';
      const rawNomeLower = (ec.nome_estabelecimento || '').toLowerCase();
      if (rawNomeLower.includes('barber') || rawNomeLower.includes('barbearia')) {
        primaryCategory = '{"Barbearia"}';
      } else if (rawNomeLower.includes('makeup') || rawNomeLower.includes('maquiagem')) {
        primaryCategory = '{"Maquiagem"}';
      } else if (rawNomeLower.includes('estetica') || rawNomeLower.includes('clinica')) {
        primaryCategory = '{"Clínica de Estética"}';
      }

      const clientName = ec.nome_estabelecimento?.trim() || ec.nome_responsavel?.trim() || 'Salão ERP';
      const cleanAddress = ec.endereco?.trim()
        ? `${ec.endereco.trim()}${ec.bairro?.trim() ? ` - ${ec.bairro.trim()}` : ''}`
        : 'Endereço cadastrado no ERP (Validação em campo)';

      const newClientPayload = {
        nome: clientName,
        responsavel: ec.nome_responsavel?.trim() || null,
        whatsapp: formatPhoneForCrm(ec.telefone),
        cidade: canonicalCity,
        endereco: cleanAddress,
        latitude: centroid.lat + jitterLat,
        longitude: centroid.lng + jitterLng,
        status_funil: novoStatusFunil,
        categorias: primaryCategory,
        erp_cliente_id: ec.id,
        localizacao_pendente: true, // Posição GPS Pendente de Validação Presencial
        data_ultima_compra: dataUltimaCompra,
        ultimas_compras: comprasDoCliente.slice(0, 10),
        boleto_atrasado: temBoletoAtrasado,
        valor_total_comprado: totalGasto,
        qtd_compras: comprasDoCliente.length,
        linha_interesse: linhaDetectada
      };

      const { data: createdClient, error: insertErr } = await db
        .from('clientes')
        .insert([newClientPayload])
        .select('id, nome')
        .single();

      if (!insertErr) {
        createdCount++;
        matchReports.push({
          status: 'CRIADO_PENDENTE',
          erp: ec.nome_estabelecimento,
          crm: clientName,
          cidade: canonicalCity,
          motivo: 'Novo salão do ERP inserido no CRM com Localização Pendente para validação em campo',
          compras: comprasDoCliente.length,
          inadimplente: temBoletoAtrasado
        });
      } else {
        console.error(`Erro ao inserir salão ${clientName} do ERP no CRM:`, insertErr);
      }
    }
  }

  return {
    success: true,
    totalErp: erpClients.length,
    vinculadosExistentes: matchedCount,
    criadosNovos: createdCount,
    inadimplentesAtivos: overdueCount,
    totalVendasConsolidadas: totalSalesSynced,
    valorTotalFaturado: totalRevenue,
    duracaoMs: new Date() - syncStartTime,
    reports: matchReports
  };
}
