import type {
  LeadStep,
  ProjectDefinition,
  Question,
  QuizBuilderDesign,
  QuizDefinition,
  QuizWorkflow,
  QuizWorkflowEdge,
  QuizWorkflowNode,
  QuizTheme,
  QuizVariant,
  ResultContent,
  ResultEffect,
  ResultKey,
  SingleChoiceOption,
} from '../lib/types'
import { createId } from '../lib/utils'

const RESULT_KEYS: ResultKey[] = ['likely', 'maybe', 'soft-fail', 'hard-fail']

function createDefaultBuilderDesign(): QuizBuilderDesign {
  return {
    activeThemeId: 'theme-default',
    themes: [
      {
        id: 'theme-default',
        name: 'My new theme',
        source: 'mine',
        preview: 'linear-gradient(180deg, #d8d2cc 0%, #d8d2cc 100%)',
        fontFamily: 'var(--font-sans)',
        textColor: '#f4f6f8',
        titleSize: 'md',
        titleAlign: 'left',
        questionSize: 'md',
        questionAlign: 'left',
        contentOffsetX: -28,
        buttonColor: '#4a3f4e',
        buttonTextColor: '#ffffff',
        answerColor: 'rgba(255,255,255,0.14)',
        cornerRadius: 'soft',
        backgroundColor: '#d8d2cc',
        backgroundImage: '',
        backgroundBrightness: 0,
        logoImage: '',
        logoAlt: '',
        logoSize: 128,
        logoAlign: 'left',
      },
    ],
  }
}

const sharedLeadSteps: LeadStep[] = [
  { id: 'first-name', label: 'What is your first name?', helper: 'This helps personalise your review.', kind: 'text', required: true, placeholder: 'First name', cta: 'Continue' },
  { id: 'phone', label: 'What is the best number to reach you on?', helper: 'This is only used for this eligibility check.', kind: 'phone', required: true, placeholder: 'Phone number', cta: 'Continue' },
  { id: 'contact-method', label: 'How would you prefer to be contacted?', helper: 'Choose what suits you best.', kind: 'single', required: true, cta: 'Continue', options: ['Phone call', 'SMS', 'WhatsApp'], autoAdvance: true },
  { id: 'best-time', label: 'What is the best time to contact you?', helper: 'We will use this as your preferred contact window.', kind: 'single', required: true, cta: 'Continue', options: ['Morning', 'Afternoon', 'Evening'], autoAdvance: true },
  { id: 'email', label: 'What is your email address?', helper: 'Optional, in case updates need to be sent.', kind: 'email', required: false, placeholder: 'Email address', cta: 'Continue' },
]

const sharedResultContent: Record<ResultKey, ResultContent> = {
  likely: { title: 'You may be eligible to claim', body: 'Based on your answers, this may be worth reviewing.', primaryCta: 'Continue', trustPoints: ['Takes around 2 minutes to finish', 'Confidential', 'No obligation'] },
  maybe: { title: 'Your answers may still be worth reviewing', body: 'Some answers are less clear, but this may still be worth checking properly.', primaryCta: 'Continue', secondaryCta: 'Review my answers' },
  'soft-fail': { title: 'This may fall outside the main criteria', body: 'One or more of your answers may affect whether this applies to you.', primaryCta: 'Continue anyway', secondaryCta: 'Review my answers', trustPoints: ['If you are unsure, a quick review may still help clarify things.'] },
  'hard-fail': { title: 'This check may not apply based on your answer', body: 'This route is only for people who served in the UK Armed Forces.', primaryCta: 'Change my answer', secondaryCta: 'Start again' },
}

export const militaryTheme: QuizTheme = {
  pageBackground: '#121212',
  surface: '#191919',
  surfaceMuted: '#212121',
  surfaceStrong: '#0f0f0f',
  border: 'rgba(255,255,255,0.08)',
  text: '#f6f4ef',
  textMuted: '#b7b2a8',
  accent: '#ff8f1f',
  accentStrong: '#ffb15c',
  primaryButton: '#4a4d50',
  primaryButtonText: '#ffffff',
  secondaryButton: '#2b2e31',
  secondaryButtonText: '#f6f4ef',
  selectedButton: '#3b2718',
  selectedBorder: '#ff8f1f',
  progressTrack: '#2d2d2d',
  progressFill: '#ff8f1f',
  radius: 28,
  desktopMaxWidth: 880,
  mobileMaxWidth: 390,
}

