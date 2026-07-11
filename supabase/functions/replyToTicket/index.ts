import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'Certopia <onboarding@resend.dev>';
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend error (${res.status}): ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });

    const { ticket_id, user_email, user_name, subject, reply_message } = await req.json();

    const emailBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #4f46e5; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 20px;">\u{1F4AC} Response from Certopia Support</h2>
    <p style="margin: 4px 0 0; opacity: 0.85; font-size: 14px;">Regarding your ticket: <strong>${subject}</strong></p>
  </div>
  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 8px; color: #374151; font-size: 14px;">Hi ${user_name},</p>
    <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; margin: 16px 0;">
      <p style="margin: 0; color: #111827; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${reply_message}</p>
    </div>
    <p style="margin: 0; color: #6b7280; font-size: 12px;">— The Certopia Team</p>
  </div>
</div>
    `.trim();

    await sendViaResend(user_email, `Re: ${subject}`, emailBody);

    const { data: ticket } = await admin.from('contact_messages').select('*').eq('id', ticket_id).single();
    if (ticket) {
      const existingNotes = ticket.admin_notes || '';
      const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const updatedNotes = `${existingNotes ? existingNotes + '\n\n' : ''}[Reply sent ${timestamp}]:\n${reply_message}`;
      await admin.from('contact_messages').update({ admin_notes: updatedNotes, status: 'in_progress' }).eq('id', ticket.id);
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
