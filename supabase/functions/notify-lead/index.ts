const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const notificationEmails = (Deno.env.get('NOTIFICATION_EMAILS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (!resendApiKey || !notificationEmails.length) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing Resend configuration' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const payload = await request.json()

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Neptunys Quizz <onboarding@resend.dev>',
      to: notificationEmails,
      subject: `New Neptunys Quizz lead: ${payload.name}`,
      html: `
        <h1>New lead received</h1>
        <p><strong>Name:</strong> ${payload.name}</p>
        <p><strong>Phone:</strong> ${payload.phone}</p>
        <p><strong>Email:</strong> ${payload.email || 'Not provided'}</p>
        <p><strong>Contact method:</strong> ${payload.contactMethod}</p>
        <p><strong>Best time:</strong> ${payload.bestTime}</p>
        <p><strong>Result:</strong> ${payload.resultKey}</p>
        <pre>${JSON.stringify(payload.answers, null, 2)}</pre>
        <pre>${JSON.stringify(payload.attribution, null, 2)}</pre>
      `,
    }),
  })

  const body = await response.text()

  return new Response(body, {
    status: response.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
