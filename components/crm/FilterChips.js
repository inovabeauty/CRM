import { getCategoryEmoji } from '../../lib/categoryUtils';

export default function FilterChips({
  categoryFilter,
  onSelectCategory,
  activePendingGpsFilter = false,
  onTogglePendingGpsFilter,
  pendingGpsCount = 0,
  onOpenPendingModal
}) {
  const categoriasTaticas = ['Salão de Beleza', 'Maquiagem', 'Barbearia', 'Clínica de Estética'];

  return (
    <div className="bg-base-100/95 backdrop-blur-xs px-3 md:px-4 py-1.5 z-20 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-base-200 shrink-0 items-center scroll-smooth">
      {/* Botão de Destaque Tático: GPS Pendente (Origem ERP) */}
      {pendingGpsCount > 0 && (
        <div className="flex items-center gap-0.5 shrink-0 mr-1">
          <button
            onClick={onTogglePendingGpsFilter}
            className={`px-2.5 py-1 rounded-l-xl text-xs whitespace-nowrap transition-all font-bold border flex items-center gap-1.5 shadow-xs ${
              activePendingGpsFilter
                ? 'bg-amber-500 border-amber-500 text-white ring-2 ring-amber-400/50'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-800 dark:text-amber-300'
            }`}
            title="Filtrar no mapa apenas os salões com GPS pendente"
          >
            <span className="animate-bounce">📍</span>
            <span>GPS Pendente ({pendingGpsCount})</span>
          </button>
          <button
            onClick={onOpenPendingModal}
            className="px-2 py-1 rounded-r-xl text-xs font-bold border border-l-0 border-amber-500/50 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300"
            title="Ver lista completa de salões pendentes"
          >
            📋 Lista
          </button>
        </div>
      )}

      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 shrink-0 hidden sm:inline">
        Nicho:
      </span>

      <button
        className={`px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition-all font-medium border flex items-center gap-1 ${
          categoryFilter === ''
            ? 'bg-amber-500/20 border-amber-500/70 text-amber-800 dark:text-amber-300 font-bold shadow-xs'
            : 'bg-base-200/60 hover:bg-base-200 text-base-content/70 border-base-300/60'
        }`}
        onClick={() => onSelectCategory('')}
      >
        <span>✨</span> Todos os Nichos
      </button>

      {categoriasTaticas.map((cat) => (
        <button
          key={cat}
          className={`px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition-all font-medium border flex items-center gap-1 ${
            categoryFilter === cat
              ? 'bg-amber-500/20 border-amber-500/70 text-amber-800 dark:text-amber-300 font-bold shadow-xs'
              : 'bg-base-200/60 hover:bg-base-200 text-base-content/70 border-base-300/60'
          }`}
          onClick={() => onSelectCategory(cat)}
        >
          <span>{getCategoryEmoji(cat)}</span> {cat}
        </button>
      ))}
    </div>
  );
}
