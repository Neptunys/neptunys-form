import { buildDefaultProjectAutomations } from '../data/automationData'
import { defaultProjects, ensureQuizWorkflow, findQuizByHostname, findQuizBySlug, getActiveQuiz, getProjectById, normalizeProjectDefinitions } from '../data/quizData'
import { hasSupabaseConfig, supabase } from './supabase'
import type {
  AutomationInsights,
  DashboardMetrics,
  LeadPayload,
  LeadRecord,
  QuizBuilderDesign,
  ProjectAutomation,
  ProjectDefinition,
  QuizDefinition,
  SessionAnswers,
  SessionEvent,
  SessionRecord,
  VariantKey,
} from './types'
import { average, createId, csvEscape } from './utils'

const SESSIONS_KEY = 'neptunys.sessions'
const EVENTS_KEY = 'neptunys.events'
const LEADS_KEY = 'neptunys.leads'
const ADMIN_KEY = 'neptunys.admin'
const ADMIN_PERSIST_KEY = 'neptunys.admin.persist'
const PROJECTS_KEY = 'neptunys.projects'
const BUILDER_DESIGNS_KEY = 'neptunys.builder-designs'
const AUTOMATIONS_KEY = 'neptunys.automations'

type StartSessionInput = {
  quizId: string
  variantId: VariantKey
}

type ProjectRow = {
  id: string
  name: string
  slug: string
  notes: string | null
  active_quiz_id: string | null
}

type QuizRow = {
  id: string
  project_id: string | null
  name: string
  slug: string
  status: 'draft' | 'published'
  layout_mode: 'standalone' | 'embed'
}

type QuizConfigRow = {
  quiz_id: string
  theme_json: QuizDefinition['theme'] | null
  lead_steps_json: QuizDefinition['leadSteps'] | null
  transition_screen_json: QuizDefinition['transitionScreen'] | null
  thank_you_screen_json: QuizDefinition['thankYouScreen'] | null
  result_content_json: QuizDefinition['resultContent'] | null
  variants_json: QuizDefinition['variants'] | null
  workflow_json: QuizDefinition['workflow'] | null
  builder_design_json: QuizDefinition['builderDesign'] | null
}

type QuizDomainRow = {
  quiz_id: string
  hostname: string
}

type BuilderDesignRegistry = Record<string, QuizBuilderDesign>

function readList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeList<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function readRecord<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function getUtmValue(params: URLSearchParams, key: string) {
  return params.get(key) ?? ''
}

function getDeviceType() {
  return window.matchMedia('(max-width: 960px)').matches ? 'mobile' : 'desktop'
}

function getFallbackQuiz(quizId: string) {
  for (const project of defaultProjects) {
    const quiz = project.quizzes.find((item) => item.id === quizId)
    if (quiz) {
      return { project, quiz }
    }
  }

  const project = defaultProjects[0]
  return { project, quiz: getActiveQuiz(project) }
}

function mapSupabaseRow(table: string, payload: Record<string, unknown>) {
  if (table === 'quiz_sessions') {
    return {
      id: payload.id,
      quiz_id: payload.quizId,
      variant_id: payload.variantId,
      started_at: payload.startedAt,
      completed_at: payload.completedAt,
      landing_url: payload.landingUrl,
      referrer: payload.referrer,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_term: payload.utmTerm,
      utm_content: payload.utmContent,
      device_type: payload.deviceType,
    }
  }

  if (table === 'quiz_events') {
    return {
      id: payload.id,
      session_id: payload.sessionId,
      quiz_id: payload.quizId,
      variant_id: payload.variantId,
      event_name: payload.eventName,
      step_key: payload.stepKey,
      question_id: payload.questionId,
      answer_value: payload.answerValue,
      occurred_at: payload.occurredAt,
      time_from_start_ms: payload.timeFromStartMs,
      time_on_step_ms: payload.timeOnStepMs,
      metadata: payload.metadata ?? {},
    }
  }

  if (table === 'leads') {
    return {
      id: payload.id,
      session_id: payload.sessionId,
      quiz_id: payload.quizId,
      variant_id: payload.variantId,
      result_key: payload.resultKey,
      first_name: payload.firstName,
      phone: payload.phone,
      contact_method: payload.contactMethod,
      best_time: payload.bestTime,
      email: payload.email,
      consent: payload.consent,
      answers_json: payload.answers,
      attribution_json: payload.attribution,
      created_at: payload.createdAt,
    }
  }

  return payload
}

