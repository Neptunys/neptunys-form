export type VariantKey = string
export type ResultKey = 'likely' | 'maybe' | 'soft-fail' | 'hard-fail'
export type ResultEffect = ResultKey | 'neutral'

export type ButtonTone = 'primary' | 'secondary' | 'selected'

export type SingleChoiceOption = {
  id: string
  label: string
  helper?: string
  result?: ResultEffect
}

export type MultiChoiceOption = SingleChoiceOption

export type QuestionBase = {
  id: string
  prompt: string
  helper?: string
  builderElementKey?: string
}

export type SingleChoiceQuestion = QuestionBase & {
  kind: 'single'
  options: SingleChoiceOption[]
}

export type MultiChoiceQuestion = QuestionBase & {
  kind: 'multi'
  options: MultiChoiceOption[]
}

export type Question = SingleChoiceQuestion | MultiChoiceQuestion

export type IntroScreen = {
  heading: string
  subcopy: string
  trustPoints: string[]
  cta: string
}

export type ResultContent = {
  title: string
  body: string
  primaryCta: string
  secondaryCta?: string
  trustPoints?: string[]
}

export type LeadStep = {
  id: string
  label: string
  helper?: string
  kind: 'text' | 'phone' | 'email' | 'single'
  builderElementKey?: string
  required: boolean
  placeholder?: string
  cta: string
  options?: string[]
  autoAdvance?: boolean
}

export type QuizVariant = {
  id: VariantKey
  name: string
  description: string
  weight: number
  introHidden?: boolean
  intro: IntroScreen
  questions: Question[]
}

export type QuizTheme = {
  pageBackground: string
  surface: string
  surfaceMuted: string
  surfaceStrong: string
  border: string
  text: string
  textMuted: string
  accent: string
  accentStrong: string
  primaryButton: string
  primaryButtonText: string
  secondaryButton: string
  secondaryButtonText: string
  selectedButton: string
  selectedBorder: string
  progressTrack: string
  progressFill: string
  radius: number
  desktopMaxWidth: number
  mobileMaxWidth: number
}

export type QuizBuilderTheme = {
  id: string
  name: string
  source: 'mine'
  preview: string
  fontFamily: string
  textColor: string
  titleSize: 'sm' | 'md' | 'lg'
  titleAlign: 'left' | 'center' | 'right'
  questionSize: 'sm' | 'md' | 'lg'
  questionAlign: 'left' | 'center' | 'right'
  contentOffsetX: number
  buttonColor: string
  buttonBorderColor: string
  buttonTextColor: string
  answerColor: string
  answerBorderColor: string
  answerTextColor: string
  cornerRadius: 'none' | 'soft' | 'pill'
  backgroundColor: string
  backgroundImage: string
  backgroundImageThumb?: string
  backgroundBrightness: number
  logoImage: string
  logoAlt: string
  logoSize: number
  logoAlign: 'left' | 'center' | 'right'
}

export type QuizBuilderDesign = {
  activeThemeId: string
  themes: QuizBuilderTheme[]
}

export type QuizWorkflowNodeType = 'intro' | 'question' | 'transition' | 'lead' | 'result' | 'thank-you'

export type QuizWorkflowNode = {
  id: string
  type: QuizWorkflowNodeType
  title: string
  position: {
    x: number
    y: number
  }
  variantId?: VariantKey
  questionId?: string
  leadStepId?: string
  resultKey?: ResultKey
}

export type QuizWorkflowEdge = {
  id: string
  source: string
  target: string
  label?: string
  rule?: {
    kind: 'always' | 'result' | 'answer'
    resultKey?: ResultKey
    answerValue?: string
  }
}

export type QuizWorkflow = {
  startNodeId: string
  nodes: QuizWorkflowNode[]
  edges: QuizWorkflowEdge[]
}

export type QuizDefinition = {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published'
  layoutMode: 'standalone' | 'embed'
  customDomain?: string
  theme: QuizTheme
  leadSteps: LeadStep[]
  transitionScreen: {
    heading: string
    body: string
    trustPoints: string[]
    cta: string
  }
  thankYouScreen: {
    heading: string
    body: string
    primaryCta: string
    secondaryCta: string
  }
  resultContent: Record<ResultKey, ResultContent>
  variants: QuizVariant[]
  workflow: QuizWorkflow
  builderDesign?: QuizBuilderDesign
}

export type ProjectDefinition = {
  id: string
  name: string
  slug: string
  notes: string
  activeQuizId: string
  quizzes: QuizDefinition[]
}

export type AnswerValue = string | string[]

export type SessionAnswers = Record<string, AnswerValue>

export type LeadPayload = {
  firstName: string
  phone: string
  contactMethod: string
  bestTime: string
  email: string
  consent: boolean
}

export type SessionEvent = {
  id: string
  sessionId: string
  quizId: string
  variantId: VariantKey
  eventName: string
  stepKey: string
  questionId?: string
  answerValue?: string | string[]
  occurredAt: string
  timeFromStartMs: number
  timeOnStepMs?: number
  metadata?: Record<string, unknown>
}

export type SessionRecord = {
  id: string
  quizId: string
  variantId: VariantKey
  startedAt: string
  completedAt?: string
  landingUrl: string
  referrer: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmTerm: string
  utmContent: string
  deviceType: 'mobile' | 'desktop'
}

export type LeadRecord = {
  id: string
  sessionId: string
  quizId: string
  variantId: VariantKey
  resultKey: ResultKey
  firstName: string
  phone: string
  contactMethod: string
  bestTime: string
  email: string
  consent: boolean
  answers: SessionAnswers
  attribution: Omit<SessionRecord, 'id' | 'quizId' | 'variantId' | 'startedAt' | 'completedAt'>
  createdAt: string
}

export type DashboardMetrics = {
  sessions: number
  leadCount: number
  completionRate: number
  averageLeadTimeSeconds: number
  resultBreakdown: Record<ResultKey, number>
  questionStats: Array<{
    questionId: string
    prompt: string
    views: number
    answers: number
    avgTimeSeconds: number
    dropOffRate: number
  }>
  leadsByVariant: Record<VariantKey, number>
  leadRows: LeadRecord[]
}

export type AutomationTriggerKind =
  | 'lead_submitted'
  | 'result_likely'
  | 'result_maybe'
  | 'result_soft_fail'
  | 'result_hard_fail'

export type AutomationNodeType = 'trigger' | 'condition' | 'action'

export type AutomationNodeTone = 'default' | 'success' | 'warning'

export type AutomationNode = {
  id: string
  type: AutomationNodeType
  title: string
  body: string
  position: {
    x: number
    y: number
  }
  tone?: AutomationNodeTone
}

export type AutomationEdge = {
  id: string
  source: string
  target: string
  label?: string
}

export type ProjectAutomation = {
  id: string
  projectId: string
  quizId: string
  name: string
  description: string
  status: 'draft' | 'live'
  trigger: AutomationTriggerKind
  nodes: AutomationNode[]
  edges: AutomationEdge[]
  updatedAt: string
}

export type AutomationInsights = {
  totalLeads: number
  liveAutomations: number
  draftAutomations: number
  lastLeadAt?: string
  triggerCounts: Record<AutomationTriggerKind, number>
}
