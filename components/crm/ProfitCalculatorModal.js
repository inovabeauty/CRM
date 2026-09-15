import { useState } from 'react';

const SERVICE_PRESETS = [
  {
    id: 'olenka_progressiva',
    label: '✨ Progressiva Orgânica (Olenka)',
    custoKit: 390,
    rendimento: 25,
    precoCobrado: 180,
    descricao: 'Linha de alisamento orgânico sem formol'
  },
  {
    id: 'olenka_botox',
    label: '💆 Botox Capilar / Selagem (Olenka)',
    custoKit: 280,
    rendimento: 20,
    precoCobrado: 130,
    descricao: 'Tratamento anti-frizz e alinhamento térmico'
  },
  {
    id: 'mup_loiro',
    label: '🌟 Kit Mechas & Loiro Perfeito (MUP Collor)',
    custoKit: 320,
    rendimento: 15,
    precoCobrado: 260,
    descricao: 'Pó descolorante ultra rápido + OX estabilizada'
  },
  {
    id: 'cronograma',
    label: '🧪 Cronograma Capilar / Lavatório',
    custoKit: 350,
    rendimento: 35,
    precoCobrado: 100,
    descricao: 'Nutrição, hidratação e reconstrução de lavatório'
  },
  {
    id: 'mup_makeup',
    label: '💄 Bancada de Make (Mup Makeup)',
    custoKit: 450,
    rendimento: 30,
    precoCobrado: 120,
    descricao: 'Linha profissional de make e preparação de pele'
  },
  {
    id: 'custom',
    label: '✏️ Simulação Personalizada',
    custoKit: 300,
    rendimento: 20,
    precoCobrado: 150,
    descricao: 'Ajuste os valores livremente'
  }
];

