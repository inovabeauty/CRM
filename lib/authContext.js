import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabaseClient';

const AuthContext = createContext({
  user: null,
  profile: null,
  userCities: [],
  isGestor: false,
  isVendedor: false,
  loading: true,
  signIn: async () => {},
  signUpInitialGestor: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userCities, setUserCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Carrega dados completos do perfil e cidades associadas
  const loadUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      setUserCities([]);
      return null;
    }

    try {
      // 1. Busca perfil do usuário
      const { data: prof, error: profErr } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profErr || !prof) {
        console.warn('Perfil ainda não criado ou erro ao carregar:', profErr);
        // Fallback temporário usando user_metadata
        const meta = authUser.user_metadata || {};
        const fallbackProf = {
          id: authUser.id,
          nome: meta.nome || authUser.email?.split('@')[0] || 'Usuário',
          email: authUser.email,
          role: meta.role || 'vendedor',
          ativo: true
        };
        setProfile(fallbackProf);
        return fallbackProf;
      }

      setProfile(prof);

      // 2. Se for vendedor, busca as cidades permitidas
      if (prof.role === 'vendedor') {
        const { data: citiesData } = await supabase
          .from('vendedor_cidades')
          .select('cidade')
          .eq('vendedor_id', authUser.id);

        const cities = (citiesData || []).map(c => c.cidade);
        setUserCities(cities);
      } else {
        // Gestor tem acesso irrestrito (todas as cidades)
        setUserCities([]);
      }

      return prof;
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
      return null;
    }
  }, []);

  // Monitora sessão ativa do Supabase
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setUserCities([]);
        }
      } catch (err) {
        console.error('Erro ao inicializar sessão auth:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setUserCities([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadUserProfile]);

  // Login com e-mail e senha
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      throw error;
    }

    if (data?.user) {
      const prof = await loadUserProfile(data.user);
      if (prof && prof.ativo === false) {
        await supabase.auth.signOut();
        throw new Error('Seu acesso está inativo. Entre em contato com o gestor.');
      }
    }

    return data;
  };

  // Cadastro do Primeiro Gestor (usado apenas se não houver usuários)
  const signUpInitialGestor = async (nome, email, password) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Executa via RPC no PostgreSQL (permite qualquer formato de e-mail sem bloqueio de TLD)
    const { error: rpcErr } = await supabase.rpc('setup_primeiro_gestor', {
      p_nome: nome.trim(),
      p_email: cleanEmail,
      p_password: password
    });

    if (rpcErr) {
      console.error('Erro na RPC setup_primeiro_gestor:', rpcErr);
      throw new Error(rpcErr.message || 'Erro ao registrar primeiro gestor.');
    }

    // 2. Realiza o login imediato com a nova conta criada
    const loginResult = await signIn(cleanEmail, password);
    return loginResult;
  };

  // Logout
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setUserCities([]);
    router.push('/login');
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  const isGestor = profile?.role === 'gestor';
  const isVendedor = profile?.role === 'vendedor';

  const value = {
    user,
    profile,
    userCities,
    isGestor,
    isVendedor,
    loading,
    signIn,
    signUpInitialGestor,
    signOut,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
