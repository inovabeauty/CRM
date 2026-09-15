import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/authContext';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const { user, signIn, signUpInitialGestor, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados para setup inicial caso não haja nenhum gestor cadastrado ainda
  const [isFirstSetup, setIsFirstSetup] = useState(false);
  const [setupNome, setSetupNome] = useState('');
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Se já estiver logado, redireciona para o CRM
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  // Verifica se o sistema possui algum usuário cadastrado
  useEffect(() => {
    async function checkFirstRun() {
      try {
        const { data: precisaSetup, error } = await supabase.rpc('sistema_precisa_setup');

        if (!error && precisaSetup === true) {
          setIsFirstSetup(true);
        }
      } catch (err) {
        console.error('Erro ao verificar setup inicial:', err);
      } finally {
        setCheckingSetup(false);
      }
    }
    checkFirstRun();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/');
    } catch (err) {
      console.error('Erro de login:', err);
      let msg = 'Falha ao autenticar. Verifique suas credenciais.';
      if (err.message?.includes('Invalid login credentials')) {
        msg = 'E-mail ou senha incorretos.';
      } else if (err.message?.includes('inativo')) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFirstSetup = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!setupNome.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha todos os campos do setup.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await signUpInitialGestor(setupNome, email, password);
      router.push('/');
    } catch (err) {
      console.error('Erro no setup inicial:', err);
      setErrorMessage(err.message || 'Erro ao registrar gestor inicial.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <span className="loading loading-spinner text-amber-500 loading-lg"></span>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{isFirstSetup ? 'Configuração Inicial - Inova Beauty CRM' : 'Login - Inova Beauty CRM'}</title>
      </Head>

      {/* Fundo Sofisticado Obsidian & Ouro */}
      <div className="relative min-h-screen flex items-center justify-center bg-[#0e0e11] text-neutral-100 p-4 sm:p-6 overflow-hidden select-none">
        {/* Glow de iluminação de fundo ambiente */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-amber-600/15 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-700/5 rounded-full blur-3xl pointer-events-none" />

        {/* Card Principal Glassmorphic */}
        <div className="relative w-full max-w-[440px] rounded-3xl border border-amber-500/20 bg-neutral-900/80 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] shadow-amber-950/10 p-7 sm:p-9 z-10 transition-all">
          
          {/* Topo: Logo Oficial e Identidade */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-4 relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-600/20 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative p-2.5 rounded-2xl bg-neutral-950/80 border border-amber-500/25 shadow-xl flex items-center justify-center">
                <img
                  src="/logo1.png"
                  alt="Inova Beauty"
                  className="h-16 sm:h-20 w-auto object-contain drop-shadow-md"
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-300">
                Sistema Comercial Oficial
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              INOVA <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent font-extrabold">BEAUTY</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1 font-medium tracking-wide">
              {isFirstSetup
                ? 'Primeiro acesso: Crie as credenciais de Gestor'
                : 'Gestão comercial inteligente para rotas de salões'}
            </p>
          </div>

          {/* Mensagem de Erro com Design Refinado */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs mb-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {isFirstSetup ? (
            /* Formulário de Setup Inicial */
            <form onSubmit={handleFirstSetup} className="space-y-4">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200 leading-relaxed">
                <span className="font-bold text-amber-400 block mb-0.5">🌟 Setup Inicial do Gestor</span>
                Esta conta terá acesso total e permissão para gerenciar equipes e carteiras de clientes.
              </div>

              {/* Nome */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 mb-1.5 flex items-center gap-1.5">
                  <span>Nome do Gestor</span>
                </label>
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Oliveira"
                    className="grow bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none border-none p-0 focus:ring-0"
                    value={setupNome}
                    onChange={(e) => setSetupNome(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 mb-1.5 flex items-center gap-1.5">
                  <span>E-mail</span>
                </label>
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <input
                    type="email"
                    placeholder="seu.email@inovabeauty.com.br"
                    className="grow bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none border-none p-0 focus:ring-0"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 mb-1.5 flex items-center gap-1.5">
                  <span>Senha Mestre</span>
                </label>
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    className="grow bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none border-none p-0 focus:ring-0"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-neutral-500 hover:text-amber-400 p-1 shrink-0 transition-colors focus:outline-none"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 rounded-2xl font-bold text-xs sm:text-sm tracking-wider uppercase bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-neutral-950 shadow-[0_4px_20px_rgba(217,119,6,0.35)] hover:shadow-[0_6px_25px_rgba(217,119,6,0.5)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-xs text-neutral-950"></span>
                  ) : (
                    'Criar Conta de Gestor & Entrar'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Formulário Sofisticado de Login */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Campo E-mail Corporativo */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 mb-1.5 flex items-center gap-1.5">
                  <span>E-mail Corporativo</span>
                </label>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-neutral-950/80 border border-neutral-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <input
                    type="text"
                    placeholder="seu.email@inovabeauty.com.br"
                    className="grow bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none border-none p-0 focus:ring-0 font-medium"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/90 mb-1.5 flex items-center gap-1.5">
                  <span>Senha</span>
                </label>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-neutral-950/80 border border-neutral-800 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    className="grow bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none border-none p-0 focus:ring-0 font-medium"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-neutral-500 hover:text-amber-400 p-1 shrink-0 transition-colors focus:outline-none cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Botão de Ação CTA */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wider uppercase bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-neutral-950 shadow-[0_4px_20px_rgba(217,119,6,0.35)] hover:shadow-[0_6px_25px_rgba(217,119,6,0.5)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-xs text-neutral-950"></span>
                  ) : (
                    'Entrar no Sistema'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Rodapé de Segurança e Confiança */}
          <div className="mt-8 pt-5 border-t border-neutral-800/80 flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-amber-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Acesso restrito & criptografado</span>
            </div>
            <span className="text-[10px] text-neutral-600 font-mono">
              Inova Beauty Cosméticos • Gestão Comercial
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