async function syncSupabase(table: string, payload: Record<string, unknown>) {
  if (!hasSupabaseConfig || !supabase) {
    return
  }

  try {
    await supabase.from(table).insert(mapSupabaseRow(table, payload))
  } catch {
    // Keep local fallback as the source of truth during fast setup.
  }
}

function normalizeProjects(
  projectRows: ProjectRow[],
  quizRows: QuizRow[],
  configRows: QuizConfigRow[],
  domainRows: QuizDomainRow[],
): ProjectDefinition[] {
  const configMap = new Map(configRows.map((row) => [row.quiz_id, row]))
  const domainMap = new Map<string, string>()

  for (const row of domainRows) {
    if (!domainMap.has(row.quiz_id)) {
      domainMap.set(row.quiz_id, row.hostname)
    }
  }

  const projects = projectRows.map((projectRow) => {
    const fallbackProject = defaultProjects.find((item) => item.id === projectRow.id)
    const quizzes = quizRows
      .filter((quizRow) => quizRow.project_id === projectRow.id)
      .map((quizRow) => {
        const fallbackQuiz = fallbackProject?.quizzes.find((item) => item.id === quizRow.id) ?? getFallbackQuiz(quizRow.id).quiz
        const configRow = configMap.get(quizRow.id)

        return ensureQuizWorkflow({
          id: quizRow.id,
          name: quizRow.name,
          slug: quizRow.slug,
          status: quizRow.status,
          layoutMode: quizRow.layout_mode,
          customDomain: domainMap.get(quizRow.id) ?? fallbackQuiz.customDomain ?? '',
          theme: configRow?.theme_json ?? fallbackQuiz.theme,
          leadSteps: configRow?.lead_steps_json ?? fallbackQuiz.leadSteps,
          transitionScreen: configRow?.transition_screen_json ?? fallbackQuiz.transitionScreen,
          thankYouScreen: configRow?.thank_you_screen_json ?? fallbackQuiz.thankYouScreen,
          resultContent: configRow?.result_content_json ?? fallbackQuiz.resultContent,
          variants: configRow?.variants_json ?? fallbackQuiz.variants,
          workflow: configRow?.workflow_json ?? fallbackQuiz.workflow,
          builderDesign: configRow?.builder_design_json ?? fallbackQuiz.builderDesign,
        })
      })

    return {
      id: projectRow.id,
      name: projectRow.name,
      slug: projectRow.slug,
      notes: projectRow.notes ?? fallbackProject?.notes ?? '',
      activeQuizId: projectRow.active_quiz_id ?? quizzes[0]?.id ?? fallbackProject?.activeQuizId ?? '',
      quizzes,
    }
  })

  return projects.length ? projects : defaultProjects
}

function isLegacyDemoRegistry(projects: ProjectDefinition[]) {
  if (projects.length !== 2) {
    return false
  }

  const legacyProject = projects.find((project) => project.id === 'project-military-claims')
  const demoProject = projects.find((project) => project.id === 'project-neptunys-audit')

  if (!legacyProject || !demoProject) {
    return false
  }

  return legacyProject.quizzes.length === 1
    && demoProject.quizzes.length === 1
    && legacyProject.quizzes[0]?.id === 'military-hearing-check'
    && demoProject.quizzes[0]?.id === 'military-hearing-check-demo'
}

function normalizeStoredProjects(projects: ProjectDefinition[]) {
  const normalized = normalizeProjectDefinitions(projects)
  return isLegacyDemoRegistry(normalized) ? defaultProjects : normalized
}

