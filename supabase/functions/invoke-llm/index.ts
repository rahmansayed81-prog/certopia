const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('LLM_API_KEY');
    if (!apiKey) {
      return Response.json(
        { error: 'LLM_API_KEY is not configured. Set a free-tier provider key (e.g. Groq) with: supabase secrets set LLM_API_KEY=...' },
        { status: 500, headers: corsHeaders }
      );
    }
    const baseUrl = Deno.env.get('LLM_API_BASE_URL') || 'https://api.groq.com/openai/v1';
    const model = Deno.env.get('LLM_MODEL') || 'llama-3.3-70b-versatile';

    const { prompt, response_json_schema } = await req.json();

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: response_json_schema
              ? `Respond with ONLY a valid JSON object matching this schema, no other text: ${JSON.stringify(response_json_schema)}`
              : 'Respond concisely.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: response_json_schema ? { type: 'json_object' } : undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `LLM provider error (${res.status}): ${text}` }, { status: 500, headers: corsHeaders });
    }

    const completion = await res.json();
    const content = completion.choices?.[0]?.message?.content ?? '';

    if (response_json_schema) {
      try {
        const parsed = JSON.parse(content);
        return Response.json(parsed, { headers: corsHeaders });
      } catch {
        return Response.json({ error: 'LLM did not return valid JSON', raw: content }, { status: 500, headers: corsHeaders });
      }
    }

    return Response.json({ result: content }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
