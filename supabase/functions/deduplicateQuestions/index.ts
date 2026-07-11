import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: allQuestions, error } = await admin
      .from('questions')
      .select('id, question_bank_id, question_text')
      .limit(5000);
    if (error) throw error;

    const seen = new Map<string, string>();
    const toDelete: string[] = [];

    for (const q of allQuestions ?? []) {
      const key = `${q.question_bank_id}|||${q.question_text?.trim().toLowerCase()}`;
      if (seen.has(key)) {
        toDelete.push(q.id);
      } else {
        seen.set(key, q.id);
      }
    }

    if (toDelete.length) {
      await admin.from('questions').delete().in('id', toDelete);
    }

    return Response.json(
      { total_checked: allQuestions?.length ?? 0, duplicates_deleted: toDelete.length, deleted_ids: toDelete },
      { headers: corsHeaders }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
