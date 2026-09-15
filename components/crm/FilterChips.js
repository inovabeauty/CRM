import { getCategoryEmoji } from '../../lib/categoryUtils';

export default function FilterChips({
  categoryFilter,
  onSelectCategory,
  activeCardFilter,
  onToggleCardFilter,
  activeRepurchaseFilter,
  onToggleRepurchaseFilter,
  activeCreditAlertFilter,
  onToggleCreditAlertFilter,
  activeReturnFilter,
  onToggleReturnFilter,
  activeStalledFilter,
  onToggleStalledFilter
}) {
  const categoriasTaticas = ['Salão de Beleza', 'Maquiagem', 'Barbearia', 'Clínica de Estética'];

  return (
    <div className="bg-base-100/90 backdrop-blur-xs px-3 md:px-4 py-1.5 z-20 flex gap-2 overflow-x-auto no-scrollbar border-b border-base-200 shrink-0 items-center scroll-smooth">
      {/* 1. SEÇÃO DE CATEGORIAS (PRIMEIRO) */}
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0 hidden sm:inline">
        Nicho:
      </span>

      <button
        className={`btn btn-xs rounded-xl whitespace-nowrap transition-all font-medium gap-1 ${
          categoryFilter === ''
            ? 'btn-primary text-primary-content shadow-xs'
            : 'btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/75 border border-base-300/60'
        }`}
        onClick={() => onSelectCategory('')}
      >
        <span>✨</span> Todos os Nichos
      </button>

      {categoriasTaticas.map((cat) => (
        <button
          key={cat}
          className={`btn btn-xs rounded-xl whitespace-nowrap transition-all font-medium gap-1 ${
            categoryFilter === cat
              ? 'btn-primary text-primary-content shadow-xs'
              : 'btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/75 border border-base-300/60'
          }`}
          onClick={() => onSelectCategory(cat)}
        >
          <span>{getCategoryEmoji(cat)}</span> {cat}
        </button>
      ))}

      {/* DIVISOR ELEGANTE */}
      <div className="h-4 w-px bg-base-300 mx-1 shrink-0" />

      {/* 2. SEÇÃO DE RADAR TÁTICO & INTELIGÊNCIA (DEPOIS DAS CATEGORIAS) */}
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 shrink-0 hidden sm:inline">
        Radar:
      </span>

      {/* Botão de Filtro "Retornos Agendados (Hoje / Atrasados)" */}
      <button
        onClick={onToggleReturnFilter}
        className={`btn btn-xs rounded-xl whitespace-nowrap transition-all font-semibold gap-1 ${
          activeReturnFilter
            ? 'bg-primary/20 border-primary text-primary font-bold shadow-xs'
            : 'btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/75 border border-base-300/60'
        }`}
        title="Filtrar salões com visitas de retorno agendadas para hoje ou pendentes"
      >
        <span>🔔</span> Retornos Hoje
        {activeReturnFilter && <span className="text-[10px] opacity-75">✕</span>}
      </button>

      {/* Botão de Filtro "Negociação Parada (+7 dias)" */}
      <button
        onClick={onToggleStalledFilter}
        className={`btn btn-xs rounded-xl whitespace-nowrap transition-all font-semibold gap-1 ${
          activeStalledFilter
            ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-xs'
            : 'btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/75 border border-base-300/60'
        }`}
        title="Filtrar salões em negociação sem contato há mais de 7 dias (leads esfriando)"
      >
        <span>🔥</span> Negoc. Parada (+7d)
        {activeStalledFilter && <span className="text-[10px] opacity-75">✕</span>}
      </button>

      {/* Botão de Filtro "Cartão Virando" */}
      <button
        onClick={onToggleCardFilter}
        className={`btn btn-xs rounded-xl whitespace-nowrap transition-all font-semibold gap-1 ${
          activeCardFilter
            ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-xs'
            : 'btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/75 border border-base-300/60'
        }`}
        title="Filtrar salões com fechamento de cartão hoje ou nos próximos 5 dias"
      >
        <span>💳</span> Cartão Virando
        {activeCardFilter && <span className="text-[10px] opacity-75">✕</span>}
      </button>

      {/* Botão de Filtro "Recompra Prevista (25 a 45 dias)" */}
      <button
        onClick={onToggleRepurchaseFilter}
        className={`btn btn-xs rounded-xl whitespace-nowrap transition-all font-semibold gap-1 ${
          activeRepurchaseFilter
            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
            : 'btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/75 border border-base-300/60'
        }`}
        title="Filtrar salões cuja última compra foi entre 25 e 45 dias (esgotamento de estoque)"
      >
        <span>⏳</span> Recompra (25-45d)
        {activeRepurchaseFilter && <span className="text-[10px] opacity-75">✕</span>}
      </button>

      {/* Botão de Filtro "Inadimplência ERP" */}
      <button
        onClick={onToggleCreditAlertFilter}
        className={`btn btn-xs rounded-xl whitespace-nowrap transition-all font-semibold gap-1 ${
          activeCreditAlertFilter
            ? 'bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-300 font-bold shadow-xs'
            : 'btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/75 border border-base-300/60'
        }`}
        title="Filtrar salões com alerta de boleto em atraso no ERP"
      >
        <span>⛔</span> Inadimplentes (ERP)
        {activeCreditAlertFilter && <span className="text-[10px] opacity-75">✕</span>}
      </button>
    </div>
  );
}