function extractBuilderDesignRegistry(projects: ProjectDefinition[]): BuilderDesignRegistry {
  return projects.reduce<BuilderDesignRegistry>((registry, project) => {
    for (const quiz of project.quizzes) {
      if (quiz.builderDesign) {
        registry[quiz.id] = quiz.builderDesign
      }
    }

    return registry
  }, {})
}

function stripBuilderDesignsFromProjects(projects: ProjectDefinition[]): ProjectDefinition[] {
  return projects.map((project) => ({
    ...project,
    quizzes: project.quizzes.map(({ builderDesign: _builderDesign, ...quiz }) => quiz),
  }))
}

function readBuilderDesignRegistryLocal(): BuilderDesignRegistry {
  return readRecord<BuilderDesignRegistry>(BUILDER_DESIGNS_KEY, {})
}

function mergeProjectsWithBuilderDesignRegistry(projects: ProjectDefinition[], builderDesigns: BuilderDesignRegistry) {
  return projects.map((project) => ({
    ...project,
    quizzes: project.quizzes.map((quiz) => ({
      ...quiz,
      builderDesign: builderDesigns[quiz.id] ?? quiz.builderDesign,
    })),
  }))
}

async function fetchRemoteRegistry(options?: { publishedOnly?: boolean }) {
  if (!hasSupabaseConfig || !supabase) {
    return null
  }

  const projectPromise = supabase.from('projects').select('id,name,slug,notes,active_quiz_id').order('name')
  const quizPromise = options?.publishedOnly
    ? supabase.from('quizzes').select('id,project_id,name,slug,status,layout_mode').eq('status', 'published').order('created_at')
    : supabase.from('quizzes').select('id,project_id,name,slug,status,layout_mode').order('created_at')

  const [{ data: projectRows, error: projectsError }, { data: quizRows, error: quizzesError }] = await Promise.all([
    projectPromise,
    quizPromise,
  ])

  if (projectsError || quizzesError || !projectRows || !quizRows) {
    return null
  }

  const quizIds = quizRows.map((quiz) => quiz.id)
  if (!quizIds.length) {
    return normalizeProjects(projectRows as ProjectRow[], [], [], [])
  }

  const [{ data: configRows, error: configsError }, { data: domainRows, error: domainsError }] = await Promise.all([
    supabase
      .from('quiz_configs')
      .select('quiz_id,theme_json,lead_steps_json,transition_screen_json,thank_you_screen_json,result_content_json,variants_json,workflow_json,builder_design_json')
      .in('quiz_id', quizIds),
    supabase.from('quiz_domains').select('quiz_id,hostname').in('quiz_id', quizIds),
  ])

  if (configsError || domainsError) {
    return null
  }

  return normalizeProjects(
    projectRows as ProjectRow[],
    quizRows as QuizRow[],
    (configRows ?? []) as QuizConfigRow[],
    (domainRows ?? []) as QuizDomainRow[],
  )
}

function saveProjectRegistryLocal(projects: ProjectDefinition[]) {
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(stripBuilderDesignsFromProjects(projects)))
  window.localStorage.setItem(BUILDER_DESIGNS_KEY, JSON.stringify(extractBuilderDesignRegistry(projects)))
}

export function getProjectRegistry(): ProjectDefinition[] {
  const stored = window.localStorage.getItem(PROJECTS_KEY)
  const builderDesigns = readBuilderDesignRegistryLocal()

  if (!stored) {
    return normalizeStoredProjects(mergeProjectsWithBuilderDesignRegistry(defaultProjects, builderDesigns))
  }

  try {
    return normalizeStoredProjects(mergeProjectsWithBuilderDesignRegistry(JSON.parse(stored) as ProjectDefinition[], builderDesigns))
  } catch {
    return normalizeStoredProjects(mergeProjectsWithBuilderDesignRegistry(defaultProjects, builderDesigns))
  }
}

