import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function TeamManagementModal({ isOpen, onClose, availableCities = [] }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Form states para novo membro
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState('vendedor'); // 'vendedor' | 'gestor'
  const [selectedCities, setSelectedCities] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estado de edição de vendedor existente
  const [editingVendor, setEditingVendor] = useState(null);

  // Carrega lista da equipe
  const fetchTeam = async () => {
    setLoading(true);
    try {
      // 1. Busca todos os perfis
      const { data: perfis, error: pErr } = await supabase
        .from('perfis')
        .select('*')
        .order('role', { ascending: true })
        .order('nome', { ascending: true });

      if (pErr) throw pErr;

      // 2. Busca atribuições de cidades
      const { data: cidadesData, error: cErr } = await supabase
        .from('vendedor_cidades')
        .select('*');

      if (cErr) throw cErr;

      const teamWithCities = (perfis || []).map(member => {
        const memberCities = (cidadesData || [])
          .filter(c => c.vendedor_id === member.id)
          .map(c => c.cidade);
        return {
          ...member,
          cidades: memberCities
        };
      });

      setTeam(teamWithCities);
    } catch (err) {
      console.error('Erro ao carregar equipe:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTeam();
      setFormError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  const toggleCitySelection = (cityName) => {
    if (selectedCities.includes(cityName)) {
      setSelectedCities(selectedCities.filter(c => c !== cityName));
    } else {
      setSelectedCities([...selectedCities, cityName]);
    }
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setFormError('Preencha nome, e-mail e senha.');
      return;
    }

    if (senha.length < 6) {
      setFormError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('admin_criar_usuario', {
        p_email: email.trim().toLowerCase(),
        p_password: senha,
        p_nome: nome.trim(),
        p_role: role,
        p_cidades: role === 'gestor' ? [] : selectedCities
      });

      if (error) throw error;

      setSuccessMsg(`${role === 'gestor' ? 'Gestor' : 'Vendedor'} ${nome} cadastrado com sucesso!`);
      setNome('');
      setEmail('');
      setSenha('');
      setRole('vendedor');
      setSelectedCities([]);
      setActiveTab('list');
      await fetchTeam();
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      setFormError(err.message || 'Erro ao criar usuário. Verifique os dados.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateVendor = async (vendorId, novoAtivo, novasCidades, novoRole = 'vendedor') => {
    try {
      const { error } = await supabase.rpc('admin_atualizar_usuario', {
        p_usuario_id: vendorId,
        p_ativo: novoAtivo,
        p_role: novoRole,
        p_cidades: novoRole === 'gestor' ? [] : novasCidades
      });

      if (error) throw error;

      setSuccessMsg('Membro da equipe atualizado com sucesso!');
      setEditingVendor(null);
      await fetchTeam();
    } catch (err) {
      console.error('Erro ao atualizar membro:', err);
      alert('Erro ao atualizar: ' + (err.message || 'Tente novamente.'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open z-50">
      <div className="modal-box w-11/12 max-w-4xl max-h-[90vh] flex flex-col p-6 bg-base-100 border border-base-300 shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-base-300 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo1.png"
              alt="Inova Beauty"
              className="h-9 w-auto object-contain drop-shadow-xs"
            />
            <div>
              <h3 className="font-bold text-lg text-base-content">Gestão da Equipe & Carteiras</h3>
              <p className="text-xs text-base-content/60">Controle de acesso, criação de vendedores e atribuição de cidades</p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>

        {/* Abas */}
        <div className="tabs tabs-boxed my-4 bg-base-200 p-1">
          <button 
            className={`tab flex-1 font-medium transition-all ${activeTab === 'list' ? 'tab-active !bg-primary !text-primary-content' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Membros da Equipe ({team.length})
          </button>
          <button 
            className={`tab flex-1 font-medium transition-all ${activeTab === 'new' ? 'tab-active !bg-primary !text-primary-content' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            + Cadastrar Novo Vendedor
          </button>
        </div>

        {/* Mensagens de Feedback */}
        {successMsg && (
          <div className="alert alert-success text-xs py-2 px-3 mb-3">
            <span>✓ {successMsg}</span>
          </div>
        )}
        {formError && (
          <div className="alert alert-error text-xs py-2 px-3 mb-3">
            <span>⚠ {formError}</span>
          </div>
        )}

        {/* Conteúdo da Aba */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'list' ? (
            <div>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <span className="loading loading-spinner text-primary loading-md"></span>
                  <span className="text-xs text-base-content/60">Carregando equipe...</span>
                </div>
              ) : team.length === 0 ? (
                <div className="text-center py-12 text-base-content/50 text-sm">
                  Nenhum membro encontrado.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {team.map(member => (
                    <div 
                      key={member.id}
                      className={`card bg-base-200/60 border ${member.ativo ? 'border-base-300' : 'border-error/40 opacity-70'} shadow-sm`}
                    >
                      <div className="card-body p-4 gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-base-content">{member.nome}</span>
                              <span className={`badge badge-xs font-semibold ${
                                member.role === 'gestor' 
                                  ? 'badge-primary' 
                                  : 'badge-neutral'
                              }`}>
                                {member.role === 'gestor' ? 'Gestor' : 'Vendedor'}
                              </span>
                            </div>
                            <span className="text-xs text-base-content/60">{member.email}</span>
                          </div>

                          <span className={`badge badge-sm font-semibold ${member.ativo ? 'badge-success badge-outline' : 'badge-error badge-outline'}`}>
                            {member.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>

                        {/* Cidades Atribuídas */}
                        <div className="mt-2">
                          <span className="text-[11px] font-semibold text-base-content/60 block mb-1">
                            {member.role === 'gestor' ? 'Acesso a todas as cidades' : 'Cidades Atribuídas:'}
                          </span>
                          
                          {member.role === 'gestor' ? (
                            <span className="text-xs text-primary font-medium">✓ Acesso Irrestrito Total</span>
                          ) : member.cidades && member.cidades.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {member.cidades.map(c => (
                                <span key={c} className="badge badge-sm bg-base-300 text-[11px]">
                                  {c}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-warning">Nenhuma cidade atribuída</span>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="card-actions justify-end mt-3 pt-2 border-t border-base-300">
                          <button
                            onClick={() => setEditingVendor(member)}
                            className="btn btn-xs btn-outline btn-primary"
                          >
                            Editar Permissões & Status
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Formulário Novo Membro (Gestor ou Vendedor) */
            <form onSubmit={handleCreateVendor} className="flex flex-col gap-4 max-w-xl mx-auto py-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium text-xs">Nome Completo do Membro</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Silva"
                  className="input input-sm input-bordered w-full"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium text-xs">E-mail de Acesso</span>
                  </label>
                  <input
                    type="email"
                    placeholder="joao@inovabeauty.com.br"
                    className="input input-sm input-bordered w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium text-xs">Senha Inicial</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Mínimo 6 dígitos"
                    className="input input-sm input-bordered w-full"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Seleção do Cargo (Gestor vs Vendedor) */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text font-semibold text-xs">Cargo do Novo Membro</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('vendedor')}
                    className={`btn btn-sm justify-start gap-2 border transition-all ${role === 'vendedor' ? 'btn-primary shadow-sm text-white' : 'btn-ghost bg-base-200 border-base-300'}`}
                  >
                    <span>💼</span>
                    <div className="text-left leading-none">
                      <div className="font-bold text-xs">Vendedor</div>
                      <div className="text-[10px] opacity-70">Acesso restrito por cidades</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('gestor')}
                    className={`btn btn-sm justify-start gap-2 border transition-all ${role === 'gestor' ? 'btn-primary shadow-sm text-white' : 'btn-ghost bg-base-200 border-base-300'}`}
                  >
                    <span>👑</span>
                    <div className="text-left leading-none">
                      <div className="font-bold text-xs">Gestor</div>
                      <div className="text-[10px] opacity-70">Acesso total irrestrito</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Seletor de Cidades (apenas para Vendedores) ou Aviso de Acesso Total (para Gestores) */}
              {role === 'vendedor' ? (
                <div className="form-control mt-1">
                  <label className="label flex justify-between py-1">
                    <span className="label-text font-medium text-xs">Atribuir Cidades à Carteira</span>
                    <span className="text-[11px] text-base-content/60">
                      {selectedCities.length} selecionada(s)
                    </span>
                  </label>

                  <div className="p-3 bg-base-200/50 rounded-lg border border-base-300 max-h-44 overflow-y-auto flex flex-wrap gap-1.5">
                    {availableCities.length === 0 ? (
                      <span className="text-xs text-base-content/50">Nenhuma cidade encontrada na base.</span>
                    ) : (
                      availableCities.map(city => {
                        const cityName = typeof city === 'string' ? city : city.name;
                        const isSelected = selectedCities.includes(cityName);
                        return (
                          <button
                            key={cityName}
                            type="button"
                            onClick={() => toggleCitySelection(cityName)}
                            className={`btn btn-xs rounded-full transition-all ${
                              isSelected 
                                ? 'btn-primary text-white shadow-sm' 
                                : 'btn-ghost bg-base-100 hover:bg-base-300 text-base-content'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {cityName}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <label className="label py-1">
                    <span className="label-text-alt text-[11px] text-base-content/50">
                      O vendedor só visualizará salões e rotas pertencentes a estas cidades.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary leading-relaxed flex items-start gap-2.5 mt-1">
                  <span className="text-lg">👑</span>
                  <div>
                    <span className="font-bold block mb-0.5">Acesso Total & Irrestrito</span>
                    O novo Gestor terá visualização de todos os salões de todas as cidades e permissão para gerenciar a equipe comercial.
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-base-300">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="btn btn-sm btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-sm btn-primary px-6"
                >
                  {submitting ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    role === 'gestor' ? 'Cadastrar Novo Gestor' : 'Cadastrar Novo Vendedor'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Secundário: Edição de Membro */}
        {editingVendor && (
          <div className="modal modal-open z-[60]">
            <div className="modal-box w-11/12 max-w-lg p-5 bg-base-100 border border-base-300 shadow-2xl">
              <h4 className="font-bold text-base text-base-content mb-1">
                Editar Membro: {editingVendor.nome}
              </h4>
              <p className="text-xs text-base-content/60 mb-4">{editingVendor.email}</p>

              {/* Status Ativo/Inativo */}
              <div className="form-control mb-4">
                <label className="label cursor-pointer justify-start gap-3 bg-base-200 p-2.5 rounded-lg">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={editingVendor.ativo}
                    onChange={(e) => setEditingVendor({ ...editingVendor, ativo: e.target.checked })}
                  />
                  <span className="label-text font-medium text-xs">
                    {editingVendor.ativo ? 'Usuário Ativo (pode logar no CRM)' : 'Usuário Inativo (bloqueado)'}
                  </span>
                </label>
              </div>

              {/* Alterar Cargo */}
              <div className="form-control mb-4">
                <label className="label py-1">
                  <span className="label-text font-semibold text-xs">Cargo no Sistema</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingVendor({ ...editingVendor, role: 'vendedor' })}
                    className={`btn btn-xs sm:btn-sm justify-start gap-2 border ${editingVendor.role === 'vendedor' ? 'btn-primary text-white' : 'btn-ghost bg-base-200'}`}
                  >
                    <span>💼</span>
                    <span className="text-xs font-bold">Vendedor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingVendor({ ...editingVendor, role: 'gestor' })}
                    className={`btn btn-xs sm:btn-sm justify-start gap-2 border ${editingVendor.role === 'gestor' ? 'btn-primary text-white' : 'btn-ghost bg-base-200'}`}
                  >
                    <span>👑</span>
                    <span className="text-xs font-bold">Gestor</span>
                  </button>
                </div>
              </div>

              {/* Cidades Atribuídas (apenas se for Vendedor) */}
              {editingVendor.role === 'vendedor' ? (
                <div className="form-control mb-4">
                  <label className="label py-1">
                    <span className="label-text font-medium text-xs">Cidades da Carteira</span>
                  </label>
                  <div className="p-3 bg-base-200/50 rounded-lg border border-base-300 max-h-44 overflow-y-auto flex flex-wrap gap-1.5">
                    {availableCities.map(city => {
                      const cityName = typeof city === 'string' ? city : city.name;
                      const isSelected = (editingVendor.cidades || []).includes(cityName);
                      return (
                        <button
                          key={cityName}
                          type="button"
                          onClick={() => {
                            const current = editingVendor.cidades || [];
                            const updated = isSelected 
                              ? current.filter(c => c !== cityName)
                              : [...current, cityName];
                            setEditingVendor({ ...editingVendor, cidades: updated });
                          }}
                          className={`btn btn-xs rounded-full transition-all ${
                            isSelected 
                              ? 'btn-primary text-white shadow-sm' 
                              : 'btn-ghost bg-base-100 hover:bg-base-300 text-base-content'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {cityName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary mb-4 leading-relaxed">
                  👑 <strong>Acesso Total:</strong> Gestores têm acesso irrestrito a todas as cidades cadastradas.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-base-300">
                <button
                  type="button"
                  onClick={() => setEditingVendor(null)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateVendor(editingVendor.id, editingVendor.ativo, editingVendor.cidades, editingVendor.role)}
                  className="btn btn-sm btn-primary"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
