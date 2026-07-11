import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const callerProfile = user ? (await admin.from('users').select('role').eq('id', user.id).single()).data : null;
    if (callerProfile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const { user_email, cc_balance } = await req.json();

    const { data: target } = await admin.from('users').select('id').eq('email', user_email).single();
    if (!target) {
      return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });
    }

    await admin.from('users').update({ cc_balance }).eq('id', target.id);

    return Response.json({ success: true, cc_balance }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