export default function ProfitCalculatorModal({ client, isOpen, onClose }) {
  const [selectedPreset, setSelectedPreset] = useState(SERVICE_PRESETS[0]);
  const [custoKit, setCustoKit] = useState(SERVICE_PRESETS[0].custoKit);
  const [rendimento, setRendimento] = useState(SERVICE_PRESETS[0].rendimento);
  const [precoCobrado, setPrecoCobrado] = useState(SERVICE_PRESETS[0].precoCobrado);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setCustoKit(preset.custoKit);
    setRendimento(preset.rendimento);
    setPrecoCobrado(preset.precoCobrado);
  };

  // Cálculos de Rentabilidade
  const numRendimento = Math.max(parseFloat(rendimento) || 1, 1);
  const numCusto = Math.max(parseFloat(custoKit) || 0, 0);
  const numPreco = Math.max(parseFloat(precoCobrado) || 0, 0);

  const custoPorAplicacao = numCusto / numRendimento;
  const faturamentoTotal = numRendimento * numPreco;
  const lucroLiquido = faturamentoTotal - numCusto;
  const margemPercentual = numCusto > 0 ? (lucroLiquido / numCusto) * 100 : 0;

  const nomeSalao = client?.nome || 'seu salão';
  const nomeResponsavel = client?.responsavel || '';

  const getShareText = () => {
    return `Olá${nomeResponsavel ? `, ${nomeResponsavel}` : ''}! Segue a simulação de lucratividade da linha ${selectedPreset.label} para o ${nomeSalao}:

📊 *SIMULAÇÃO DE RENTABILIDADE:*
- Investimento no Kit: R$ ${numCusto.toFixed(2)}
- Rendimento estimado: ${numRendimento} aplicações
- Custo real por procedimento: apenas *R$ ${custoPorAplicacao.toFixed(2)}*

💰 *RETORNO NO SEU SALÃO:*
- Cobrando em média: R$ ${numPreco.toFixed(2)} por procedimento
- *Faturamento gerado:* R$ ${faturamentoTotal.toFixed(2)}
- *LUCRO LÍQUIDO NO SEU BOLSO:* *R$ ${lucroLiquido.toFixed(2)}* (${margemPercentual.toFixed(0)}% de retorno)

Ou seja: com apenas ${Math.ceil(numCusto / numPreco)} atendimentos você já paga o kit inteiro e todo o restante é lucro puro para o salão!`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!client?.whatsapp) {
      alert('Este salão não possui WhatsApp cadastrado.');
      return;
    }
    const rawPhone = client.whatsapp.toString().replace(/\D/g, '');
    const phone = rawPhone.length > 0 && !rawPhone.startsWith('55') ? `55${rawPhone}` : rawPhone;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(getShareText())}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center z-[99999] p-2 md:p-4 animate-in fade-in duration-200">
      <div className="bg-base-100 w-full max-w-lg rounded-2xl md:rounded-3xl shadow-2xl border border-base-300 max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="p-4 bg-base-200/90 border-b border-base-300 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl">🧮</span>
              <h2 className="text-base md:text-lg font-bold text-base-content">
                Simulador de Lucro do Salão
              </h2>
            </div>
            <p className="text-xs text-base-content/70 mt-0.5">
              Demonstração de retorno financeiro para: <strong className="text-primary">{nomeSalao}</strong>
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* Seletor de Presets de Procedimentos */}
          <div>
            <label className="text-[11px] font-bold text-base-content/65 block mb-1.5">
              Escolha a Linha ou Procedimento:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`btn btn-xs rounded-lg text-[10px] transition-all ${
                    selectedPreset.id === preset.id
                      ? 'btn-primary font-bold shadow-xs scale-105'
                      : 'btn-outline border-base-300 text-base-content/70 hover:text-base-content'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs de Parâmetros */}
          <div className="grid grid-cols-3 gap-2 bg-base-200 p-3 rounded-2xl border border-base-300 text-xs">
            <div>
              <label className="text-[10px] text-base-content/65 block mb-1">Custo do Kit (R$)</label>
              <input
                type="number"
                min="1"
                className="input input-bordered input-sm w-full font-bold text-base-content"
                value={custoKit}
                onChange={(e) => setCustoKit(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-base-content/65 block mb-1">Rendimento (Proced.)</label>
              <input
                type="number"
                min="1"
                className="input input-bordered input-sm w-full font-bold text-base-content"
                value={rendimento}
                onChange={(e) => setRendimento(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-base-content/65 block mb-1">Preço Cobrado (R$)</label>
              <input
                type="number"
                min="1"
                className="input input-bordered input-sm w-full font-bold text-accent"
                value={precoCobrado}
                onChange={(e) => setPrecoCobrado(e.target.value)}
              />
            </div>
          </div>

          {/* CARD DE RESULTADOS DE ALTO IMPACTO (ARMA DE FECHAMENTO) */}
          <div className="bg-gradient-to-br from-base-200 to-base-300 p-4 rounded-2xl border-2 border-success/40 shadow-lg space-y-3">
            <div className="flex justify-between items-center border-b border-base-300 pb-2">
              <span className="text-xs font-medium text-base-content/70">Custo por Aplicação no Salão:</span>
              <span className="badge badge-neutral font-mono font-bold text-xs">
                R$ {custoPorAplicacao.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-base-100/80 p-3 rounded-xl border border-base-300">
                <span className="text-[10px] font-semibold text-base-content/65 block">Faturamento Estimado:</span>
                <span className="text-base font-bold text-base-content">
                  R$ {faturamentoTotal.toFixed(2)}
                </span>
              </div>
              <div className="bg-success/15 p-3 rounded-xl border border-success/40">
                <span className="text-[10px] font-semibold text-success block">LUCRO NO BOLSO DA DONA:</span>
                <span className="text-lg md:text-xl font-black text-success">
                  R$ {lucroLiquido.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-center pt-1">
              <span className="badge badge-success badge-sm font-bold gap-1 text-[11px]">
                🚀 Retorno de +{margemPercentual.toFixed(0)}% sobre o investimento
              </span>
              <p className="text-[11px] text-base-content/70 mt-1">
                Com apenas <strong>{Math.ceil(numCusto / numPreco)} atendimentos</strong> o kit já se paga 100%!
              </p>
            </div>
          </div>

        </div>

        {/* Rodapé com Ações */}
        <div className="p-3 bg-base-200/95 border-t border-base-300 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            onClick={handleSendWhatsApp}
            className="btn btn-sm btn-success text-white w-full sm:w-auto sm:flex-1 font-bold shadow-md gap-1.5 text-xs order-1 sm:order-3"
          >
            <span>📲</span> Enviar no WhatsApp
          </button>
          <div className="flex gap-2 w-full sm:w-auto sm:flex-1 order-2 sm:order-1">
            <button onClick={onClose} className="btn btn-sm btn-ghost flex-1 text-xs">
              Fechar
            </button>
            <button
              onClick={handleCopy}
              className="btn btn-sm btn-outline btn-primary flex-1 text-xs"
            >
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
