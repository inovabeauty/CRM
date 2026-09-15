-- ==============================================================================
-- SCHEMA RBAC & GESTÃO DE EQUIPE - CRM INOVA
-- ==============================================================================

-- 1. Tabela de Perfis de Usuários (Gestor / Vendedor)
CREATE TABLE IF NOT EXISTS public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('gestor', 'vendedor')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Atribuição de Cidades aos Vendedores
CREATE TABLE IF NOT EXISTS public.vendedor_cidades (
    id BIGSERIAL PRIMARY KEY,
    vendedor_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    cidade TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (vendedor_id, cidade)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_perfis_role ON public.perfis(role);
CREATE INDEX IF NOT EXISTS idx_perfis_email ON public.perfis(email);
CREATE INDEX IF NOT EXISTS idx_vendedor_cidades_vendedor ON public.vendedor_cidades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendedor_cidades_cidade ON public.vendedor_cidades(cidade);

-- 3. Habilitar RLS
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_cidades ENABLE ROW LEVEL SECURITY;

-- 4. Funções Auxiliares de Segurança (Security Definer para evitar loops de recursão no RLS)
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND role = 'gestor' AND ativo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_minhas_cidades()
RETURNS SETOF TEXT AS $$
  SELECT cidade FROM public.vendedor_cidades
  WHERE vendedor_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Políticas RLS para tabela 'perfis'
DROP POLICY IF EXISTS "Perfis: Acesso total para gestores" ON public.perfis;
CREATE POLICY "Perfis: Acesso total para gestores"
ON public.perfis FOR ALL
TO authenticated
USING (public.is_gestor());

DROP POLICY IF EXISTS "Perfis: Usuario pode ler proprio perfil" ON public.perfis;
CREATE POLICY "Perfis: Usuario pode ler proprio perfil"
ON public.perfis FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Perfis: Permitir leitura publica temporaria ou anon" ON public.perfis;
CREATE POLICY "Perfis: Permitir leitura publica temporaria ou anon"
ON public.perfis FOR SELECT
TO anon
USING (true);

-- 6. Políticas RLS para tabela 'vendedor_cidades'
DROP POLICY IF EXISTS "Cidades: Gestores gerenciam todas" ON public.vendedor_cidades;
CREATE POLICY "Cidades: Gestores gerenciam todas"
ON public.vendedor_cidades FOR ALL
TO authenticated
USING (public.is_gestor());

DROP POLICY IF EXISTS "Cidades: Vendedor le suas cidades" ON public.vendedor_cidades;
CREATE POLICY "Cidades: Vendedor le suas cidades"
ON public.vendedor_cidades FOR SELECT
TO authenticated
USING (vendedor_id = auth.uid());

-- 7. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_perfis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_perfis_updated_at ON public.perfis;
CREATE TRIGGER trigger_perfis_updated_at
BEFORE UPDATE ON public.perfis
FOR EACH ROW
EXECUTE FUNCTION update_perfis_updated_at();

-- 8. Trigger para auto-criar perfil quando usuário se cadastra no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_nome TEXT;
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM public.perfis;
  
  -- Se for o primeiro usuário do sistema, ele vira Gestor automaticamente
  IF v_count = 0 THEN
    v_role := 'gestor';
  ELSE
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor');
  END IF;

  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));

  INSERT INTO public.perfis (id, nome, email, role, ativo)
  VALUES (NEW.id, v_nome, NEW.email, v_role, true)
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome, email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. RPC para Gestores criarem novos vendedores com suas cidades atribuídas
CREATE OR REPLACE FUNCTION public.admin_criar_vendedor(
  p_email TEXT,
  p_password TEXT,
  p_nome TEXT,
  p_cidades TEXT[]
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_cidade TEXT;
BEGIN
  IF NOT public.is_gestor() THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores ativos podem criar novos vendedores.';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome, 'role', 'vendedor', 'email_verified', true),
    now(),
    now(),
    false,
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email',
    p_email,
    now(),
    now(),
    now()
  );

  IF p_cidades IS NOT NULL THEN
    FOREACH v_cidade IN ARRAY p_cidades LOOP
      IF TRIM(v_cidade) <> '' THEN
        INSERT INTO public.vendedor_cidades (vendedor_id, cidade)
        VALUES (v_user_id, TRIM(v_cidade))
        ON CONFLICT (vendedor_id, cidade) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC para Setup Inicial do Primeiro Gestor (compatível com o GoTrue)
CREATE OR REPLACE FUNCTION public.setup_primeiro_gestor(
  p_email TEXT,
  p_password TEXT,
  p_nome TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM public.perfis;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'O primeiro gestor já foi configurado!';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    email_change_confirm_status,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', p_nome, 'role', 'gestor', 'email_verified', true),
    now(),
    now(),
    false,
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email',
    p_email,
    now(),
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. RPC para Gestores atualizarem status e cidades de vendedores
CREATE OR REPLACE FUNCTION public.admin_atualizar_vendedor(
  p_vendedor_id UUID,
  p_ativo BOOLEAN,
  p_cidades TEXT[]
)
RETURNS VOID AS $$
DECLARE
  v_cidade TEXT;
BEGIN
  IF NOT public.is_gestor() THEN
    RAISE EXCEPTION 'Acesso negado: apenas gestores ativos podem gerenciar vendedores.';
  END IF;

  UPDATE public.perfis
  SET ativo = p_ativo
  WHERE id = p_vendedor_id AND role = 'vendedor';

  DELETE FROM public.vendedor_cidades WHERE vendedor_id = p_vendedor_id;

  IF p_cidades IS NOT NULL THEN
    FOREACH v_cidade IN ARRAY p_cidades LOOP
      IF TRIM(v_cidade) <> '' THEN
        INSERT INTO public.vendedor_cidades (vendedor_id, cidade)
        VALUES (p_vendedor_id, TRIM(v_cidade))
        ON CONFLICT (vendedor_id, cidade) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