export const operatorTheme: QuizTheme = {
  pageBackground: '#171717',
  surface: '#1d1d1d',
  surfaceMuted: '#232323',
  surfaceStrong: '#101010',
  border: 'rgba(255,255,255,0.08)',
  text: '#f2f2f2',
  textMuted: '#a9a9a9',
  accent: '#ff8514',
  accentStrong: '#ffab59',
  primaryButton: '#474b4f',
  primaryButtonText: '#ffffff',
  secondaryButton: '#2e3134',
  secondaryButtonText: '#f2f2f2',
  selectedButton: '#342314',
  selectedBorder: '#ff8514',
  progressTrack: '#2d3135',
  progressFill: '#ff8514',
  radius: 26,
  desktopMaxWidth: 900,
  mobileMaxWidth: 390,
}

function cloneObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createWorkflowNode(overrides: Omit<QuizWorkflowNode, 'id'> & { id?: string }): QuizWorkflowNode {
  return {
    id: overrides.id ?? createId('workflow-node'),
    ...overrides,
  }
}

function createWorkflowEdge(
  source: string,
  target: string,
  label?: string,
  rule: QuizWorkflowEdge['rule'] = { kind: 'always' },
): QuizWorkflowEdge {
  return {
    id: createId('workflow-edge'),
    source,
    target,
    label,
    rule,
  }
}

export function buildQuizWorkflow(quiz: Pick<QuizDefinition, 'variants' | 'leadSteps' | 'resultContent' | 'transitionScreen' | 'thankYouScreen'>): QuizWorkflow {
  const nodes: QuizWorkflowNode[] = []
  const edges: QuizWorkflowEdge[] = []
  const laneSpacing = 256
  const rowSpacing = 132
  const resultBaseX = 360 + quiz.variants.length * laneSpacing

  const resultNodes = (Object.keys(quiz.resultContent) as ResultKey[]).map((resultKey, index) => {
    const node = createWorkflowNode({
      type: 'result',
      title: quiz.resultContent[resultKey].title,
      resultKey,
      position: { x: resultBaseX, y: 160 + index * rowSpacing },
    })
    nodes.push(node)
    return [resultKey, node] as const
  })

  const transitionNode = createWorkflowNode({
    type: 'transition',
    title: quiz.transitionScreen.heading,
    position: { x: resultBaseX + laneSpacing, y: 226 },
  })
  nodes.push(transitionNode)

  let previousLeadNodeId = transitionNode.id
  quiz.leadSteps.forEach((step, leadIndex) => {
    const leadNode = createWorkflowNode({
      type: 'lead',
      title: step.label,
      leadStepId: step.id,
      position: { x: resultBaseX + laneSpacing * 2, y: 120 + leadIndex * rowSpacing },
    })
    nodes.push(leadNode)
    edges.push(createWorkflowEdge(previousLeadNodeId, leadNode.id, leadIndex === 0 ? quiz.transitionScreen.cta : step.cta))
    previousLeadNodeId = leadNode.id
  })

  const thankYouNode = createWorkflowNode({
    type: 'thank-you',
    title: quiz.thankYouScreen.heading,
    position: { x: resultBaseX + laneSpacing * 3, y: 226 },
  })
  nodes.push(thankYouNode)
  edges.push(createWorkflowEdge(previousLeadNodeId, thankYouNode.id, 'Submit'))

  const introNodes = quiz.variants.map((variant, index) => {
    if (variant.introHidden) {
      return { variant, node: null }
    }

    const node = createWorkflowNode({
      type: 'intro',
      title: `${variant.name} intro`,
      variantId: variant.id,
      position: { x: 40 + index * laneSpacing, y: 48 },
    })
    nodes.push(node)
    return { variant, node }
  })

  introNodes.forEach(({ variant, node }, variantIndex) => {
    let previousNodeId = node?.id ?? null

    variant.questions.forEach((question, questionIndex) => {
      const questionNode = createWorkflowNode({
        type: 'question',
        title: question.prompt,
        variantId: variant.id,
        questionId: question.id,
        position: { x: 40 + variantIndex * laneSpacing, y: 160 + questionIndex * rowSpacing },
      })
      nodes.push(questionNode)
      if (previousNodeId) {
        edges.push(createWorkflowEdge(previousNodeId, questionNode.id, questionIndex === 0 ? 'Start' : 'Next'))
      }
      previousNodeId = questionNode.id
    })

    if (!previousNodeId) {
      return
    }

    const sourceNodeId = previousNodeId

    resultNodes.forEach(([resultKey, resultNode]) => {
      edges.push(createWorkflowEdge(sourceNodeId, resultNode.id, resultKey, { kind: 'result', resultKey }))
      if (resultKey !== 'hard-fail') {
        edges.push(createWorkflowEdge(resultNode.id, transitionNode.id, 'Continue'))
      }
    })
  })

  return {
    startNodeId: introNodes.find((entry) => entry.node)?.node?.id
      ?? nodes.find((node) => node.type === 'question')?.id
      ?? nodes[0]?.id
      ?? createId('workflow-node'),
    nodes,
    edges,
  }
}

