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
  'aldeias altas': { lat: -4.6289, lng: -43.4764 }
};

export function cleanPhoneDigits(p) {
  if (!p) return '';
  const digits = p.replace(/\D/g, '').replace(/^55/, '');
  // Retorna os últimos 8 dígitos para ser tolerante a variações de DDD ou 9º dígito
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

export function cleanNormalizedName(n) {
  if (!n) return '';
  return n.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(salao|studio|beleza|hair|espaco|centro|atelie|estetica|cabeleireiro|cabeleireira)\b/g, '')
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
      .select('id, nome, responsavel, whatsapp, telefone_alternativo, cidade, endereco, latitude, longitude, erp_cliente_id, status_funil, linha_interesse')
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
    const eCity = cleanNormalizedName(ec.cidade);

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
        const cityMatch = !eCity || !cCity || eCity === cCity || eCity.includes(cCity) || cCity.includes(eCity);
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
        const cityMatch = !eCity || !cCity || eCity === cCity;
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

    // APLICAÇÃO DO VÍNCULO (SOMENTE EM SALÕES JÁ EXISTENTES NA BASE DO CRM)
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

      if (temBoletoAtrasado) {
        // Se possui pendência no ERP, classifica no funil como 'em_atraso' para ação de regularização
        updatePayload.status_funil = 'em_atraso';
      } else if (match.status_funil === 'em_atraso') {
        // Se regularizou o débito no ERP, retorna automaticamente para ativo ou resgate
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
        cidade: match.cidade || ec.cidade,
        motivo: matchReason,
        compras: comprasDoCliente.length,
        inadimplente: temBoletoAtrasado
      });

    } else {
      // NÃO INSERE CLIENTES FANTASMAS OU SEM COORDENADAS PARA NÃO POLUIR O MAPA OU FUNIL DE CIDADES
      matchReports.push({
        status: 'SEM_VINCULO',
        erp: ec.nome_estabelecimento,
        cidade: ec.cidade,
        motivo: 'Salão do ERP não localizado na base territorial do CRM (ignorado para não poluir o mapa nem a lista de cidades)',
        compras: comprasDoCliente.length,
        inadimplente: temBoletoAtrasado
      });
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
