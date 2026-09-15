import { createClient } from '@supabase/supabase-js';

const erpUrl = process.env.ERP_SUPABASE_URL || 'https://sjiyxwkdmfbauksumbqm.supabase.co';
const erpKey = process.env.ERP_SUPABASE_SERVICE_KEY || process.env.ERP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqaXl4d2tkbWZiYXVrc3VtYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTg0OTMsImV4cCI6MjA4Nzc5NDQ5M30.t8J1xFhnxGJRNYnes17vAYxAKftvdad8iIUYxB75V4U';

// Cliente Supabase conectado ao ERP (pdv-crm-inova)
// REGRA: SOMENTE LEITURA. Nenhuma operação de escrita deve ser realizada no ERP a partir do CRM.
export const erpSupabase = createClient(erpUrl, erpKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
