import { useState, useEffect, useMemo, useRef } from 'react';

const STORAGE_CONFIGS_KEY = 'inova_crm_whatsapp_script_configs';
const STORAGE_PRESETS_KEY = 'inova_crm_data_presets';

const INITIAL_DATA_PRESETS = [
  { id: 'verao', label: '☀️ Temporada de Verão', nome: 'Temporada de Verão', condicao: 'tabela de distribuidora e estoque garantido para o calor' },
  { id: 'mulher', label: '💐 Dia da Mulher', nome: 'Semana da Mulher', condicao: 'condição especial com kit presente para clientes' },
  { id: 'cabeleireiro', label: '✂️ Dia do Cabeleireiro', nome: 'Mês do Cabeleireiro', condicao: 'lote exclusivo com bonificação em produtos' },
  { id: 'formaturas', label: '🎓 Formaturas', nome: 'Temporada de Formaturas', condicao: 'reserva antecipada com entrega expressa prioritária' },
  { id: 'black_friday', label: '🖤 Black Friday', nome: 'Black Inova Beauty', condicao: 'maiores descontos do ano direto de fábrica' },
  { id: 'fim_de_ano', label: '🎄 Festas de Fim de Ano', nome: 'Alta Temporada de Festas', condicao: 'reposição estratégica para a bancada não parar' }
];

