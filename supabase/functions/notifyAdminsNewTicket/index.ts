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

    const { user_email, user_name, type, subject, message } = await req.json();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: admins } = await admin.from('users').select('email').eq('role', 'admin');

    const typeEmoji = { incident: '\u{1F41B}', recommendation: '\u{1F4A1}', question: '❓', other: '\u{1F4EC}' }[type] || '\u{1F4EC}';
    const typeLabel = { incident: 'Incident', recommendation: 'Recommendation', question: 'Question', other: 'Other' }[type] || 'Other';

    const emailBody = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #4f46e5; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 20px;">${typeEmoji} New Support Ticket</h2>
    <p style="margin: 4px 0 0; opacity: 0.85; font-size: 14px;">A user has submitted a new ticket on Certopia</p>
  </div>
  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">From</td><td style="padding: 6px 0; font-weight: 600;">${user_name} (${user_email})</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Type</td><td style="padding: 6px 0;">${typeEmoji} ${typeLabel}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Subject</td><td style="padding: 6px 0; font-weight: 600;">${subject}</td></tr>
    </table>
    <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
      <p style="margin: 0; color: #111827; white-space: pre-wrap; font-size: 14px;">${message}</p>
    </div>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${Deno.env.get('APP_URL') || 'https://certopia.pages.dev'}/admin" style="background: #4f46e5; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">View in Admin Dashboard →</a>
    </div>
  </div>
</div>
    `.trim();

    const adminsList = admins || [];
    await Promise.all(
      adminsList.map((a) => sendViaResend(a.email, `[Certopia] New ${typeLabel} Ticket: ${subject}`, emailBody))
    );

    return Response.json({ success: true, notified: adminsList.length }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
