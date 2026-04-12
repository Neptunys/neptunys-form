import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { ProgressBar } from '../../components/ProgressBar'
import { evaluateResult } from '../../lib/resultLogic'
import { assignVariant, completeSession, resolveQuizContext, startSession, submitLead, trackEvent } from '../../lib/storage'
import { useSharedControlWidth } from '../../lib/useSharedControlWidth'
import type { LeadPayload, ProjectDefinition, Question, QuizDefinition, QuizWorkflowEdge, QuizWorkflowNode, ResultKey, SessionAnswers, SessionRecord, VariantKey } from '../../lib/types'

const MICRO_MESSAGES = [
  'This only takes around 2 minutes.',
  'You are making good progress.',
  'Just a couple of quick checks left.',
]

type Phase = 'intro' | 'question' | 'result' | 'transition' | 'lead' | 'consent' | 'thank-you'

const initialLeadState: LeadPayload = {
  firstName: '',
  phone: '',
  contactMethod: '',
  bestTime: '',
  email: '',
  consent: false,
}

function getSelectedVariant(
  searchParams: URLSearchParams,
  availableVariantIds: string[],
  variantPicker: () => VariantKey,
): VariantKey {
  const requestedVariant = searchParams.get('variant')
  if (requestedVariant && availableVariantIds.includes(requestedVariant)) {
    return requestedVariant
  }
  return variantPicker()
}

function getStepProgress(variantQuestionCount: number, leadStepCount: number, questionIndex: number, phase: Phase, leadIndex: number) {
  const totalSteps = variantQuestionCount + 1 + leadStepCount + 1

  if (phase === 'intro') {
    return 2
  }

  if (phase === 'question') {
    return ((questionIndex + 1) / totalSteps) * 100
  }

  if (phase === 'result') {
    return ((variantQuestionCount + 0.5) / totalSteps) * 100
  }

  if (phase === 'transition') {
    return ((variantQuestionCount + 1) / totalSteps) * 100
  }

  if (phase === 'lead') {
    return ((variantQuestionCount + 1 + leadIndex + 1) / totalSteps) * 100
  }

  if (phase === 'consent') {
    return 95
  }

  return 100
}

function validateLeadStep(stepId: string, value: string) {
  if (stepId === 'first-name') {
    return value.trim().length >= 2
  }

  if (stepId === 'phone') {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 8
  }

  if (stepId === 'email') {
    return !value || /.+@.+\..+/.test(value)
  }

  return Boolean(value)
}

function getPhaseFromNode(node: QuizWorkflowNode | null): Phase {
  if (!node) {
    return 'intro'
  }

  if (node.type === 'intro') {
    return 'intro'
  }

  if (node.type === 'question') {
    return 'question'
  }

  if (node.type === 'result') {
    return 'result'
  }

  if (node.type === 'transition') {
    return 'transition'
  }

  if (node.type === 'lead') {
    return 'lead'
  }

  return 'thank-you'
}

function edgeMatchesRule(
  edge: QuizWorkflowEdge,
  context: {
    answerValue?: string | string[]
    resultKey?: ResultKey
  },
) {
  const rule = edge.rule ?? { kind: 'always' as const }

  if (rule.kind === 'result') {
    return Boolean(rule.resultKey && context.resultKey === rule.resultKey)
  }

  if (rule.kind === 'answer') {
    if (!rule.answerValue) {
      return false
    }

    if (Array.isArray(context.answerValue)) {
      return context.answerValue.includes(rule.answerValue)
    }

    return context.answerValue === rule.answerValue
  }

  return true
}