export default function WhatsAppScriptModal({ client, isOpen, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('combo_mes');
  const [copied, setCopied] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const textareaRef = useRef(null);

  // Lista de Cards de Datas Comemorativas (Editável e Persistente)
  const [dataPresets, setDataPresets] = useState(INITIAL_DATA_PRESETS);
  const [activePresetId, setActivePresetId] = useState('verao');
  const [isAddingNewPreset, setIsAddingNewPreset] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [resgateSubtype, setResgateSubtype] = useState('bancada'); // 'bancada' | 'home_care'

  // Configurações dos campos de cada aba
  const [configs, setConfigs] = useState({
    comboNome: 'Combo Verão',
    comboCondicao: 'pagamento em até 3x sem juros no cartão de crédito',
    dataNome: 'Temporada de Verão',
    dataCondicao: 'tabela de distribuidora e estoque garantido para o calor',
    cartaoFoco: 'reposição de descoloração e alisamento',
    cartaoCondicao: 'faturamento com até 40 dias de respiro',
    prospeccaoDestaque: 'as fotos das transformações e a saúde dos fios',
    resgateNovidade: 'as novas condições especiais deste ciclo',
    posVisitaMaterial: 'a lâmina de rentabilidade e suporte técnico da linha'
  });

  // Mensagem editável pelo usuário
  const [editableMessage, setEditableMessage] = useState('');
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);

  // Carrega configurações e presets do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedConfigs = localStorage.getItem(STORAGE_CONFIGS_KEY);
        if (savedConfigs) {
          setConfigs(prev => ({ ...prev, ...JSON.parse(savedConfigs) }));
        }
        const savedPresets = localStorage.getItem(STORAGE_PRESETS_KEY);
        if (savedPresets) {
          const parsed = JSON.parse(savedPresets);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDataPresets(parsed);
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar configurações de scripts:', e);
      }
    }
  }, []);

  // Salva no localStorage e dispara feedback tátil
  const saveAllConfigsToStorage = (updatedConfigs = configs, updatedPresets = dataPresets) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updatedConfigs));
        localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(updatedPresets));
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2500);
      } catch (e) {
        console.error('Erro ao salvar no storage:', e);
      }
    }
  };

  // Atualiza campo de configuração específico
  const updateConfig = (key, value) => {
    const updated = { ...configs, [key]: value };
    setConfigs(updated);
    setIsManuallyEdited(false);

    // Se estiver editando dataNome ou dataCondicao, sincroniza também o card selecionado em dataPresets
    if (key === 'dataNome' || key === 'dataCondicao') {
      setDataPresets(prev => {
        const next = prev.map(p => {
          if (p.id === activePresetId) {
            return {
              ...p,
              nome: key === 'dataNome' ? value : p.nome,
              condicao: key === 'dataCondicao' ? value : p.condicao,
              label: key === 'dataNome' ? (p.label.split(' ')[0] + ' ' + value) : p.label
            };
          }
          return p;
        });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated));
      } catch (e) {}
    }
  };

  // Seleciona um card de data comemorativa
  const handleSelectPreset = (preset) => {
    setActivePresetId(preset.id);
    const updated = {
      ...configs,
      dataNome: preset.nome,
      dataCondicao: preset.condicao
    };
    setConfigs(updated);
    setIsManuallyEdited(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated));
      } catch (e) {}
    }
  };

  // Adiciona um novo card de data comemorativa
  const handleAddNewPreset = () => {
    if (!newPresetLabel.trim()) return;
    const newId = 'preset_' + Date.now();
    const newPreset = {
      id: newId,
      label: `🗓️ ${newPresetLabel.trim()}`,
      nome: newPresetLabel.trim(),
      condicao: 'condição especial antecipada com entrega prioritária'
    };
    const updatedPresets = [...dataPresets, newPreset];
    setDataPresets(updatedPresets);
    handleSelectPreset(newPreset);
    setNewPresetLabel('');
    setIsAddingNewPreset(false);
    saveAllConfigsToStorage(configs, updatedPresets);
  };

  // Remove um card de data personalizado
  const handleRemovePreset = (e, idToRemove) => {
    e.stopPropagation();
    if (dataPresets.length <= 1) return;
    const filtered = dataPresets.filter(p => p.id !== idToRemove);
    setDataPresets(filtered);
    if (activePresetId === idToRemove) {
      handleSelectPreset(filtered[0]);
    }
    saveAllConfigsToStorage(configs, filtered);
  };

  // Normalização de dados do salão
  const nomeCliente = client?.responsavel?.trim() || '';
  const nomeSalao = client?.nome?.trim() || 'seu salão';
  const cidade = client?.cidade?.trim() || 'nossa região';
  const linhaInteresse = client?.linha_interesse || 'Olenka & MUP Collor';
  const melhorDia = client?.melhor_dia_compra ? `dia ${client.melhor_dia_compra}` : 'nos próximos dias';

  // Gerador dos Modelos Padrão com PNL e Venda Inversa
  const defaultTemplates = useMemo(() => {
    const saudacao = nomeCliente ? `Olá, ${nomeCliente}! Tudo bem?` : `Olá! Tudo bem?`;

    return {
      combo_mes: {
        title: '🔥 Combo do Mês (Venda Inversa & Escassez)',
        tag: 'Campanha Mensal',
        badgeColor: 'badge-primary',
        text: `${saudacao} Aqui é da Inova Beauty, distribuidora ${linhaInteresse} em ${cidade}.

Abrimos uma condição exclusiva com várias ofertas, dentre elas, *${configs.comboNome}*${configs.comboCondicao ? ` (${configs.comboCondicao})` : ''}, com ótimo custo benefício.

👉 Se fizer sentido para você avaliar lucratividade desse combo e dos demais, me dá um toque aqui que te envio todos os promocionais válidos. Se a sua bancada estiver cheia e não for o momento, me avise que respeito totalmente seu tempo!`
      },

      data_comemorativa: {
        title: '🎉 Data Comemorativa / Temporada',
        tag: 'Datas Especiais',
        badgeColor: 'badge-secondary',
        text: `${saudacao} Como estão os preparativos para o movimento da *${configs.dataNome}* no ${nomeSalao}?

Geralmente, nas datas de maior movimento, a demanda por transformações e serviços dobra — e o maior prejuízo para a profissional é faltar produto de alta performance no lavatório bem no dia de pico, ou ter que pagar caro na última hora.

Como você preza pelo padrão impecável do seu atendimento, separei uma condição de antecipação: *${configs.dataCondicao}*.

Quer que eu te passe os promocionais para você dar uma olhada, antes que esgote o estoque?`
      },

      virada_cartao: {
        title: '💳 Oportunidade & Reposição (Timing)',
        tag: 'Reposição Estratégica',
        badgeColor: 'badge-accent',
        text: `${saudacao} Como estão as coisas aí no ${nomeSalao}?

Estava alinhando os envios e reposições desta semana aqui em ${cidade} e lembrei de você: temos ofertas incríveis, como *${configs.cartaoFoco}*${configs.cartaoCondicao ? ` (${configs.cartaoCondicao})` : ''}.

Como está o seu estoque?

Se quiser dar uma olhada nas opções antes de fecharmos os pedidos da semana, me dá um toque aqui que te passo!`
      },

      prospeccao_antivendedor: {
        title: '🎯 1º Contato (Apresentação & Qualificação)',
        tag: 'Primeiro Contato',
        badgeColor: 'badge-info',
        text: nomeCliente 
          ? `Olá, ${nomeCliente}! Tudo bem? Aqui é da Inova Beauty, distribuidora Olenka e MUP Collor na nossa região.

Estava acompanhando as transformações impecáveis que vocês fazem no ${nomeSalao} — padrão de acabamento lindo, parabéns!

Me tira uma dúvida rápida: vocês aí já chegaram a testar a linha da Olenka e MUP, ou hoje trabalham com outras marcas?`
          : `Olá! Tudo bem? Aqui é da Inova Beauty, distribuidora Olenka e MUP Collor na nossa região.

Estava acompanhando as transformações impecáveis que vocês fazem no ${nomeSalao} — padrão de acabamento lindo, parabéns!

Me tira uma dúvida rápida: vocês aí já chegaram a testar a linha da Olenka e MUP, ou hoje trabalham com outras marcas? A propósito, com quem falo?`
      },

      resgate_inativo: {
        title: resgateSubtype === 'home_care' ? '🛑 Resgate (Revenda Home Care)' : '🛑 Resgate (Bancada & Lavatório)',
        tag: 'Reativação',
        badgeColor: 'badge-error',
        text: resgateSubtype === 'home_care'
          ? `${saudacao} Como está?

Estava revisando meus atendimentos aqui na região e fiz questão de te mandar uma mensagem. Para nós da Inova Beauty, é extremamente importante saber dos resultados que a marca pode proporcionar em faturamento para o seu negócio.

Me conta, como estão as vendas dos produtos? Teve retorno de satisfação de suas clientes? Está conseguindo o retorno esperado?

E por fim, como está seu estoque? Precisa de algum apoio? Estou à disposição.`
          : `${saudacao} Como estão as coisas aí no ${nomeSalao}?

Estava revisando meus atendimentos e fiz questão de te mandar uma mensagem. Para nós, mais importante do que venda é saber o resultado real do produto na bancada e nos resultados em suas clientes.

Me conta uma coisa com total sinceridade: como foi o resultado em suas clientes com utilização dos produtos da Olenka e MUP? O resultado entregou o que você esperava?

O produto de vocês ainda está rendendo ou sentiu falta de algum apoio nosso nesse período?`
      },

      pos_visita: {
        title: '🤝 Pós-Visita Imediato (Agradecimento & Catálogo)',
        tag: 'Follow-up',
        badgeColor: 'badge-success',
        text: `${saudacao} Passando para agradecer pela recepção e pela atenção durante minha visita ao ${nomeSalao} hoje!

Foi ótimo entender mais sobre o seu momento e os serviços que mais têm saída aí na sua bancada.

Conforme conversamos, estou à disposição para te enviar *${configs.posVisitaMaterial}* da linha ${linhaInteresse}.

Se precisar de qualquer apoio no dia a dia, é só me chamar aqui!`
      }
    };
  }, [nomeCliente, nomeSalao, cidade, linhaInteresse, melhorDia, configs, resgateSubtype]);

  // Atualiza a mensagem editável sempre que mudar de categoria ou quando não tiver edição manual
  useEffect(() => {
    if (!isManuallyEdited && defaultTemplates[selectedCategory]) {
      setEditableMessage(defaultTemplates[selectedCategory].text);
    }
  }, [selectedCategory, defaultTemplates, isManuallyEdited]);

  useEffect(() => {
    setIsManuallyEdited(false);
  }, [client, isOpen]);

  if (!isOpen || !client) return null;

  const currentTemplate = defaultTemplates[selectedCategory];

  const handleCopy = () => {
    navigator.clipboard.writeText(editableMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const rawPhone = (client.whatsapp || '').toString().replace(/\D/g, '');
    const phone = rawPhone.length > 0 && !rawPhone.startsWith('55') ? `55${rawPhone}` : rawPhone;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(editableMessage)}`;
    window.open(url, '_blank');
  };

  const handleRestoreDefault = () => {
    setEditableMessage(currentTemplate.text);
    setIsManuallyEdited(false);
  };

  const handleInsertFormat = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editableMessage;
    const selected = text.substring(start, end);
    const replacement = `${tag}${selected || 'texto'}${tag}`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setEditableMessage(newText);
    setIsManuallyEdited(true);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center z-[99999] p-2 md:p-4">
      <div className="bg-base-100 w-full max-w-2xl rounded-2xl md:rounded-3xl shadow-2xl border border-base-300 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="p-3.5 md:p-4 bg-base-200/90 border-b border-base-300 flex justify-between items-start md:items-center gap-2 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg">💬</span>
              <h2 className="text-sm md:text-base font-bold text-base-content">Central de Scripts</h2>
              <span className="badge badge-xs sm:badge-sm badge-outline font-mono text-[9px] sm:text-[10px] text-base-content/60">PNL & Venda Inversa</span>
            </div>
            <p className="text-[11px] text-base-content/65 mt-0.5 truncate">
              Para: <span className="font-semibold text-primary">{client.nome}</span> {client.cidade ? `(${client.cidade})` : ''}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-xs sm:btn-sm btn-circle btn-ghost shrink-0">✕</button>
        </div>

        {/* Abas de Categorias */}
        <div className="px-3 py-2 bg-base-100 border-b border-base-200 overflow-x-auto flex gap-1.5 shrink-0 no-scrollbar scroll-smooth">
          {Object.entries(defaultTemplates).map(([key, item]) => {
            const isSelected = selectedCategory === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedCategory(key);
                  setIsManuallyEdited(false);
                }}
                className={`px-2.5 py-1 rounded-xl whitespace-nowrap text-xs font-semibold transition-all shrink-0 border flex items-center gap-1 ${
                  isSelected
                    ? 'bg-primary text-primary-content border-primary shadow-xs'
                    : 'bg-base-200/60 hover:bg-base-200 text-base-content/70 border-base-300/60'
                }`}
              >
                <span>{item.tag}</span>
                <span>{item.title.split(' ')[0]} {item.title.split(' ')[1] || ''}</span>
              </button>
            );
          })}
        </div>

        {/* Corpo do Script com Scroll */}
        <div className="p-3.5 md:p-4 overflow-y-auto flex-1 space-y-3.5">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${currentTemplate.badgeColor} badge-sm font-semibold shrink-0`}>
                {currentTemplate.tag}
              </span>
              <h3 className="font-bold text-xs md:text-sm text-base-content leading-tight">
                {currentTemplate.title}
              </h3>
            </div>
            
            {/* BOTÃO Salvar Padrão */}
            <button
              type="button"
              onClick={() => saveAllConfigsToStorage()}
              className={`btn btn-xs transition-all gap-1 text-[11px] font-bold self-start sm:self-auto shrink-0 rounded-lg ${
                savedFeedback 
                  ? 'btn-success text-white shadow-md' 
                  : 'btn-ghost bg-base-200/80 hover:bg-base-300 border border-base-300/80 text-gray-400 hover:text-base-content'
              }`}
              title="Salva as personalizações deste card para serem aplicadas em todos os outros salões"
            >
              <span>{savedFeedback ? '✓' : '💾'}</span>
              <span>{savedFeedback ? 'Salvo para os Próximos!' : 'Salvar Padrão'}</span>
            </button>
          </div>

          {/* PAINEL DE PERSONALIZAÇÃO ESPECÍFICO DE CADA ABA */}
          
          {/* 1. ABA COMBO DO MÊS */}
          {selectedCategory === 'combo_mes' && (
            <div className="bg-base-200 p-3 rounded-xl space-y-2 text-xs border border-base-300 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <span className="font-bold text-primary flex items-center gap-1">
                  ⚙️ Personalizar Combo do Mês:
                </span>
                <span className="text-[10px] text-gray-400">Edite aqui para injetar no texto</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Nome do Combo Promocional</label>
                  <input
                    type="text"
                    className="input input-bordered input-xs w-full text-xs"
                    value={configs.comboNome}
                    onChange={(e) => updateConfig('comboNome', e.target.value)}
                    placeholder="Ex: Combo Verão, Combo Loiro Perfeito"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Destaque de Bônus / Condição</label>
                  <input
                    type="text"
                    className="input input-bordered input-xs w-full text-xs"
                    value={configs.comboCondicao}
                    onChange={(e) => updateConfig('comboCondicao', e.target.value)}
                    placeholder="Ex: em até 3x sem juros no cartão"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. ABA DATA COMEMORATIVA / TEMPORADA (CARDS TOTALMENTE EDITÁVEIS) */}
          {selectedCategory === 'data_comemorativa' && (
            <div className="bg-base-200 p-3 rounded-xl space-y-2 text-xs border border-base-300 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <span className="font-bold text-secondary flex items-center gap-1">
                  ⚙️ Personalizar Data / Temporada:
                </span>
                <span className="text-[10px] text-gray-400">Clique no card para ativar ou edite abaixo</span>
              </div>

              {/* Cards / Pílulas Interativas e Editáveis */}
              <div className="flex flex-wrap gap-1.5 pt-0.5 items-center">
                {dataPresets.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`cursor-pointer px-2.5 py-1 rounded-full text-[10px] font-medium transition-all flex items-center gap-1 border ${
                        isSelected
                          ? 'bg-secondary text-secondary-content border-secondary font-bold shadow-xs scale-105'
                          : 'bg-base-100 hover:bg-base-300 border-base-300 text-gray-300'
                      }`}
                      title={`Clique para ativar ${preset.nome}`}
                    >
                      <span>{preset.label}</span>
                      {dataPresets.length > 1 && (
                        <span
                          onClick={(e) => handleRemovePreset(e, preset.id)}
                          className="opacity-50 hover:opacity-100 hover:text-error ml-0.5 text-[10px]"
                          title="Remover card"
                        >
                          ✕
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Botão para criar novo card */}
                {!isAddingNewPreset ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingNewPreset(true)}
                    className="btn btn-xs btn-ghost text-[10px] gap-0.5 text-secondary hover:bg-secondary/10"
                  >
                    <span>+</span> Novo Card
                  </button>
                ) : (
                  <div className="flex items-center gap-1 animate-in fade-in">
                    <input
                      type="text"
                      className="input input-bordered input-xs text-[10px] w-28"
                      placeholder="Ex: São João"
                      value={newPresetLabel}
                      onChange={(e) => setNewPresetLabel(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddNewPreset}
                      className="btn btn-xs btn-secondary text-[10px] py-0 px-2"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewPreset(false)}
                      className="btn btn-xs btn-ghost text-[10px] py-0 px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Campos de Edição do Card Selecionado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-base-300">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">
                    Nome da Data / Temporada (Card Ativo)
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-xs w-full text-xs font-semibold"
                    value={configs.dataNome}
                    onChange={(e) => updateConfig('dataNome', e.target.value)}
                    placeholder="Ex: Temporada de Verão, São João"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">
                    Condição Especial de Antecipação
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-xs w-full text-xs"
                    value={configs.dataCondicao}
                    onChange={(e) => updateConfig('dataCondicao', e.target.value)}
                    placeholder="Ex: tabela de distribuidora e entrega prioritária"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. ABA VIRADA DE CARTÃO */}
          {selectedCategory === 'virada_cartao' && (
            <div className="bg-base-200 p-3 rounded-xl space-y-2 text-xs border border-base-300 animate-in fade-in duration-150">
              <span className="font-bold text-accent block">⚙️ Personalizar Oportunidade de Reposição:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Produto ou Linha em Foco</label>
                  <input
                    type="text"
                    className="input input-bordered input-xs w-full text-xs"
                    value={configs.cartaoFoco}
                    onChange={(e) => updateConfig('cartaoFoco', e.target.value)}
                    placeholder="Ex: linha de lavatório e alisamento"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Condição de Pagamento / Benefício</label>
                  <input
                    type="text"
                    className="input input-bordered input-xs w-full text-xs"
                    value={configs.cartaoCondicao}
                    onChange={(e) => updateConfig('cartaoCondicao', e.target.value)}
                    placeholder="Ex: parcelamento facilitado sem pesar no caixa"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. ABA 1º CONTATO */}
          {selectedCategory === 'prospeccao_antivendedor' && (
            <div className="bg-base-200 p-3 rounded-xl space-y-2 text-xs border border-base-300 animate-in fade-in duration-150">
              <span className="font-bold text-info block">⚙️ 1º Contato & Apresentação:</span>
              <p className="text-[11px] text-gray-400">
                {nomeCliente 
                  ? `Identificamos o responsável cadastrado: "${nomeCliente}". O script aborda a dona pelo nome e pergunta se já trabalham com a linha Olenka e MUP Collor.` 
                  : `Responsável não informado no cadastro. O script elogia o padrão do salão e pergunta educadamente "Com quem falo?".`}
              </p>
            </div>
          )}

          {/* 5. ABA RESGATE DE INATIVO */}
          {selectedCategory === 'resgate_inativo' && (
            <div className="bg-base-200 p-3 rounded-xl space-y-2 text-xs border border-base-300 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <span className="font-bold text-error flex items-center gap-1">
                  ⚙️ Foco do Resgate de Inativo:
                </span>
                <span className="text-[10px] text-gray-400">Selecione o tipo de salão</span>
              </div>

              {/* Sub-cards: Bancada vs Home Care */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setResgateSubtype('bancada');
                    setIsManuallyEdited(false);
                  }}
                  className={`btn btn-xs flex-1 rounded-lg text-[10px] sm:text-[11px] transition-all ${
                    resgateSubtype === 'bancada' 
                      ? 'btn-error text-white font-bold shadow-xs' 
                      : 'btn-outline border-base-300 text-gray-300'
                  }`}
                >
                  🔬 Bancada & Procedimentos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResgateSubtype('home_care');
                    setIsManuallyEdited(false);
                  }}
                  className={`btn btn-xs flex-1 rounded-lg text-[10px] sm:text-[11px] transition-all ${
                    resgateSubtype === 'home_care' 
                      ? 'btn-error text-white font-bold shadow-xs' 
                      : 'btn-outline border-base-300 text-gray-300'
                  }`}
                >
                  🛍️ Revenda Home Care
                </button>
              </div>
            </div>
          )}

          {/* 6. ABA PÓS-VISITA */}
          {selectedCategory === 'pos_visita' && (
            <div className="bg-base-200 p-3 rounded-xl space-y-2 text-xs border border-base-300 animate-in fade-in duration-150">
              <span className="font-bold text-success block">⚙️ Material Prometido na Visita:</span>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Lâmina, Amostra ou Tabela Técnica</label>
                <input
                  type="text"
                  className="input input-bordered input-xs w-full text-xs"
                  value={configs.posVisitaMaterial}
                  onChange={(e) => updateConfig('posVisitaMaterial', e.target.value)}
                  placeholder="Ex: a lâmina de rentabilidade e suporte técnico da linha"
                />
              </div>
            </div>
          )}

          {/* BARRA DE FERRAMENTAS DO TEXTO EDITÁVEL */}
          <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-base-content text-[11px]">✏️ Mensagem Editável:</span>
              {isManuallyEdited && (
                <span className="badge badge-warning badge-xs text-[9px] font-mono">Modificada manualmente</span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleInsertFormat('*')}
                className="btn btn-ghost btn-xs px-1.5 py-0 text-[11px] font-bold"
                title="Inserir Negrito (*texto*)"
              >
                <b>B</b>
              </button>
              <button
                type="button"
                onClick={() => handleInsertFormat('_')}
                className="btn btn-ghost btn-xs px-1.5 py-0 text-[11px] italic"
                title="Inserir Itálico (_texto_)"
              >
                <i>I</i>
              </button>
              {isManuallyEdited && (
                <button
                  type="button"
                  onClick={handleRestoreDefault}
                  className="btn btn-ghost btn-xs text-[10px] text-error hover:bg-error/10 ml-1"
                  title="Restaurar modelo automático"
                >
                  ↺ Restaurar
                </button>
              )}
            </div>
          </div>

          {/* ÁREA DE TEXTO EDITÁVEL ESTILO WHATSAPP */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={8}
              className="w-full bg-[#0b141a] text-[#e9edef] p-3.5 rounded-xl font-sans text-xs md:text-sm leading-relaxed border border-[#222e35] focus:outline-hidden focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] selection:bg-[#00a884] resize-y"
              value={editableMessage}
              onChange={(e) => {
                setEditableMessage(e.target.value);
                setIsManuallyEdited(true);
              }}
              placeholder="Digite ou edite sua mensagem..."
            />
            <button
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 btn btn-xs bg-[#202c33] hover:bg-[#2a3942] text-white border-0 text-[11px] shadow-sm gap-1"
            >
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
          </div>

        </div>

        {/* Rodapé com Botão de Ação */}
        <div className="p-3 bg-base-200/95 border-t border-base-300 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            onClick={handleOpenWhatsApp}
            className="btn btn-sm btn-success text-white w-full sm:w-auto sm:flex-1 font-bold shadow-md gap-1.5 text-xs order-1 sm:order-3"
          >
            <span>📲</span> Abrir no WhatsApp
          </button>
          <div className="flex gap-2 w-full sm:w-auto sm:flex-1 order-2 sm:order-1">
            <button onClick={onClose} className="btn btn-sm btn-ghost flex-1 text-xs">
              Fechar
            </button>
            <button
              onClick={handleCopy}
              className="btn btn-sm btn-outline btn-primary flex-1 text-xs"
            >
              {copied ? '✓ Copiado!' : '📋 Copiar Texto'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