export function getAutomationRegistry(projects: ProjectDefinition[]) {
  const stored = readRecord<Record<string, ProjectAutomation[]>>(AUTOMATIONS_KEY, {})
  const nextRegistry: Record<string, ProjectAutomation[]> = {}

  for (const project of projects) {
    const activeQuiz = getActiveQuiz(project)

    if (!activeQuiz) {
      nextRegistry[project.id] = []
      continue
    }

    const normalized = (stored[project.id] ?? []).map((automation) =>
      project.quizzes.some((quiz) => quiz.id === automation.quizId)
        ? automation
        : {
            ...automation,
            quizId: activeQuiz.id,
            updatedAt: new Date().toISOString(),
          },
    )

    nextRegistry[project.id] = normalized.length ? normalized : buildDefaultProjectAutomations(project.id, activeQuiz)
  }

  return nextRegistry
}

export function saveAutomationRegistry(registry: Record<string, ProjectAutomation[]>) {
  window.localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(registry))
}

export function getProjectAutomationInsights(project: ProjectDefinition, automations: ProjectAutomation[]): AutomationInsights {
  const projectQuizIds = new Set(project.quizzes.map((quiz) => quiz.id))
  const leads = readList<LeadRecord>(LEADS_KEY).filter((lead) => projectQuizIds.has(lead.quizId))

  return {
    totalLeads: leads.length,
    liveAutomations: automations.filter((automation) => automation.status === 'live').length,
    draftAutomations: automations.filter((automation) => automation.status === 'draft').length,
    lastLeadAt: leads[0]?.createdAt,
    triggerCounts: {
      lead_submitted: leads.length,
      result_likely: leads.filter((lead) => lead.resultKey === 'likely').length,
      result_maybe: leads.filter((lead) => lead.resultKey === 'maybe').length,
      result_soft_fail: leads.filter((lead) => lead.resultKey === 'soft-fail').length,
      result_hard_fail: leads.filter((lead) => lead.resultKey === 'hard-fail').length,
    },
  }
}

export async function loadProjectRegistry(options?: { preferLocal?: boolean }) {
  const localProjects = getProjectRegistry()
  const localBuilderDesigns = readBuilderDesignRegistryLocal()

  if (options?.preferLocal && localProjects.length) {
    return localProjects
  }

  const remote = await fetchRemoteRegistry()
  if (remote?.length) {
    const normalizedRemote = normalizeStoredProjects(mergeProjectsWithBuilderDesignRegistry(remote, localBuilderDesigns))
    saveProjectRegistryLocal(normalizedRemote)
    return normalizedRemote
  }

  return localProjects
}

export async function saveProjectRegistry(projects: ProjectDefinition[]) {
  saveProjectRegistryLocal(projects)

  if (!hasSupabaseConfig || !supabase) {
    return
  }

  const projectRows = projects.map((project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    notes: project.notes,
    active_quiz_id: project.activeQuizId,
  }))

  const quizPairs = projects.flatMap((project) => project.quizzes.map((quiz) => ({ project, quiz })))
  const quizRows = quizPairs.map(({ project, quiz }) => ({
    id: quiz.id,
    project_id: project.id,
    name: quiz.name,
    slug: quiz.slug,
    status: quiz.status,
    layout_mode: quiz.layoutMode,
    updated_at: new Date().toISOString(),
  }))

  const configRows = quizPairs.map(({ quiz }) => ({
    quiz_id: quiz.id,
    theme_json: quiz.theme,
    lead_steps_json: quiz.leadSteps,
    transition_screen_json: quiz.transitionScreen,
    thank_you_screen_json: quiz.thankYouScreen,
    result_content_json: quiz.resultContent,
    variants_json: quiz.variants,
    workflow_json: quiz.workflow,
    builder_design_json: quiz.builderDesign ?? null,
    updated_at: new Date().toISOString(),
  }))

  const domainRows = quizPairs
    .filter(({ quiz }) => Boolean(quiz.customDomain))
    .map(({ quiz }) => ({ quiz_id: quiz.id, hostname: quiz.customDomain, is_primary: true }))

  await supabase.from('projects').upsert(projectRows)
  await supabase.from('quizzes').upsert(quizRows)
  await supabase.from('quiz_configs').upsert(configRows)

  const quizIds = quizPairs.map(({ quiz }) => quiz.id)
  if (quizIds.length) {
    await supabase.from('quiz_domains').delete().in('quiz_id', quizIds)
    if (domainRows.length) {
      await supabase.from('quiz_domains').insert(domainRows)
    }
  }
}

