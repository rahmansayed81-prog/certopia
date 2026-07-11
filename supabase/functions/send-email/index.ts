import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendViaResend(to: string, subject: string, body: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'Certopia <onboarding@resend.dev>';
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured. Set it with: supabase secrets set RESEND_API_KEY=... (get a free key from resend.com).');
  }
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  const html = isHtml ? body : `<div style="font-family:sans-serif;white-space:pre-wrap;">${body.replace(/</g, '&lt;')}</div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error (${res.status}): ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { to, subject, body } = await req.json();
    if (!to || !subject || !body) {
      return Response.json({ error: 'to, subject, and body are required' }, { status: 400, headers: corsHeaders });
    }
    const result = await sendViaResend(to, subject, body);
    return Response.json({ success: true, result }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
