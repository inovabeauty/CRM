// Utilitário para ícones criativos e contextuais por categoria de salão

export const getCategoryEmoji = (category) => {
  if (!category) return '💇‍♀️';
  const catLower = category.toLowerCase();
  
  if (catLower.includes('barbearia') || catLower.includes('barba')) return '💈';
  if (catLower.includes('maquiagem') || catLower.includes('make')) return '💄';
  if (catLower.includes('estética') || catLower.includes('estetica') || catLower.includes('clínica')) return '🧖‍♀️';
  if (catLower.includes('unha') || catLower.includes('manicure') || catLower.includes('pedicure')) return '💅';
  if (catLower.includes('sobrancelha') || catLower.includes('cilios') || catLower.includes('cílios')) return '👁️';
  if (catLower.includes('cosmético') || catLower.includes('cosmetico') || catLower.includes('perfumaria') || catLower.includes('loja')) return '🛍️';
  if (catLower.includes('spa') || catLower.includes('massagem') || catLower.includes('terapia')) return '💆‍♀️';
  if (catLower.includes('salão') || catLower.includes('salao') || catLower.includes('cabelo') || catLower.includes('hair')) return '💇‍♀️';
  
  return '✨';
};