export function getSelectedProject(projectId: string) {
  return getProjectById(getProjectRegistry(), projectId)
}

export function getSelectedQuiz(projectId: string) {
  return getActiveQuiz(getSelectedProject(projectId))
}

function resolveQuizContextLocal(slug?: string) {
  const projects = getProjectRegistry()
  const byHost = findQuizByHostname(projects, window.location.hostname)
  if (byHost) {
    return byHost
  }

  const bySlug = findQuizBySlug(projects, slug)
  if (bySlug) {
    return bySlug
  }

  const project = projects[0]
  return { project, quiz: getActiveQuiz(project) }
}

export async function resolveQuizContext(slug?: string) {
  const remote = await fetchRemoteRegistry({ publishedOnly: true })
  if (remote?.length) {
    const localBuilderDesigns = readBuilderDesignRegistryLocal()
    const normalizedRemote = normalizeStoredProjects(mergeProjectsWithBuilderDesignRegistry(remote, localBuilderDesigns))
    saveProjectRegistryLocal(normalizedRemote)

    const byHost = findQuizByHostname(normalizedRemote, window.location.hostname)
    if (byHost) {
      return byHost
    }

    const bySlug = findQuizBySlug(normalizedRemote, slug)
    if (bySlug) {
      return bySlug
    }
  }

  return resolveQuizContextLocal(slug)
}

export async function signInAdmin(email: string, password: string, remember = true) {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPassword = password.trim()
  const localAdmin = getLocalAdminConfig()

  if (localAdmin.isEnabled) {
    const emailMatches = localAdmin.email === normalizedEmail
    const passwordMatches = localAdmin.passwords.includes(normalizedPassword)

    if (!emailMatches || !passwordMatches) {
      throw new Error('Invalid admin credentials.')
    }

    setAdminSession(true, remember)
    return
  }

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error('Email and password are required.')
  }

  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Admin access is not configured. Set VITE_ADMIN_EMAIL and VITE_ADMIN_PASSWORD for local access, or add Supabase credentials for remote auth.')
  }

  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: normalizedPassword })
  if (error) {
    throw error
  }

  setAdminSession(true, remember)
}

export async function restoreAdminSession() {
  if (getLocalAdminConfig().isEnabled) {
    return getAdminSession()
  }

  if (!hasSupabaseConfig || !supabase) {
    setAdminSession(false)
    return false
  }

  const { data } = await supabase.auth.getSession()
  const isUnlocked = Boolean(data.session)
  setAdminSession(isUnlocked)
  return isUnlocked
}

export async function signOutAdmin() {
  if (hasSupabaseConfig && supabase) {
    await supabase.auth.signOut()
  }

  setAdminSession(false)
}

export function assignVariant(quiz: QuizDefinition): VariantKey {
  const totalWeight = quiz.variants.reduce((total, variant) => total + variant.weight, 0)
  const threshold = Math.random() * totalWeight
  let running = 0

  for (const variant of quiz.variants) {
    running += variant.weight
    if (threshold <= running) {
      return variant.id
    }
  }

  return 'variant-a'
}

export async function startSession(input: StartSessionInput): Promise<SessionRecord> {
  const params = new URLSearchParams(window.location.search)
  const session: SessionRecord = {
    id: createId('session'),
    quizId: input.quizId,
    variantId: input.variantId,
    startedAt: new Date().toISOString(),
    landingUrl: window.location.href,
    referrer: document.referrer,
    utmSource: getUtmValue(params, 'utm_source'),
    utmMedium: getUtmValue(params, 'utm_medium'),
    utmCampaign: getUtmValue(params, 'utm_campaign'),
    utmTerm: getUtmValue(params, 'utm_term'),
    utmContent: getUtmValue(params, 'utm_content'),
    deviceType: getDeviceType(),
  }

  const sessions = readList<SessionRecord>(SESSIONS_KEY)
  writeList(SESSIONS_KEY, [...sessions, session])
  await syncSupabase('quiz_sessions', session)
  return session
}

