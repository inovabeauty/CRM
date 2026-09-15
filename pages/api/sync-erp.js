import { runErpSync } from '../../lib/erpSyncEngine';
import { supabase as crmSupabase } from '../../lib/supabaseClient';
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
  const { data: { user }, error: authErr } = await crmSupabase.auth.getUser(token);

  if (authErr || !user) {
    return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  // 2. Validar se o usuário é Gestor Ativo
  const { data: perfil, error: profErr } = await crmSupabase
    .from('perfis')
    .select('role, ativo')
    .eq('id', user.id)
    .single();

  if (profErr || !perfil || perfil.role !== 'gestor' || perfil.ativo === false) {
    return res.status(403).json({ success: false, error: 'Acesso negado: apenas Gestores ativos podem sincronizar dados com o ERP.' });
  }

  try {
    // Cria cliente com o contexto de permissões do Gestor autenticado
    const authenticatedCrmClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

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