export function ensureQuizWorkflow(quiz: QuizDefinition): QuizDefinition {
  const nextQuiz = quiz.workflow?.nodes?.length
    ? quiz
    : {
        ...quiz,
        workflow: buildQuizWorkflow(quiz),
      }

  if (!nextQuiz.builderDesign?.themes?.length) {
    return {
      ...nextQuiz,
      builderDesign: createDefaultBuilderDesign(),
    }
  }

  const normalizedThemes = nextQuiz.builderDesign.themes.map((theme) => ({
    ...theme,
    source: 'mine' as const,
  }))
  const fallbackThemeId = normalizedThemes[0]?.id ?? 'theme-default'

  return {
    ...nextQuiz,
    builderDesign: {
      activeThemeId: normalizedThemes.some((theme) => theme.id === nextQuiz.builderDesign?.activeThemeId)
        ? nextQuiz.builderDesign.activeThemeId
        : fallbackThemeId,
      themes: normalizedThemes,
    },
  }
}

export function normalizeProjectDefinitions(projects: ProjectDefinition[]): ProjectDefinition[] {
  return projects.map((project) => ({
    ...project,
    quizzes: project.quizzes.map((quiz) => ensureQuizWorkflow(quiz as QuizDefinition)),
  }))
}

function buildResultContent(overrides?: Partial<Record<ResultKey, Partial<ResultContent>>>) {
  const nextResultContent = cloneObject(sharedResultContent)
  for (const key of RESULT_KEYS) {
    if (overrides?.[key]) {
      nextResultContent[key] = { ...nextResultContent[key], ...overrides[key] }
    }
  }
  return nextResultContent
}

export function createQuestionOption(label = 'New option', result: ResultEffect = 'neutral'): SingleChoiceOption {
  return { id: createId('option'), label, result }
}

export function createQuestion(kind: Question['kind'] = 'single', prompt = 'New question'): Question {
  return {
    id: createId('question'),
    kind,
    prompt,
    helper: '',
    builderElementKey: kind === 'multi' ? 'checkbox' : 'multiple-choice',
    options: [createQuestionOption('Option 1'), createQuestionOption('Option 2')],
  }
}

export function createLeadStep(kind: LeadStep['kind'] = 'text'): LeadStep {
  return {
    id: createId('lead-step'),
    label: 'New lead step',
    helper: '',
    kind,
    builderElementKey: kind === 'email' ? 'email' : kind === 'phone' ? 'phone-number' : kind === 'single' ? 'multiple-choice' : 'short-text',
    required: true,
    placeholder: kind === 'single' ? undefined : 'Type here',
    cta: 'Continue',
    options: kind === 'single' ? ['Option 1', 'Option 2'] : undefined,
    autoAdvance: kind === 'single',
  }
}

export function createQuizVariant(overrides: Partial<QuizVariant> = {}): QuizVariant {
  return {
    id: createId('variant'),
    name: 'New Variant',
    description: 'Add an alternate question path for testing.',
    weight: 50,
    introHidden: false,
    intro: { heading: 'Check your eligibility', subcopy: 'A short review to see what route fits best.', trustPoints: ['Fast review', 'Confidential', 'No obligation'], cta: 'Start' },
    questions: [createQuestion('single')],
    ...overrides,
  }
}