export async function completeSession(sessionId: string) {
  const sessions = readList<SessionRecord>(SESSIONS_KEY)
  const updated = sessions.map((session) =>
    session.id === sessionId ? { ...session, completedAt: new Date().toISOString() } : session,
  )

  writeList(SESSIONS_KEY, updated)
}

export async function trackEvent(event: Omit<SessionEvent, 'id'>) {
  const record: SessionEvent = {
    ...event,
    id: createId('event'),
  }

  const events = readList<SessionEvent>(EVENTS_KEY)
  writeList(EVENTS_KEY, [...events, record])
  await syncSupabase('quiz_events', record)
}

export async function submitLead(input: {
  session: SessionRecord
  answers: SessionAnswers
  lead: LeadPayload
  resultKey: LeadRecord['resultKey']
}) {
  const leadRecord: LeadRecord = {
    id: createId('lead'),
    sessionId: input.session.id,
    quizId: input.session.quizId,
    variantId: input.session.variantId,
    resultKey: input.resultKey,
    firstName: input.lead.firstName,
    phone: input.lead.phone,
    contactMethod: input.lead.contactMethod,
    bestTime: input.lead.bestTime,
    email: input.lead.email,
    consent: input.lead.consent,
    answers: input.answers,
    attribution: {
      landingUrl: input.session.landingUrl,
      referrer: input.session.referrer,
      utmSource: input.session.utmSource,
      utmMedium: input.session.utmMedium,
      utmCampaign: input.session.utmCampaign,
      utmTerm: input.session.utmTerm,
      utmContent: input.session.utmContent,
      deviceType: input.session.deviceType,
    },
    createdAt: new Date().toISOString(),
  }

  const leads = readList<LeadRecord>(LEADS_KEY)
  writeList(LEADS_KEY, [...leads, leadRecord])
  await syncSupabase('leads', leadRecord as unknown as Record<string, unknown>)

  const notificationEmails = (import.meta.env.VITE_NOTIFICATION_EMAILS ?? '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean)

  const webhookUrl = import.meta.env.VITE_WEBHOOK_URL

  if (notificationEmails.length || webhookUrl) {
    const payload = {
      leadId: leadRecord.id,
      name: leadRecord.firstName,
      phone: leadRecord.phone,
      email: leadRecord.email,
      contactMethod: leadRecord.contactMethod,
      bestTime: leadRecord.bestTime,
      resultKey: leadRecord.resultKey,
      answers: leadRecord.answers,
      attribution: leadRecord.attribution,
    }

    if (hasSupabaseConfig) {
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
        })
      } catch {
        // Ignore edge function failures in MVP mode.
      }
    }

    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        // Ignore webhook failures in MVP mode.
      }
    }
  }

  return leadRecord
}

export function getAdminSession() {
  return window.localStorage.getItem(ADMIN_KEY) === 'unlocked' || window.sessionStorage.getItem(ADMIN_KEY) === 'unlocked'
}

export function setAdminSession(isUnlocked: boolean, remember = true) {
  if (isUnlocked) {
    if (remember) {
      window.localStorage.setItem(ADMIN_KEY, 'unlocked')
      window.localStorage.setItem(ADMIN_PERSIST_KEY, 'true')
      window.sessionStorage.removeItem(ADMIN_KEY)
      return
    }

    window.sessionStorage.setItem(ADMIN_KEY, 'unlocked')
    window.localStorage.removeItem(ADMIN_KEY)
    window.localStorage.setItem(ADMIN_PERSIST_KEY, 'false')
  } else {
    window.localStorage.removeItem(ADMIN_KEY)
    window.sessionStorage.removeItem(ADMIN_KEY)
    window.localStorage.removeItem(ADMIN_PERSIST_KEY)
  }
}

export function getAdminRememberPreference() {
  return window.localStorage.getItem(ADMIN_PERSIST_KEY) !== 'false'
}

