import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const adminPassword = Deno.env.get('ADMIN_PASSWORD')
  const supabaseUrl = Deno.env.get('PROJECT_URL')
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
  const providedPassword = request.headers.get('x-admin-password')

  if (!adminPassword || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing admin configuration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (providedPassword !== adminPassword) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { quizId } = await request.json()
  const client = createClient(supabaseUrl, serviceRoleKey)

  const [{ data: sessions, error: sessionsError }, { data: events, error: eventsError }, { data: leads, error: leadsError }] =
    await Promise.all([
      client.from('quiz_sessions').select('*').eq('quiz_id', quizId).order('started_at', { ascending: false }),
      client.from('quiz_events').select('*').eq('quiz_id', quizId).order('occurred_at', { ascending: false }),
      client.from('leads').select('*').eq('quiz_id', quizId).order('created_at', { ascending: false }),
    ])

  if (sessionsError || eventsError || leadsError) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: sessionsError?.message ?? eventsError?.message ?? leadsError?.message ?? 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  const normalizedLeads = (leads ?? []).map((lead) => ({
    id: lead.id,
    sessionId: lead.session_id,
    quizId: lead.quiz_id,
    variantId: lead.variant_id,
    resultKey: lead.result_key,
    firstName: lead.first_name,
    phone: lead.phone,
    contactMethod: lead.contact_method,
    bestTime: lead.best_time,
    email: lead.email,
    consent: lead.consent,
    answers: lead.answers_json,
    attribution: lead.attribution_json,
    createdAt: lead.created_at,
  }))

  const normalizedSessions = (sessions ?? []).map((session) => ({
    id: session.id,
    quizId: session.quiz_id,
    variantId: session.variant_id,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    landingUrl: session.landing_url,
    referrer: session.referrer,
    utmSource: session.utm_source,
    utmMedium: session.utm_medium,
    utmCampaign: session.utm_campaign,
    utmTerm: session.utm_term,
    utmContent: session.utm_content,
    deviceType: session.device_type,
  }))

  const normalizedEvents = (events ?? []).map((event) => ({
    id: event.id,
    sessionId: event.session_id,
    quizId: event.quiz_id,
    variantId: event.variant_id,
    eventName: event.event_name,
    stepKey: event.step_key,
    questionId: event.question_id,
    answerValue: event.answer_value,
    occurredAt: event.occurred_at,
    timeFromStartMs: event.time_from_start_ms,
    timeOnStepMs: event.time_on_step_ms,
    metadata: event.metadata,
  }))

  return new Response(
    JSON.stringify({
      sessions: normalizedSessions,
      events: normalizedEvents,
      leads: normalizedLeads,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
