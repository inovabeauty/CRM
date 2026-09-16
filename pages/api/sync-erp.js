import { runErpSync } from '../../lib/erpSyncEngine';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verificação de Segurança e Autorização
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Token de autorização ausente. Faça login no CRM.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Cria cliente com o contexto de permissões do usuário autenticado (injetando Bearer Token)
  const authenticatedCrmClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    }
  );

  const { data: { user }, error: authErr } = await authenticatedCrmClient.auth.getUser(token);

  if (authErr || !user) {
    return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  // 2. Validar se o usuário é Gestor Ativo respeitando RLS via client autenticado
  const { data: perfil, error: profErr } = await authenticatedCrmClient
    .from('perfis')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  const userRole = perfil?.role || user.user_metadata?.role;
  const isAtivo = perfil ? perfil.ativo !== false : true;

  if (profErr || userRole !== 'gestor' || !isAtivo) {
    return res.status(403).json({ success: false, error: 'Acesso negado: apenas Gestores ativos podem sincronizar dados com o ERP.' });
  }

  try {
    const result = await runErpSync(authenticatedCrmClient);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro na sincronização ERP -> CRM:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno na sincronização com o ERP'
    });
  }
}