function getLocalAdminConfig() {
  const email = String(import.meta.env.VITE_ADMIN_EMAIL ?? '').trim().toLowerCase()
  const password = String(import.meta.env.VITE_ADMIN_PASSWORD ?? '').trim()
  const passwords = Array.from(new Set([
    password,
    password.endsWith('.') ? password.slice(0, -1) : '',
  ].filter(Boolean)))

  return {
    email,
    password,
    passwords,
    isEnabled: Boolean(email && passwords.length),
  }
}

function buildDashboardMetrics(
  sessions: SessionRecord[],
  events: SessionEvent[],
  leads: LeadRecord[],
  quiz: QuizDefinition,
): DashboardMetrics {
  const promptLookup = new Map(
    quiz.variants.flatMap((variant) => variant.questions.map((question) => [question.id, question.prompt] as const)),
  )

  const completedSessions = sessions.filter((session) => Boolean(session.completedAt))
  const leadTimes = leads
    .map((lead) => {
      const session = sessions.find((item) => item.id === lead.sessionId)
      if (!session) {
        return 0
      }

      return (new Date(lead.createdAt).getTime() - new Date(session.startedAt).getTime()) / 1000
    })
    .filter((value) => value > 0)

  const questionEvents = events.filter((event) => event.eventName === 'question_viewed')
  const answeredEvents = events.filter((event) => event.eventName === 'question_answered')
  const questionIds = [...new Set(questionEvents.map((event) => event.questionId).filter(Boolean))] as string[]

  const questionStats = questionIds.map((questionId) => {
    const views = questionEvents.filter((event) => event.questionId === questionId)
    const answers = answeredEvents.filter((event) => event.questionId === questionId)
    const avgTimeSeconds = average(
      answers.map((event) => Number(event.timeOnStepMs ?? 0) / 1000).filter((value) => value > 0),
    )
    const dropOffRate = views.length ? Math.max(0, (views.length - answers.length) / views.length) : 0

    return {
      questionId,
      prompt: promptLookup.get(questionId) ?? questionId,
      views: views.length,
      answers: answers.length,
      avgTimeSeconds,
      dropOffRate,
    }
  })

  return {
    sessions: sessions.length,
    leadCount: leads.length,
    completionRate: sessions.length ? completedSessions.length / sessions.length : 0,
    averageLeadTimeSeconds: average(leadTimes),
    resultBreakdown: {
      likely: leads.filter((lead) => lead.resultKey === 'likely').length,
      maybe: leads.filter((lead) => lead.resultKey === 'maybe').length,
      'soft-fail': leads.filter((lead) => lead.resultKey === 'soft-fail').length,
      'hard-fail': leads.filter((lead) => lead.resultKey === 'hard-fail').length,
    },
    questionStats,
    leadsByVariant: {
      'variant-a': leads.filter((lead) => lead.variantId === 'variant-a').length,
      'variant-b': leads.filter((lead) => lead.variantId === 'variant-b').length,
    },
    leadRows: leads,
  }
}

function mapSessionRows(rows: Array<Record<string, unknown>>): SessionRecord[] {
  return rows.map((session) => ({
    id: String(session.id),
    quizId: String(session.quiz_id),
    variantId: session.variant_id as VariantKey,
    startedAt: String(session.started_at),
    completedAt: session.completed_at ? String(session.completed_at) : undefined,
    landingUrl: String(session.landing_url),
    referrer: String(session.referrer ?? ''),
    utmSource: String(session.utm_source ?? ''),
    utmMedium: String(session.utm_medium ?? ''),
    utmCampaign: String(session.utm_campaign ?? ''),
    utmTerm: String(session.utm_term ?? ''),
    utmContent: String(session.utm_content ?? ''),
    deviceType: (session.device_type as 'mobile' | 'desktop') ?? 'mobile',
  }))
}