export function createQuizDefinition(overrides: Partial<QuizDefinition> = {}): QuizDefinition {
  const baseQuiz: QuizDefinition = {
    id: createId('quiz'),
    name: 'New Quiz',
    slug: `quiz-${Date.now()}`,
    status: 'draft',
    layoutMode: 'standalone',
    customDomain: '',
    theme: cloneObject(operatorTheme),
    leadSteps: cloneObject(sharedLeadSteps),
    transitionScreen: { heading: 'Thanks, that gives us a clearer picture', body: 'A few final details will help with the next step.', trustPoints: ['Confidential', 'Used only for this eligibility check', 'No obligation'], cta: 'Continue' },
    thankYouScreen: { heading: 'Thank you. Your check has been received.', body: 'Your details have been recorded. If appropriate, someone may contact you after review.', primaryCta: 'Request a callback', secondaryCta: 'Schedule a time instead' },
    resultContent: buildResultContent(),
    variants: [createQuizVariant({ name: 'Variant A', id: 'variant-a' }), createQuizVariant({ name: 'Variant B', id: 'variant-b' })],
    workflow: { startNodeId: '', nodes: [], edges: [] },
    builderDesign: createDefaultBuilderDesign(),
    ...overrides,
  }

  return ensureQuizWorkflow(baseQuiz)
}

export function createProjectDefinition(overrides: Partial<ProjectDefinition> = {}): ProjectDefinition {
  const firstQuiz = overrides.quizzes?.[0] ?? createQuizDefinition()
  return { id: createId('project'), name: 'New Project', slug: `project-${Date.now()}`, notes: 'Campaign workspace.', activeQuizId: firstQuiz.id, quizzes: [firstQuiz], ...overrides }
}

const variantA: QuizVariant = {
  id: 'variant-a',
  name: 'Variant A',
  description: 'Ultra-minimal four-step filter for fast cold-traffic conversion.',
  weight: 70,
  intro: { heading: 'Hearing worse after service?', subcopy: 'Check if your case may be worth reviewing.', trustPoints: ['Takes around 2 minutes', 'Confidential', 'No obligation'], cta: 'Start check' },
  questions: [
    { id: 'service-check', kind: 'single', prompt: 'Did you serve in the UK Armed Forces?', options: [{ id: 'yes', label: 'Yes', result: 'likely' }, { id: 'no', label: 'No', result: 'hard-fail' }] },
    { id: 'served-after-date', kind: 'single', prompt: 'Did you serve after 15 May 1987?', options: [{ id: 'yes', label: 'Yes', result: 'likely' }, { id: 'not-sure', label: 'Not sure', result: 'maybe' }, { id: 'no', label: 'No', result: 'soft-fail' }] },
    { id: 'noise-exposure', kind: 'single', prompt: 'Were you exposed to loud noise during service?', options: [{ id: 'yes', label: 'Yes', result: 'likely' }, { id: 'not-sure', label: 'Not sure', result: 'maybe' }, { id: 'no', label: 'No', result: 'soft-fail' }] },
    { id: 'hearing-worsened', kind: 'single', prompt: 'Has your hearing worsened since your service?', options: [{ id: 'yes', label: 'Yes', result: 'likely' }, { id: 'not-sure', label: 'Not sure', result: 'maybe' }, { id: 'no', label: 'No', result: 'soft-fail' }] },
  ],
}

