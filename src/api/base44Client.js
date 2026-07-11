import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Maps the Base44 entity names used throughout this codebase to the
// Postgres table names in the new Supabase backend.
const TABLE_MAP = {
  User: 'users',
  Domain: 'domains',
  Category: 'categories',
  Track: 'tracks',
  QuestionBank: 'question_banks',
  BankRequest: 'bank_requests',
  Question: 'questions',
  MockExam: 'mock_exams',
  ExamAttempt: 'exam_attempts',
  CreditTransaction: 'credit_transactions',
  InvitationCode: 'invitation_codes',
  QuestionContribution: 'question_contributions',
  BankContribution: 'bank_contributions',
  ContactMessage: 'contact_messages',
  NewsAnnouncement: 'news_announcements',
  AppSetting: 'app_settings',
  SubAdminAssignment: 'sub_admin_assignments',
};

// Base44 entities auto-exposed virtual fields "created_date" / "updated_date"
// for sorting. Our Postgres schema uses "created_at" / "updated_at" instead,
// so we translate sort keys here - every existing call site like
// base44.entities.X.list("-created_date") keeps working unmodified.
function parseSort(sort) {
  if (!sort) return null;
  const descending = sort.startsWith('-');
  const rawKey = descending ? sort.slice(1) : sort;
  const column =
    rawKey === 'created_date' ? 'created_at' : rawKey === 'updated_date' ? 'updated_at' : rawKey;
  return { column, ascending: !descending };
}

async function runQuery(builder, sort, limit) {
  let query = builder;
  const order = parseSort(sort);
  if (order) query = query.order(order.column, { ascending: order.ascending });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function makeEntity(entityName) {
  const table = TABLE_MAP[entityName];
  if (!table) throw new Error(`Unknown entity: ${entityName}`);

  return {
    async list(sort, limit) {
      return runQuery(supabase.from(table).select('*'), sort, limit);
    },
    async filter(query = {}, sort, limit) {
      let q = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(query)) {
        q = Array.isArray(value) ? q.in(key, value) : q.eq(key, value);
      }
      return runQuery(q, sort, limit);
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async create(payload) {
      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async bulkCreate(payloads) {
      const { data, error } = await supabase.from(table).insert(payloads).select();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

const entities = Object.fromEntries(Object.keys(TABLE_MAP).map((name) => [name, makeEntity(name)]));

const auth = {
  async me() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (error) throw error;
    return data;
  },
  async updateMe(payload) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async redirectToLogin(next) {
    let redirectTo;
    if (!next) redirectTo = `${window.location.origin}/dashboard`;
    else if (/^https?:\/\//.test(next)) redirectTo = next;
    else redirectTo = `${window.location.origin}${next.startsWith('/') ? next : `/${next}`}`;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  },
  async logout(next) {
    await supabase.auth.signOut();
    window.location.href = next || '/';
  },
};

// Core.SendEmail and Core.InvokeLLM are proxied to Supabase Edge Functions
// ("send-email" and "invoke-llm") since Supabase has no built-in email/LLM
// integration the way Base44 did. Those Edge Functions need their own
// provider API key (e.g. Resend for email, an LLM provider for InvokeLLM)
// configured as a function secret before they will work.
const integrations = {
  Core: {
    async UploadFile({ file }) {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from('bank-files').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('bank-files').getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
    async SendEmail(payload) {
      const { data, error } = await supabase.functions.invoke('send-email', { body: payload });
      if (error) throw error;
      return data;
    },
    async InvokeLLM(payload) {
      const { data, error } = await supabase.functions.invoke('invoke-llm', { body: payload });
      if (error) throw error;
      return data;
    },
  },
};

const functionsApi = {
  async invoke(name, payload) {
    const { data, error } = await supabase.functions.invoke(name, { body: payload });
    if (error) throw error;
    return data;
  },
};

export const base44 = {
  entities,
  auth,
  integrations,
  functions: functionsApi,
  // Frontend code never actually uses asServiceRole (that was only used inside
  // Base44's own Deno functions), kept here only so nothing throws if referenced.
  asServiceRole: { integrations },
};