export function QuizRunner() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [context, setContext] = useState<{ project: ProjectDefinition; quiz: QuizDefinition } | null>(null)
  const [variantId, setVariantId] = useState<VariantKey>('variant-a')
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentNodeId, setCurrentNodeId] = useState('')
  const [answers, setAnswers] = useState<SessionAnswers>({})
  const [lead, setLead] = useState<LeadPayload>(initialLeadState)
  const [resultKey, setResultKey] = useState<ReturnType<typeof evaluateResult> | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingChoice, setPendingChoice] = useState<{ questionId: string; optionId: string } | null>(null)
  const stepStartedAt = useRef<number>(Date.now())
  const sessionStartedAt = useRef<number>(Date.now())
  const hasBooted = useRef(false)
  const isLiveView = searchParams.get('live') === '1'
  const isPreviewMode = searchParams.get('preview') === '1'
  const previewDevice = searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop'
  const isFramedMode = isLiveView || isPreviewMode
  const shouldTrack = !isPreviewMode
  const project = context?.project
  const quiz = context?.quiz

  useEffect(() => {
    resolveQuizContext(slug).then((nextContext) => {
      setContext(nextContext)
      setVariantId(getSelectedVariant(searchParams, nextContext.quiz.variants.map((variant) => variant.id), () => assignVariant(nextContext.quiz)))
    })
  }, [searchParams, slug])

  const variant = useMemo(
    () => (quiz ? quiz.variants.find((item) => item.id === variantId) ?? quiz.variants[0] : null),
    [quiz, variantId],
  )

  const activeProject = project ?? null
  const activeQuiz = quiz ?? null
  const activeVariant = variant ?? null
  const activeBuilderTheme = useMemo(() => {
    const builderDesign = activeQuiz?.builderDesign
    if (!builderDesign?.themes?.length) {
      return null
    }

    const selectedTheme = builderDesign.themes.find((theme) => theme.id === builderDesign.activeThemeId) ?? builderDesign.themes[0]

    return {
      ...selectedTheme,
      buttonBorderColor: selectedTheme.buttonBorderColor ?? selectedTheme.buttonColor,
      answerBorderColor: selectedTheme.answerBorderColor ?? 'rgba(255,255,255,0.18)',
      answerTextColor: selectedTheme.answerTextColor ?? selectedTheme.textColor,
    }
  }, [activeQuiz])

  const workflowNodeLookup = useMemo(
    () => new Map(activeQuiz?.workflow.nodes.map((node) => [node.id, node]) ?? []),
    [activeQuiz?.workflow.nodes],
  )
  const currentNode = useMemo(
    () => (currentNodeId ? workflowNodeLookup.get(currentNodeId) ?? null : null),
    [currentNodeId, workflowNodeLookup],
  )
  const introNode = useMemo(() => {
    if (!activeQuiz) {
      return null
    }

    const startNode = activeQuiz.workflow.nodes.find((node) => node.id === activeQuiz.workflow.startNodeId) ?? null
    if (startNode && (!startNode.variantId || startNode.variantId === variantId)) {
      return startNode
    }

    return activeQuiz.workflow.nodes.find((node) => node.type === 'intro' && node.variantId === variantId) ?? null
  }, [activeQuiz, variantId])
  const currentQuestion = useMemo(
    () => (currentNode?.type === 'question' && activeVariant ? activeVariant.questions.find((question) => question.id === currentNode.questionId) ?? null : null),
    [activeVariant, currentNode],
  )
  const currentLeadStep = useMemo(
    () => (currentNode?.type === 'lead' && activeQuiz ? activeQuiz.leadSteps.find((step) => step.id === currentNode.leadStepId) ?? null : null),
    [activeQuiz, currentNode],
  )
  const questionIndex = useMemo(
    () => (currentQuestion && activeVariant ? Math.max(0, activeVariant.questions.findIndex((question) => question.id === currentQuestion.id)) : 0),
    [activeVariant, currentQuestion],
  )
  const leadIndex = useMemo(
    () => (currentLeadStep && activeQuiz ? Math.max(0, activeQuiz.leadSteps.findIndex((step) => step.id === currentLeadStep.id)) : 0),
    [activeQuiz, currentLeadStep],
  )
  const outgoingEdges = useMemo(() => {
    if (!activeQuiz || !currentNodeId) {
      return [] as QuizWorkflowEdge[]
    }

    return activeQuiz.workflow.edges.filter((edge) => edge.source === currentNodeId)
  }, [activeQuiz, currentNodeId])

  function resolveNextNode(context: { answerValue?: string | string[]; resultKey?: ResultKey } = {}) {
    const prioritizedEdges = [...outgoingEdges].sort((left, right) => {
      const leftAlways = (left.rule?.kind ?? 'always') === 'always'
      const rightAlways = (right.rule?.kind ?? 'always') === 'always'
      if (leftAlways === rightAlways) {
        return 0
      }
      return leftAlways ? 1 : -1
    })

    const nextEdge = prioritizedEdges.find((edge) => edgeMatchesRule(edge, context))
    return nextEdge ? workflowNodeLookup.get(nextEdge.target) ?? null : null
  }

  useEffect(() => {
    if (!introNode) {
      return
    }

    setCurrentNodeId(introNode.id)
    setPhase(getPhaseFromNode(introNode))
  }, [introNode])

  const progressValue = activeQuiz && activeVariant
    ? getStepProgress(activeVariant.questions.length, activeQuiz.leadSteps.length, questionIndex, phase, leadIndex)
    : 0
  const microMessage =
    phase === 'question'
      ? MICRO_MESSAGES[Math.min(questionIndex, MICRO_MESSAGES.length - 1)]
      : phase === 'lead'
        ? 'Just a few final details left.'
        : 'Built for fast review and clear next steps.'

  const currentSingleChoiceValue = currentQuestion?.kind === 'single'
    ? pendingChoice?.questionId === currentQuestion.id
      ? pendingChoice.optionId
      : typeof answers[currentQuestion.id] === 'string'
        ? answers[currentQuestion.id] as string
        : ''
    : ''

  const canSubmitCurrentQuestion = currentQuestion?.kind === 'multi'
    ? Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length > 0
    : false

  const themeVars = {
    '--quiz-page-bg': activeQuiz?.theme.pageBackground,
    '--quiz-surface': activeQuiz?.theme.surface,
    '--quiz-surface-muted': activeQuiz?.theme.surfaceMuted,
    '--quiz-surface-strong': activeQuiz?.theme.surfaceStrong,
    '--quiz-border': activeQuiz?.theme.border,
    '--quiz-text': activeQuiz?.theme.text,
    '--quiz-text-muted': activeQuiz?.theme.textMuted,
    '--quiz-accent': activeQuiz?.theme.accent,
    '--quiz-accent-strong': activeQuiz?.theme.accentStrong,
    '--quiz-primary-button': activeQuiz?.theme.primaryButton,
    '--quiz-primary-text': activeQuiz?.theme.primaryButtonText,
    '--quiz-secondary-button': activeQuiz?.theme.secondaryButton,
    '--quiz-secondary-text': activeQuiz?.theme.secondaryButtonText,
    '--quiz-selected-button': activeQuiz?.theme.selectedButton,
    '--quiz-selected-border': activeQuiz?.theme.selectedBorder,
    '--quiz-progress-track': activeQuiz?.theme.progressTrack,
    '--quiz-progress-fill': activeQuiz?.theme.progressFill,
    '--quiz-radius': `${activeQuiz?.theme.radius ?? 28}px`,
    '--quiz-max-width': `${previewDevice === 'mobile' ? activeQuiz?.theme.mobileMaxWidth ?? 390 : activeQuiz?.theme.desktopMaxWidth ?? 880}px`,
    '--quiz-builder-button-bg': activeBuilderTheme?.buttonColor,
    '--quiz-builder-button-border': activeBuilderTheme?.buttonBorderColor,
    '--quiz-builder-button-text': activeBuilderTheme?.buttonTextColor,
    '--quiz-builder-answer-bg': activeBuilderTheme?.answerColor,
    '--quiz-builder-answer-border': activeBuilderTheme?.answerBorderColor,
    '--quiz-builder-answer-text': activeBuilderTheme?.answerTextColor,
    '--quiz-control-radius': activeBuilderTheme ? ({ none: '0px', soft: '10px', pill: '999px' }[activeBuilderTheme.cornerRadius]) : undefined,
  } as CSSProperties

  const pageBackgroundOverlayOpacity = Math.max(0.46, Math.min(0.78, 0.32 + Math.max(0, -(activeBuilderTheme?.backgroundBrightness ?? 0)) / 100))
  const pageStyle = {
    ...themeVars,
    backgroundColor: activeBuilderTheme?.backgroundColor ?? activeQuiz?.theme.pageBackground,
    backgroundImage: activeBuilderTheme?.backgroundImage
      ? `linear-gradient(rgba(4, 7, 10, ${pageBackgroundOverlayOpacity}), rgba(4, 7, 10, ${pageBackgroundOverlayOpacity})), url(${activeBuilderTheme.backgroundImage})`
      : undefined,
    backgroundPosition: activeBuilderTheme?.backgroundImage ? 'center' : undefined,
    backgroundSize: activeBuilderTheme?.backgroundImage ? 'cover' : undefined,
    backgroundRepeat: activeBuilderTheme?.backgroundImage ? 'no-repeat' : undefined,
  } as CSSProperties

  useEffect(() => {
    if (!activeQuiz) {
      return
    }

    const resolvedQuiz = activeQuiz

    if (!shouldTrack) {
      return
    }

    if (hasBooted.current) {
      return
    }

    hasBooted.current = true

    async function boot() {
      const nextSession = await startSession({ quizId: resolvedQuiz.id, variantId })
      setSession(nextSession)
      sessionStartedAt.current = Date.now()
      stepStartedAt.current = Date.now()
      await trackEvent({
        sessionId: nextSession.id,
        quizId: resolvedQuiz.id,
        variantId,
        eventName: 'session_started',
        stepKey: 'intro',
        occurredAt: new Date().toISOString(),
        timeFromStartMs: 0,
      })
      await trackEvent({
        sessionId: nextSession.id,
        quizId: resolvedQuiz.id,
        variantId,
        eventName: 'quiz_viewed',
        stepKey: 'intro',
        occurredAt: new Date().toISOString(),
        timeFromStartMs: 0,
      })
    }

    void boot()
  }, [activeQuiz, shouldTrack, variantId])

  useEffect(() => {
    if (!activeQuiz || !activeVariant) {
      return
    }

    const resolvedQuiz = activeQuiz

    stepStartedAt.current = Date.now()

    if (!shouldTrack || !session) {
      return
    }

    const activeSession = session

    async function trackScreenView() {
      if (phase === 'question' && currentQuestion) {
        await trackEvent({
          sessionId: activeSession.id,
          quizId: resolvedQuiz.id,
          variantId,
          eventName: 'question_viewed',
          stepKey: currentQuestion.id,
          questionId: currentQuestion.id,
          occurredAt: new Date().toISOString(),
          timeFromStartMs: Date.now() - sessionStartedAt.current,
        })
      }

      if (phase === 'result' && resultKey) {
        await trackEvent({
          sessionId: activeSession.id,
          quizId: resolvedQuiz.id,
          variantId,
          eventName: 'result_viewed',
          stepKey: resultKey,
          occurredAt: new Date().toISOString(),
          timeFromStartMs: Date.now() - sessionStartedAt.current,
        })
      }

      if (phase === 'transition') {
        await trackEvent({
          sessionId: activeSession.id,
          quizId: resolvedQuiz.id,
          variantId,
          eventName: 'transition_viewed',
          stepKey: 'transition',
          occurredAt: new Date().toISOString(),
          timeFromStartMs: Date.now() - sessionStartedAt.current,
        })
      }

      if (phase === 'lead' && currentLeadStep) {
        await trackEvent({
          sessionId: activeSession.id,
          quizId: resolvedQuiz.id,
          variantId,
          eventName: 'lead_step_viewed',
          stepKey: currentLeadStep.id,
          occurredAt: new Date().toISOString(),
          timeFromStartMs: Date.now() - sessionStartedAt.current,
        })
      }

      if (phase === 'consent') {
        await trackEvent({
          sessionId: activeSession.id,
          quizId: resolvedQuiz.id,
          variantId,
          eventName: 'lead_step_viewed',
          stepKey: 'consent',
          occurredAt: new Date().toISOString(),
          timeFromStartMs: Date.now() - sessionStartedAt.current,
        })
      }
    }

    void trackScreenView()
  }, [activeQuiz, activeVariant, currentLeadStep, currentQuestion, phase, resultKey, session, shouldTrack, variantId])

  function exitLiveView() {
    if (window.opener) {
      window.close()
      return
    }

    navigate('/admin')
  }

  function recordAnswer(question: Question, value: string | string[]) {
    if (!activeQuiz || !activeVariant) {
      return
    }

    const nextAnswers: SessionAnswers = {
      ...answers,
      [question.id]: value,
    }

    setAnswers(nextAnswers)
    const elapsed = Date.now() - stepStartedAt.current

    if (shouldTrack && session) {
      const resolvedQuiz = activeQuiz

      void trackEvent({
        sessionId: session.id,
        quizId: resolvedQuiz.id,
        variantId,
        eventName: 'question_answered',
        stepKey: question.id,
        questionId: question.id,
        answerValue: value,
        occurredAt: new Date().toISOString(),
        timeFromStartMs: Date.now() - sessionStartedAt.current,
        timeOnStepMs: elapsed,
      })
    }

    const nextQuestionNode = resolveNextNode({ answerValue: value })
    if (nextQuestionNode) {
      setCurrentNodeId(nextQuestionNode.id)
      setPhase(getPhaseFromNode(nextQuestionNode))
      return
    }

    const nextResult = evaluateResult(variantId, nextAnswers, activeVariant)
    const resultNode = resolveNextNode({ answerValue: value, resultKey: nextResult })
      ?? activeQuiz.workflow.nodes.find((node) => node.type === 'result' && node.resultKey === nextResult)
    setResultKey(nextResult)
    if (resultNode) {
      setCurrentNodeId(resultNode.id)
    }
    setPhase('result')
  }

  function toggleMultiValue(question: Question, optionId: string) {
    if (question.kind !== 'multi') {
      return
    }

    const current = Array.isArray(answers[question.id]) ? [...(answers[question.id] as string[])] : []

    let next = current
    if (optionId === 'none') {
      next = current.includes('none') ? [] : ['none']
    } else if (current.includes(optionId)) {
      next = current.filter((value) => value !== optionId)
    } else {
      next = [...current.filter((value) => value !== 'none'), optionId]
    }

    setAnswers((previous) => ({
      ...previous,
      [question.id]: next,
    }))
    setErrorMessage('')
  }

  function submitCurrentQuestion() {
    if (!currentQuestion || currentQuestion.kind !== 'multi') {
      return
    }

    const selectedValues = Array.isArray(answers[currentQuestion.id]) ? answers[currentQuestion.id] as string[] : []

    if (!selectedValues.length) {
      setErrorMessage('Select at least one option to continue.')
      return
    }

    setErrorMessage('')
    recordAnswer(currentQuestion, selectedValues)
  }

  function goToPreviousQuestion() {
    if (!activeQuiz || !activeVariant || !currentQuestion) {
      return
    }

    const previousQuestion = activeVariant.questions[questionIndex - 1]

    if (!previousQuestion) {
      if (introNode) {
        setCurrentNodeId(introNode.id)
        setPhase('intro')
      }
      return
    }

    const previousQuestionNode = activeQuiz.workflow.nodes.find(
      (node) => node.type === 'question' && node.questionId === previousQuestion.id,
    )

    if (previousQuestionNode) {
      setCurrentNodeId(previousQuestionNode.id)
      setPhase('question')
      setErrorMessage('')
    }
  }

  function goToLeadFlow() {
    const transitionNode = resolveNextNode()
    if (transitionNode) {
      setCurrentNodeId(transitionNode.id)
      setPhase(getPhaseFromNode(transitionNode))
    }
  }

  function handleResultPrimary() {
    if (!activeQuiz) {
      return
    }

    if (!resultKey) {
      return
    }

    if (resultKey === 'hard-fail') {
      setAnswers({})
      setResultKey(null)
      if (introNode) {
        setCurrentNodeId(introNode.id)
        setPhase('intro')
      }
      return
    }

    if (shouldTrack && session) {
      const resolvedQuiz = activeQuiz

      void trackEvent({
        sessionId: session.id,
        quizId: resolvedQuiz.id,
        variantId,
        eventName: resultKey === 'soft-fail' ? 'continue_anyway_clicked' : 'quiz_completed',
        stepKey: resultKey,
        occurredAt: new Date().toISOString(),
        timeFromStartMs: Date.now() - sessionStartedAt.current,
      })
    }

    goToLeadFlow()
  }

  function handleResultSecondary() {
    if (!activeQuiz) {
      return
    }

    if (!resultKey) {
      return
    }

    if (resultKey === 'hard-fail') {
      if (introNode) {
        setCurrentNodeId(introNode.id)
      }
      setPhase('intro')
      setAnswers({})
      setResultKey(null)
      return
    }

    if (shouldTrack && session) {
      const resolvedQuiz = activeQuiz

      void trackEvent({
        sessionId: session.id,
        quizId: resolvedQuiz.id,
        variantId,
        eventName: 'review_answers_clicked',
        stepKey: resultKey,
        occurredAt: new Date().toISOString(),
        timeFromStartMs: Date.now() - sessionStartedAt.current,
      })
    }

    const firstQuestionNode = activeQuiz.workflow.nodes.find((node) => node.type === 'question' && node.variantId === variantId)
    if (firstQuestionNode) {
      setCurrentNodeId(firstQuestionNode.id)
    }
    setPhase('question')
  }

  function handleLeadTextStepSubmit() {
    if (!activeQuiz) {
      return
    }

    if (!currentLeadStep) {
      return
    }

    const key = currentLeadStep.id
    const value =
      key === 'first-name'
        ? lead.firstName
        : key === 'phone'
          ? lead.phone
          : lead.email

    if (!validateLeadStep(key, value)) {
      setErrorMessage('Please enter a valid answer before continuing.')
      return
    }

    setErrorMessage('')

    if (session) {
      const resolvedQuiz = activeQuiz

      void trackEvent({
        sessionId: session.id,
        quizId: resolvedQuiz.id,
        variantId,
        eventName: 'lead_field_completed',
        stepKey: currentLeadStep.id,
        occurredAt: new Date().toISOString(),
        timeFromStartMs: Date.now() - sessionStartedAt.current,
        timeOnStepMs: Date.now() - stepStartedAt.current,
      })
    }

    const nextLeadNode = resolveNextNode({ answerValue: value })
    if (!nextLeadNode || nextLeadNode.type !== 'lead') {
      setPhase('consent')
      return
    }

    setCurrentNodeId(nextLeadNode.id)
    setPhase('lead')
  }

  function updateLeadField(stepId: string, value: string) {
    setErrorMessage('')
    setLead((current) => {
      if (stepId === 'first-name') {
        return { ...current, firstName: value }
      }
      if (stepId === 'phone') {
        return { ...current, phone: value }
      }
      if (stepId === 'contact-method') {
        return { ...current, contactMethod: value }
      }
      if (stepId === 'best-time') {
        return { ...current, bestTime: value }
      }
      return { ...current, email: value }
    })
  }

  function handleLeadSelection(stepId: string, value: string) {
    updateLeadField(stepId, value)

    if (activeQuiz && session) {
      const resolvedQuiz = activeQuiz

      void trackEvent({
        sessionId: session.id,
        quizId: resolvedQuiz.id,
        variantId,
        eventName: 'lead_field_completed',
        stepKey: stepId,
        answerValue: value,
        occurredAt: new Date().toISOString(),
        timeFromStartMs: Date.now() - sessionStartedAt.current,
        timeOnStepMs: Date.now() - stepStartedAt.current,
      })
    }

    const nextLeadNode = resolveNextNode({ answerValue: value })
    if (!nextLeadNode || nextLeadNode.type !== 'lead') {
      setPhase('consent')
      return
    }

    setCurrentNodeId(nextLeadNode.id)
    setPhase('lead')
  }

  async function handleSubmitLead() {
    if (!activeQuiz) {
      return
    }

    const resolvedQuiz = activeQuiz

    if (!resultKey) {
      return
    }

    if (!lead.consent) {
      setErrorMessage('Consent is required before submission.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    if (!shouldTrack || !session) {
      setIsSubmitting(false)
      const thankYouNode = resolveNextNode() ?? activeQuiz.workflow.nodes.find((node) => node.type === 'thank-you')
      if (thankYouNode) {
        setCurrentNodeId(thankYouNode.id)
      }
      setPhase('thank-you')
      return
    }

    await trackEvent({
      sessionId: session.id,
      quizId: resolvedQuiz.id,
      variantId,
      eventName: 'lead_submitted',
      stepKey: 'consent',
      occurredAt: new Date().toISOString(),
      timeFromStartMs: Date.now() - sessionStartedAt.current,
      timeOnStepMs: Date.now() - stepStartedAt.current,
    })

    await submitLead({
      session,
      answers,
      lead,
      resultKey,
    })

    await completeSession(session.id)
    setIsSubmitting(false)
    const thankYouNode = resolveNextNode() ?? activeQuiz.workflow.nodes.find((node) => node.type === 'thank-you')
    if (thankYouNode) {
      setCurrentNodeId(thankYouNode.id)
    }
    setPhase('thank-you')
  }

  const result = resultKey && activeQuiz ? activeQuiz.resultContent[resultKey] : null

  const introButtonLabels = useMemo(() => activeVariant ? [activeVariant.intro.cta] : [], [activeVariant])
  const questionOptionLabels = useMemo(() => currentQuestion ? currentQuestion.options.map((option) => option.label) : [], [currentQuestion])
  const questionContinueLabels = useMemo(
    () => currentQuestion?.kind === 'multi' ? ['OK'] : [],
    [currentQuestion?.kind],
  )
  const resultButtonLabels = useMemo(() => result ? [result.primaryCta, result.secondaryCta ?? ''].filter(Boolean) : [], [result])
  const transitionButtonLabels = useMemo(() => activeQuiz ? [activeQuiz.transitionScreen.cta] : [], [activeQuiz])
  const leadSingleOptionLabels = useMemo(
    () => currentLeadStep?.kind === 'single' && currentLeadStep.options ? currentLeadStep.options : [],
    [currentLeadStep],
  )
  const leadTextButtonLabels = useMemo(() => {
    if (!currentLeadStep || currentLeadStep.kind === 'single') {
      return []
    }

    return [currentLeadStep.cta, currentLeadStep.id === 'email' ? 'Skip this step' : ''].filter(Boolean)
  }, [currentLeadStep])
  const consentSubmitLabel = isSubmitting ? 'Submitting...' : 'Submit'
  const consentButtonLabels = useMemo(() => [consentSubmitLabel, 'Back'], [consentSubmitLabel])
  const thankYouButtonLabels = useMemo(
    () => activeQuiz ? [activeQuiz.thankYouScreen.primaryCta, activeQuiz.thankYouScreen.secondaryCta] : [],
    [activeQuiz],
  )
  const liveViewButtonLabels = useMemo(() => ['Live view only'], [])

  const introButtonWidth = useSharedControlWidth(introButtonLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  const questionOptionWidth = useSharedControlWidth(questionOptionLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 220,
    horizontalPadding: 22,
  })

  const questionContinueButtonWidth = useSharedControlWidth(questionContinueLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  const resultButtonWidth = useSharedControlWidth(resultButtonLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  const transitionButtonWidth = useSharedControlWidth(transitionButtonLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  const leadSingleOptionWidth = useSharedControlWidth(leadSingleOptionLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 220,
    horizontalPadding: 22,
  })

  const leadTextButtonWidth = useSharedControlWidth(leadTextButtonLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  const consentButtonWidth = useSharedControlWidth(consentButtonLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  const thankYouButtonWidth = useSharedControlWidth(thankYouButtonLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  const liveViewButtonWidth = useSharedControlWidth(liveViewButtonLabels, {
    fontFamily: activeBuilderTheme?.fontFamily ?? 'var(--font-sans)',
    fontSizePx: 16,
    fontWeight: 500,
    minWidth: 180,
    horizontalPadding: 22,
  })

  if (!activeProject || !activeQuiz || !activeVariant) {
    return (
      <div className="quiz-page">
        <div className="quiz-shell preview-desktop">
          <section className="quiz-card stack">
            <div className="copy-kicker">Loading</div>
            <h1 style={{ marginBottom: 0 }}>Preparing quiz</h1>
            <p className="muted">Loading the published project and quiz configuration.</p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className={`quiz-page ${isLiveView ? 'is-live-view' : ''} ${isPreviewMode ? 'is-preview-view' : ''}`} style={pageStyle}>
      <div className={`quiz-shell ${previewDevice === 'mobile' ? 'preview-mobile' : 'preview-desktop'}`}>
        {isLiveView ? (
          <div className="quiz-frame-toolbar">
            <div>
              <span className="small-label">Live view</span>
              <p className="muted live-view-copy">{activeProject.name} · {activeQuiz.name} · {activeVariant.name}</p>
            </div>
            <Button onClick={exitLiveView}>Exit live view</Button>
          </div>
        ) : null}

        <section className="quiz-card stack">
          <div className={`stack ${isFramedMode ? 'quiz-stage-progress' : ''}`}>
            {isFramedMode ? (
              <ProgressBar value={progressValue} />
            ) : (
              <>
                <div className="copy-kicker">{activeProject.name}</div>
                <ProgressBar value={progressValue} />
                <p className="muted" style={{ margin: 0 }}>{microMessage}</p>
              </>
            )}
          </div>

          {phase === 'intro' ? (
            <div className="stack">
              <h1 className="display-title" style={{ fontSize: 'clamp(2rem, 8vw, 3.8rem)' }}>{activeVariant.intro.heading}</h1>
              <p className="muted">{activeVariant.intro.subcopy}</p>
              <div className="trust-list">
                {activeVariant.intro.trustPoints.map((item) => (
                  <span key={item} className="trust-chip">{item}</span>
                ))}
              </div>
              <div className="button-row" ref={introButtonWidth.containerRef}>
                <Button
                  tone="primary"
                  style={introButtonWidth.controlStyle}
                  onClick={() => {
                    const firstQuestionNode = activeQuiz.workflow.nodes.find((node) => node.type === 'question' && node.variantId === variantId)
                    if (firstQuestionNode) {
                      setCurrentNodeId(firstQuestionNode.id)
                    }
                    setPhase('question')
                  }}
                >
                  {activeVariant.intro.cta}
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'question' && currentQuestion ? (
            <div className={`stack quiz-stage-question ${isFramedMode ? `is-${previewDevice}` : ''}`}>
              <div className={`quiz-question-copy ${isFramedMode ? 'is-framed' : ''}`}>
                {isFramedMode ? (
                  <div className="quiz-question-headline">
                    <span className="quiz-step-chip">{questionIndex + 1}</span>
                    <h2 style={{ fontSize: '2rem', margin: 0 }}>{currentQuestion.prompt}</h2>
                  </div>
                ) : (
                  <>
                    <div className="small-label">Question {questionIndex + 1} / {activeVariant.questions.length}</div>
                    <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>{currentQuestion.prompt}</h2>
                  </>
                )}
                {currentQuestion.helper ? <p className="muted">{currentQuestion.helper}</p> : null}
              </div>

              <div className={`option-grid quiz-stage-options ${currentQuestion.kind === 'multi' ? 'multi' : ''}`} ref={questionOptionWidth.containerRef}>
                {currentQuestion.options.map((option) => {
                  const currentAnswer = answers[currentQuestion.id]
                  const isSelected = Array.isArray(currentAnswer)
                    ? currentAnswer.includes(option.id)
                    : currentSingleChoiceValue === option.id
                  const tone =
                    isSelected
                      ? 'selected'
                      : 'secondary'

                  return (
                    <Button
                      key={option.id}
                      tone={tone}
                      style={questionOptionWidth.controlStyle}
                      className={`option-button ${pendingChoice?.questionId === currentQuestion.id && pendingChoice.optionId === option.id ? 'is-committing' : ''}`}
                      disabled={pendingChoice?.questionId === currentQuestion.id}
                      onClick={() => {
                        if (currentQuestion.kind === 'single') {
                          setErrorMessage('')
                          setPendingChoice({ questionId: currentQuestion.id, optionId: option.id })

                          window.setTimeout(() => {
                            recordAnswer(currentQuestion, option.id)
                            setPendingChoice(null)
                          }, 180)
                        } else {
                          toggleMultiValue(currentQuestion, option.id)
                        }
                      }}
                    >
                      <span>{option.label}</span>
                    </Button>
                  )
                })}
              </div>

              {(currentQuestion.kind === 'multi' || (isFramedMode && previewDevice === 'mobile')) ? (
                <div className={`button-row quiz-question-actions ${isFramedMode ? `is-${previewDevice}` : ''}`} ref={questionContinueButtonWidth.containerRef}>
                  {isFramedMode && previewDevice === 'mobile' ? (
                    <Button className="quiz-question-back" onClick={goToPreviousQuestion}>
                      ←
                    </Button>
                  ) : null}
                  {currentQuestion.kind === 'multi' ? (
                    <Button tone="primary" style={questionContinueButtonWidth.controlStyle} onClick={submitCurrentQuestion} disabled={!canSubmitCurrentQuestion}>
                      OK
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {errorMessage ? <p style={{ color: '#ffb27c', margin: 0 }}>{errorMessage}</p> : null}
            </div>
          ) : null}

          {phase === 'result' && result ? (
            <div className="stack">
              <h2 style={{ fontSize: '2rem', marginBottom: 0 }}>{result.title}</h2>
              <p className="muted">{result.body}</p>
              {result.trustPoints?.length ? (
                <div className="trust-list">
                  {result.trustPoints.map((item) => (
                    <span key={item} className="trust-chip">{item}</span>
                  ))}
                </div>
              ) : null}
              <div className="button-row" ref={resultButtonWidth.containerRef}>
                <Button tone="primary" style={resultButtonWidth.controlStyle} onClick={handleResultPrimary}>{result.primaryCta}</Button>
                {result.secondaryCta ? <Button style={resultButtonWidth.controlStyle} onClick={handleResultSecondary}>{result.secondaryCta}</Button> : null}
              </div>
            </div>
          ) : null}

          {phase === 'transition' ? (
            <div className="stack">
              <h2 style={{ fontSize: '2rem', marginBottom: 0 }}>{activeQuiz.transitionScreen.heading}</h2>
              <p className="muted">{activeQuiz.transitionScreen.body}</p>
              <div className="trust-list">
                {activeQuiz.transitionScreen.trustPoints.map((item) => (
                  <span key={item} className="trust-chip">{item}</span>
                ))}
              </div>
              <div className="button-row" ref={transitionButtonWidth.containerRef}>
                <Button
                  tone="primary"
                  style={transitionButtonWidth.controlStyle}
                  onClick={() => {
                    const firstLeadNode = resolveNextNode()
                    if (firstLeadNode && firstLeadNode.type === 'lead') {
                      setCurrentNodeId(firstLeadNode.id)
                      setPhase('lead')
                    }
                  }}
                >
                  {activeQuiz.transitionScreen.cta}
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'lead' && currentLeadStep ? (
            <div className="stack">
              <div>
                <div className="small-label">Lead step {leadIndex + 1} / {activeQuiz.leadSteps.length}</div>
                <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>{currentLeadStep.label}</h2>
                {currentLeadStep.helper ? <p className="muted">{currentLeadStep.helper}</p> : null}
              </div>

              {currentLeadStep.kind === 'single' && currentLeadStep.options ? (
                <div className="option-grid" ref={leadSingleOptionWidth.containerRef}>
                  {currentLeadStep.options.map((option) => {
                    const selectedValue = currentLeadStep.id === 'contact-method' ? lead.contactMethod : lead.bestTime
                    return (
                      <Button
                        key={option}
                        tone={selectedValue === option ? 'selected' : 'secondary'}
                        style={leadSingleOptionWidth.controlStyle}
                        className="option-button"
                        onClick={() => handleLeadSelection(currentLeadStep.id, option)}
                      >
                        {option}
                      </Button>
                    )
                  })}
                </div>
              ) : (
                <div className="stack">
                  <input
                    autoFocus
                    placeholder={currentLeadStep.placeholder}
                    type={currentLeadStep.kind === 'phone' ? 'tel' : currentLeadStep.kind === 'email' ? 'email' : 'text'}
                    value={
                      currentLeadStep.id === 'first-name'
                        ? lead.firstName
                        : currentLeadStep.id === 'phone'
                          ? lead.phone
                          : lead.email
                    }
                    onChange={(event) => updateLeadField(currentLeadStep.id, event.target.value)}
                  />
                  <div className="button-row" ref={leadTextButtonWidth.containerRef}>
                    <Button tone="primary" style={leadTextButtonWidth.controlStyle} onClick={handleLeadTextStepSubmit}>{currentLeadStep.cta}</Button>
                    {currentLeadStep.id === 'email' ? <Button style={leadTextButtonWidth.controlStyle} onClick={() => setPhase('consent')}>Skip this step</Button> : null}
                  </div>
                </div>
              )}

              {errorMessage ? <p style={{ color: '#ffb27c' }}>{errorMessage}</p> : null}
            </div>
          ) : null}

          {phase === 'consent' ? (
            <div className="stack">
              <div>
                <div className="small-label">Final step</div>
                <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>Please confirm</h2>
                <p className="muted">We only use your details for this eligibility check and next steps if appropriate.</p>
              </div>
              <label className="trust-chip" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={lead.consent}
                  onChange={(event) => setLead((current) => ({ ...current, consent: event.target.checked }))}
                  style={{ width: 18, height: 18 }}
                />
                <span>I agree to be contacted about my eligibility check.</span>
              </label>
              <div className="button-row" ref={consentButtonWidth.containerRef}>
                <Button tone="primary" style={consentButtonWidth.controlStyle} onClick={() => void handleSubmitLead()} disabled={isSubmitting}>
                  {consentSubmitLabel}
                </Button>
                <Button
                  style={consentButtonWidth.controlStyle}
                  onClick={() => {
                    const previousLeadStep = activeQuiz.leadSteps[Math.max(0, leadIndex - 1)]
                    const previousLeadNode = activeQuiz.workflow.nodes.find((node) => node.type === 'lead' && node.leadStepId === previousLeadStep?.id)
                    if (previousLeadNode) {
                      setCurrentNodeId(previousLeadNode.id)
                    }
                    setPhase('lead')
                  }}
                >
                  Back
                </Button>
              </div>
              {errorMessage ? <p style={{ color: '#ffb27c' }}>{errorMessage}</p> : null}
            </div>
          ) : null}

          {phase === 'thank-you' ? (
            <div className="stack">
              <h2 style={{ fontSize: '2rem', marginBottom: 0 }}>{activeQuiz.thankYouScreen.heading}</h2>
              <p className="muted">{activeQuiz.thankYouScreen.body}</p>
              <div className="button-row" ref={thankYouButtonWidth.containerRef}>
                <Button tone="primary" style={thankYouButtonWidth.controlStyle}>{activeQuiz.thankYouScreen.primaryCta}</Button>
                <Button style={thankYouButtonWidth.controlStyle}>{activeQuiz.thankYouScreen.secondaryCta}</Button>
              </div>
            </div>
          ) : null}
        </section>

        {!isFramedMode ? (
          <aside className="quiz-sidebar stack">
          <div>
            <div className="small-label">Funnel mode</div>
            <h3 style={{ marginBottom: 8 }}>
              {searchParams.get('embed') === '1' || activeQuiz.layoutMode === 'embed' ? 'Embed' : 'Standalone'}
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Variant assignment, UTM capture, event tracking, and lead submission are active from the first screen.
            </p>
          </div>
          <div className="metric-card">
            <div className="small-label">Active variant</div>
            <p style={{ marginBottom: 8 }}>{activeVariant.name}</p>
            <span className="muted">{activeVariant.description}</span>
          </div>
          <div className="metric-card">
            <div className="small-label">Progress</div>
            <p style={{ marginBottom: 8 }}>{Math.round(progressValue)}% complete</p>
            <span className="muted">Answers are stored to the current session for analytics and lead attribution.</span>
          </div>
          <div className="button-row" ref={liveViewButtonWidth.containerRef}>
            <Button tone="primary" style={liveViewButtonWidth.controlStyle} onClick={() => window.open(`/q/${activeQuiz.slug}?live=1`, '_blank', 'noopener,noreferrer')}>
              Live view only
            </Button>
          </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