function mapEventRows(rows: Array<Record<string, unknown>>): SessionEvent[] {
  return rows.map((event) => ({
    id: String(event.id),
    sessionId: String(event.session_id),
    quizId: String(event.quiz_id),
    variantId: event.variant_id as VariantKey,
    eventName: String(event.event_name),
    stepKey: String(event.step_key),
    questionId: event.question_id ? String(event.question_id) : undefined,
    answerValue: (event.answer_value ?? undefined) as string | string[] | undefined,
    occurredAt: String(event.occurred_at),
    timeFromStartMs: Number(event.time_from_start_ms ?? 0),
    timeOnStepMs: event.time_on_step_ms ? Number(event.time_on_step_ms) : undefined,
    metadata: (event.metadata ?? {}) as Record<string, unknown>,
  }))
}

function mapLeadRows(rows: Array<Record<string, unknown>>): LeadRecord[] {
  return rows.map((lead) => ({
    id: String(lead.id),
    sessionId: String(lead.session_id),
    quizId: String(lead.quiz_id),
    variantId: lead.variant_id as VariantKey,
    resultKey: lead.result_key as LeadRecord['resultKey'],
    firstName: String(lead.first_name),
    phone: String(lead.phone),
    contactMethod: String(lead.contact_method),
    bestTime: String(lead.best_time),
    email: String(lead.email ?? ''),
    consent: Boolean(lead.consent),
    answers: (lead.answers_json ?? {}) as SessionAnswers,
    attribution: (lead.attribution_json ?? {}) as LeadRecord['attribution'],
    createdAt: String(lead.created_at),
  }))
}

export function getDashboardMetricsForQuiz(quiz: QuizDefinition): DashboardMetrics {
  const sessions = readList<SessionRecord>(SESSIONS_KEY).filter((session) => session.quizId === quiz.id)
  const events = readList<SessionEvent>(EVENTS_KEY).filter((event) => event.quizId === quiz.id)
  const leads = readList<LeadRecord>(LEADS_KEY).filter((lead) => lead.quizId === quiz.id)
  return buildDashboardMetrics(sessions, events, leads, quiz)
}

export async function fetchRemoteDashboardMetrics(quiz: QuizDefinition): Promise<DashboardMetrics> {
  if (!hasSupabaseConfig || !supabase) {
    return getDashboardMetricsForQuiz(quiz)
  }

  const [{ data: sessions, error: sessionsError }, { data: events, error: eventsError }, { data: leads, error: leadsError }] =
    await Promise.all([
      supabase.from('quiz_sessions').select('*').eq('quiz_id', quiz.id).order('started_at', { ascending: false }),
      supabase.from('quiz_events').select('*').eq('quiz_id', quiz.id).order('occurred_at', { ascending: false }),
      supabase.from('leads').select('*').eq('quiz_id', quiz.id).order('created_at', { ascending: false }),
    ])

  if (sessionsError || eventsError || leadsError) {
    throw new Error('Unable to load dashboard data.')
  }

  return buildDashboardMetrics(
    mapSessionRows((sessions ?? []) as Array<Record<string, unknown>>),
    mapEventRows((events ?? []) as Array<Record<string, unknown>>),
    mapLeadRows((leads ?? []) as Array<Record<string, unknown>>),
    quiz,
  )
}

export function exportLeadsCsv(quiz: QuizDefinition) {
  const leads = readList<LeadRecord>(LEADS_KEY).filter((lead) => lead.quizId === quiz.id)
  const headers = [
    'createdAt',
    'variantId',
    'resultKey',
    'firstName',
    'phone',
    'contactMethod',
    'bestTime',
    'email',
    'utmSource',
    'utmMedium',
    'utmCampaign',
  ]

  const lines = [headers.join(',')]

  for (const lead of leads) {
    lines.push(
      [
        lead.createdAt,
        lead.variantId,
        lead.resultKey,
        lead.firstName,
        lead.phone,
        lead.contactMethod,
        lead.bestTime,
        lead.email,
        lead.attribution.utmSource,
        lead.attribution.utmMedium,
        lead.attribution.utmCampaign,
      ]
        .map(csvEscape)
        .join(','),
    )
  }

  return lines.join('\n')
}
