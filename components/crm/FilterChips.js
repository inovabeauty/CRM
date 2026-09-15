import { getCategoryEmoji } from '../../lib/categoryUtils';

export default function FilterChips({
  categoryFilter,
  onSelectCategory
}) {
  const categoriasTaticas = ['Salão de Beleza', 'Maquiagem', 'Barbearia', 'Clínica de Estética'];

  return (
    <div className="bg-base-100/95 backdrop-blur-xs px-3 md:px-4 py-1.5 z-20 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-base-200 shrink-0 items-center scroll-smooth">
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