const variantB: QuizVariant = {
  id: 'variant-b',
  name: 'Variant B',
  description: 'Expanded six-step qualification flow for stronger signal before lead capture.',
  weight: 30,
  intro: { heading: 'Hearing worse after service?', subcopy: 'Check if your case may be worth reviewing.', trustPoints: ['Takes around 2 minutes', 'Confidential', 'No obligation'], cta: 'Start check' },
  questions: [
    { id: 'service-branch', kind: 'single', prompt: 'Which UK service did you serve in?', options: [{ id: 'royal-navy', label: 'Royal Navy', result: 'likely' }, { id: 'british-army', label: 'British Army', result: 'likely' }, { id: 'royal-air-force', label: 'Royal Air Force', result: 'likely' }, { id: 'royal-marines', label: 'Royal Marines', result: 'likely' }, { id: 'not-uk-service', label: 'I did not serve in the UK Armed Forces', result: 'hard-fail' }] },
    { id: 'served-after-date', kind: 'single', prompt: 'Did you serve after 15 May 1987?', helper: 'If you are unsure, choose Not sure.', options: [{ id: 'yes', label: 'Yes', result: 'likely' }, { id: 'no', label: 'No', result: 'soft-fail' }, { id: 'not-sure', label: 'Not sure', result: 'maybe' }] },
    { id: 'noise-exposure-detailed', kind: 'multi', prompt: 'Were you regularly around loud noise during service?', helper: 'Choose all that apply.', options: [{ id: 'weapons', label: 'Weapons training or live firing', result: 'likely' }, { id: 'artillery', label: 'Artillery or armoured vehicles', result: 'likely' }, { id: 'aircraft', label: 'Aircraft or helicopters', result: 'likely' }, { id: 'machinery', label: 'Engine rooms or heavy machinery', result: 'likely' }, { id: 'ceremonial', label: 'Ceremonial gunfire or parades', result: 'maybe' }, { id: 'other', label: 'Other repeated loud noise', result: 'maybe' }, { id: 'none', label: 'None of these', result: 'soft-fail' }] },
    { id: 'symptoms', kind: 'multi', prompt: 'Are you dealing with any of these now?', helper: 'Choose all that apply.', options: [{ id: 'ringing', label: 'Ringing in the ears', result: 'likely' }, { id: 'conversations', label: 'Difficulty following conversations', result: 'likely' }, { id: 'tv-louder', label: 'Turning the TV up louder than others', result: 'maybe' }, { id: 'noisy-places', label: 'Struggling in noisy places', result: 'maybe' }, { id: 'muffled', label: 'Muffled hearing', result: 'maybe' }, { id: 'none', label: 'None of these', result: 'soft-fail' }] },
    { id: 'hearing-worsened', kind: 'single', prompt: 'Did your hearing get worse during or after service?', options: [{ id: 'yes', label: 'Yes', result: 'likely' }, { id: 'no', label: 'No', result: 'soft-fail' }, { id: 'not-sure', label: 'Not sure', result: 'maybe' }] },
    { id: 'previous-claim', kind: 'single', prompt: 'Have you already made a hearing loss claim before?', options: [{ id: 'yes', label: 'Yes', result: 'soft-fail' }, { id: 'no', label: 'No', result: 'likely' }, { id: 'not-sure', label: 'Not sure', result: 'maybe' }] },
  ],
}

function createMilitaryQuiz(overrides: Partial<QuizDefinition> = {}): QuizDefinition {
  return createQuizDefinition({
    id: 'military-hearing-check',
    name: 'Military Hearing Check',
    slug: 'military-hearing-check',
    status: 'published',
    layoutMode: 'standalone',
    customDomain: '',
    theme: cloneObject(militaryTheme),
    leadSteps: cloneObject(sharedLeadSteps),
    transitionScreen: { heading: 'Thanks, that gives us a clearer picture', body: 'A few final details will help with the next step.', trustPoints: ['Confidential', 'Used only for this eligibility check', 'No obligation'], cta: 'Continue' },
    thankYouScreen: { heading: 'Thank you. Your check has been received.', body: 'Your details have been recorded. If appropriate, someone may contact you after review.', primaryCta: 'Request a callback', secondaryCta: 'Schedule a time instead' },
    resultContent: buildResultContent(),
    variants: [cloneObject(variantA), cloneObject(variantB)],
    ...overrides,
  })
}

export const defaultProjects: ProjectDefinition[] = normalizeProjectDefinitions([
  {
    id: 'project-military-claims',
    name: 'Military Claims',
    slug: 'military-claims',
    notes: 'Primary workspace containing the two live builder test forms.',
    activeQuizId: 'form-neptunys',
    quizzes: [
      createMilitaryQuiz({
        id: 'form-neptunys',
        name: 'Neptunys',
        slug: 'neptunys',
        theme: cloneObject(operatorTheme),
        customDomain: 'claims.neptunys.com',
      }),
      createMilitaryQuiz({
        id: 'form-military',
        name: 'Military',
        slug: 'military',
        theme: cloneObject(militaryTheme),
        customDomain: '',
      }),
    ],
  },
])

export function getProjectById(projects: ProjectDefinition[], projectId: string) {
  return projects.find((project) => project.id === projectId) ?? projects[0]
}

export function getActiveQuiz(project: ProjectDefinition) {
  return project.quizzes.find((quiz) => quiz.id === project.activeQuizId) ?? project.quizzes[0]
}

export function findQuizBySlug(projects: ProjectDefinition[], slug?: string) {
  for (const project of projects) {
    const quiz = project.quizzes.find((item) => item.slug === slug)
    if (quiz) {
      return { project, quiz }
    }
  }
  return null
}

export function findQuizByHostname(projects: ProjectDefinition[], hostname: string) {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return null
  }
  for (const project of projects) {
    const quiz = project.quizzes.find((item) => item.customDomain && item.customDomain === hostname)
    if (quiz) {
      return { project, quiz }
    }
  }
  return null
}
