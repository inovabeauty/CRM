import { useState } from 'react';

export default function KpiBar({
  clients = [],
  activeCardFilter,
  onToggleCardFilter,
  activeRepurchaseFilter,
  onToggleRepurchaseFilter,
  activeReturnFilter,
  onToggleReturnFilter,
  activeStalledFilter,
  onToggleStalledFilter,
  funnelFilter,
  onSelectFunnelFilter
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Data de hoje e janela de virada do cartão (próximos 5 dias)
  const today = new Date().getDate();
  const nextDays = Array.from({ length: 6 }, (_, i) => ((today + i - 1) % 31) + 1);
  const hojeIso = new Date().toISOString().split('T')[0];

  // 1. Retornos agendados para hoje ou pendentes
  const retornosCount = clients.filter((c) => {
    if (!c.data_retorno) return false;
    return c.data_retorno <= hojeIso;
  }).length;

  // 2. Negociações paradas (+7 dias sem contato ou sem interação registrada)
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const negociacaoParadaCount = clients.filter((c) => {
    if (c.status_funil !== 'negociacao') return false;
    if (!c.data_ultima_interacao) return true;
    return new Date(c.data_ultima_interacao) <= seteDiasAtras;
  }).length;

  // 3. Cartões virando
  const cartoesVirandoCount = clients.filter((c) => {
    if (!c.melhor_dia_compra) return false;
    const dia = parseInt(c.melhor_dia_compra);
    return nextDays.includes(dia);
  }).length;

  // 4. Recompra prevista (25-45 dias)
  const recompraCount = clients.filter((c) => {
    if (!c.data_ultima_compra) return false;
    const dias = Math.floor((new Date() - new Date(c.data_ultima_compra)) / (1000 * 60 * 60 * 24));
    return dias >= 25 && dias <= 45;
  }).length;

  // 5. Visitas Hoje
  const visitasHojeCount = clients.filter((c) => {
    if (!c.data_ultima_interacao) return false;
    return c.data_ultima_interacao.startsWith(hojeIso);
  }).length;

  // 6. Resgate (+45 dias)
  const resgateCount = clients.filter((c) => {
    if (c.status_funil === 'alerta_resgate') return true;
    if (!c.data_ultima_compra) return false;
    const dias = Math.floor((new Date() - new Date(c.data_ultima_compra)) / (1000 * 60 * 60 * 24));
    return dias >= 45;
  }).length;

  // 7. Clientes Ativos
  const ativosCount = clients.filter((c) => c.status_funil === 'cliente_ativo').length;

  return (
    <div className="bg-base-100/95 backdrop-blur-xs border-b border-base-200 px-3 py-1.5 z-10 shrink-0 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold tracking-tight text-base-content/90 flex items-center gap-1">
            📊 Radar de Metas
          </span>
          <span className="text-[10px] text-gray-400 font-mono">
            {clients.length} salões
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="btn btn-ghost btn-xs text-[10px] gap-1 text-gray-400 hover:text-base-content font-medium"
          title={isExpanded ? 'Recolher métricas' : 'Expandir métricas'}
        >
          <span>{isExpanded ? '▲ Recolher' : '▼ Métricas'}</span>
        </button>
      </div>

      {isExpanded ? (
        <div className="flex items-center gap-2 mt-1.5 overflow-x-auto no-scrollbar scroll-smooth sm:grid sm:grid-cols-7 animate-in slide-in-from-top-1 duration-150 pb-0.5">
          
          {/* Card 1: Retornos Agendados (Hoje / Atrasados) */}
          <div
            onClick={onToggleReturnFilter}
            className={`cursor-pointer shrink-0 min-w-[125px] sm:min-w-0 p-2 rounded-xl border transition-all flex items-center justify-between ${
              activeReturnFilter
                ? 'bg-primary/20 border-primary text-primary-content shadow-xs'
                : retornosCount > 0
                ? 'bg-primary/10 hover:bg-primary/15 border-primary/40'
                : 'bg-base-200/60 hover:bg-base-200 border-base-300/80'
            }`}
            title="Salões com retorno agendado para hoje ou pendente"
          >
            <div>
              <span className="text-[10px] font-semibold text-base-content/65 block leading-tight">
                🔔 Retornos
              </span>
              <span className="text-sm font-extrabold text-primary">{retornosCount}</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">Hoje</span>
          </div>

          {/* Card 2: Negociação Parada (+7d) */}
          <div
            onClick={onToggleStalledFilter}
            className={`cursor-pointer shrink-0 min-w-[130px] sm:min-w-0 p-2 rounded-xl border transition-all flex items-center justify-between ${
              activeStalledFilter
                ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs'
                : negociacaoParadaCount > 0
                ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/40'
                : 'bg-base-200/60 hover:bg-base-200 border-base-300/80'
            }`}
            title="Salões em negociação sem contato há mais de 7 dias"
          >
            <div>
              <span className="text-[10px] font-semibold text-base-content/65 block leading-tight">
                🔥 Negoc. Parada
              </span>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{negociacaoParadaCount}</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">+7d</span>
          </div>

          {/* Card 3: Cartão Virando */}
          <div
            onClick={onToggleCardFilter}
            className={`cursor-pointer shrink-0 min-w-[125px] sm:min-w-0 p-2 rounded-xl border transition-all flex items-center justify-between ${
              activeCardFilter
                ? 'bg-amber-500/20 border-amber-500/80 text-amber-800 dark:text-amber-300 shadow-xs'
                : 'bg-base-200/60 hover:bg-base-200 border-base-300/80'
            }`}
            title="Salões com cartão virando nesta semana"
          >
            <div>
              <span className="text-[10px] font-semibold text-base-content/65 block leading-tight">
                💳 Cartão Virando
              </span>
              <span className="text-sm font-extrabold text-base-content">{cartoesVirandoCount}</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">Semana</span>
          </div>

          {/* Card 4: Recompra Prevista */}
          <div
            onClick={onToggleRepurchaseFilter}
            className={`cursor-pointer shrink-0 min-w-[125px] sm:min-w-0 p-2 rounded-xl border transition-all flex items-center justify-between ${
              activeRepurchaseFilter
                ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-800 dark:text-emerald-300 shadow-xs'
                : 'bg-base-200/60 hover:bg-base-200 border-base-300/80'
            }`}
            title="Salões no período ideal de recompra (25 a 45 dias)"
          >
            <div>
              <span className="text-[10px] font-semibold text-base-content/65 block leading-tight">
                ⏳ Recompra 25-45d
              </span>
              <span className="text-sm font-extrabold text-base-content">{recompraCount}</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">Estoque</span>
          </div>

          {/* Card 5: Visitas Realizadas Hoje */}
          <div className="shrink-0 min-w-[120px] sm:min-w-0 p-2 rounded-xl bg-base-200/60 border border-base-300/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-base-content/65 block leading-tight">
                🎯 Visitas Hoje
              </span>
              <span className="text-sm font-extrabold text-primary">{visitasHojeCount}</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">Hoje</span>
          </div>

          {/* Card 6: Alertas de Resgate */}
          <div
            onClick={() => onSelectFunnelFilter(funnelFilter === 'alerta_resgate' ? '' : 'alerta_resgate')}
            className={`cursor-pointer shrink-0 min-w-[120px] sm:min-w-0 p-2 rounded-xl border transition-all flex items-center justify-between ${
              funnelFilter === 'alerta_resgate'
                ? 'bg-rose-500/20 border-rose-500/80 text-rose-800 dark:text-rose-300 shadow-xs'
                : 'bg-base-200/60 hover:bg-base-200 border-base-300/80'
            }`}
            title="Salões inativos há mais de 45 dias"
          >
            <div>
              <span className="text-[10px] font-semibold text-base-content/65 block leading-tight">
                🔴 Resgate (+45d)
              </span>
              <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">{resgateCount}</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-800 dark:text-rose-300">Inativos</span>
          </div>

          {/* Card 7: Clientes Ativos */}
          <div
            onClick={() => onSelectFunnelFilter(funnelFilter === 'cliente_ativo' ? '' : 'cliente_ativo')}
            className={`cursor-pointer shrink-0 min-w-[120px] sm:min-w-0 p-2 rounded-xl border transition-all flex items-center justify-between ${
              funnelFilter === 'cliente_ativo'
                ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-800 dark:text-emerald-300 shadow-xs'
                : 'bg-base-200/60 hover:bg-base-200 border-base-300/80'
            }`}
            title="Clientes ativos na carteira"
          >
            <div>
              <span className="text-[10px] font-semibold text-base-content/65 block leading-tight">
                🟢 Ativos
              </span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{ativosCount}</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">Ativos</span>
          </div>

        </div>
      ) : (
        /* Linha compacta quando recolhido */
        <div className="flex items-center gap-3 text-[11px] text-gray-400 overflow-x-auto no-scrollbar py-0.5">
          {retornosCount > 0 && (
            <>
              <span className="flex items-center gap-1 font-semibold text-primary">
                🔔 {retornosCount} retornos
              </span>
              <span>•</span>
            </>
          )}
          {negociacaoParadaCount > 0 && (
            <>
              <span className="flex items-center gap-1 font-semibold text-amber-400">
                🔥 {negociacaoParadaCount} negoc. paradas
              </span>
              <span>•</span>
            </>
          )}
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            💳 {cartoesVirandoCount} virando
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            ⏳ {recompraCount} recompras
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-semibold text-primary">
            🎯 {visitasHojeCount} visitas
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-semibold text-rose-400">
            🔴 {resgateCount} resgate
          </span>
        </div>
      )}
    </div>
  );
}
