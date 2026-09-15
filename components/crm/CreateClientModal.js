import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function CreateClientModal({
  isOpen,
  onClose,
  initialData = {},
  onCreatedSuccess
}) {
  const [form, setForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        latitude: initialData.lat || initialData.latitude,
        longitude: initialData.lng || initialData.longitude,
        status_funil: 'prospect',
        categorias: '{"Salão de Beleza"}',
        cidade: initialData.cidade || 'Caxias',
        nome: '',
        responsavel: '',
        whatsapp: ''
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!form.nome?.trim()) {
      alert('O nome do salão é obrigatório!');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.from('clientes').insert([{
        nome: form.nome.trim(),
        responsavel: form.responsavel?.trim() || null,
        whatsapp: form.whatsapp?.trim() || null,
        cidade: form.cidade,
        categorias: form.categorias,
        latitude: form.latitude,
        longitude: form.longitude,
        status_funil: form.status_funil,
        endereco: 'Cadastrado via App de Campo'
      }]).select().single();

      if (!error) {
        window.dispatchEvent(new Event('refreshMap'));
        if (onCreatedSuccess) onCreatedSuccess(data || form);
        onClose();
      } else {
        alert('Erro ao cadastrar novo salão: ' + error.message);
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado na conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 w-full bg-base-100 rounded-t-3xl shadow-[0_-15px_50px_rgba(0,0,0,0.5)] p-5 pb-8 md:pb-5 z-[1000] max-h-[85vh] overflow-y-auto transition-transform duration-300 border-t border-base-300">
      <div className="w-12 h-1 rounded-full bg-base-300 mx-auto -mt-1 mb-3 shrink-0"></div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <h2 className="text-base md:text-lg font-bold text-success">Cadastrar Novo Salão</h2>
        </div>
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
      </div>

      <div className="space-y-3">
        <div className="form-control">
          <label className="label py-1"><span className="label-text font-bold text-xs">Nome do Salão</span></label>
          <input
            type="text"
            placeholder="Ex: Studio VIP"
            className="input input-sm input-bordered w-full text-xs"
            value={form.nome || ''}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label py-1"><span className="label-text font-bold text-xs">Responsável (Dona)</span></label>
            <input
              type="text"
              placeholder="Ex: Joana"
              className="input input-sm input-bordered w-full text-xs"
              value={form.responsavel || ''}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label py-1"><span className="label-text font-bold text-xs">WhatsApp</span></label>
            <input
              type="text"
              placeholder="Ex: 5599981002000"
              className="input input-sm input-bordered w-full text-xs"
              value={form.whatsapp || ''}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label py-1"><span className="label-text font-bold text-xs">Cidade</span></label>
            <select
              className="select select-sm select-bordered w-full text-xs"
              value={form.cidade || 'Caxias'}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            >
              <option value="Caxias">Caxias</option>
              <option value="Bacabal">Bacabal</option>
              <option value="Timon">Timon</option>
              <option value="Codó">Codó</option>
              <option value="São Luís">São Luís</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label py-1"><span className="label-text font-bold text-xs">Nicho Primário</span></label>
            <select
              className="select select-sm select-bordered w-full text-xs"
              value={form.categorias || '{"Salão de Beleza"}'}
              onChange={(e) => setForm({ ...form, categorias: e.target.value })}
            >
              <option value='{"Salão de Beleza"}'>Salão de Beleza</option>
              <option value='{"Maquiagem"}'>Maquiagem</option>
              <option value='{"Barbearia"}'>Barbearia</option>
              <option value='{"Clínica de Estética"}'>Estética</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-3 border-t border-base-200">
          <button onClick={onClose} className="btn btn-ghost btn-sm flex-1">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-success btn-sm flex-1 text-white font-bold"
          >
            {isSaving ? <span className="loading loading-spinner loading-xs"></span> : 'Salvar Novo Salão'}
          </button>
        </div>
      </div>
    </div>
  );
}
