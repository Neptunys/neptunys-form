import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '../../components/Button'
import { createAutomationTemplate } from '../../data/automationData'
import { buildQuizWorkflow, createLeadStep, createProjectDefinition, createQuestion, createQuizDefinition, createQuizVariant, ensureQuizWorkflow, getActiveQuiz, getProjectById } from '../../data/quizData'
import {
  getAdminRememberPreference,
  getAdminSession,
  getAutomationRegistry,
  getDashboardMetricsForQuiz,
  getProjectAutomationInsights,
  getProjectRegistry,
  loadProjectRegistry,
  restoreAdminSession,
  saveAutomationRegistry,
  saveProjectRegistry,
  setAdminSession,
  signInAdmin,
  signOutAdmin,
} from '../../lib/storage'
import { hasSupabaseConfig } from '../../lib/supabase'
import type { AutomationNode, LeadStep, ProjectAutomation, ProjectDefinition, Question, QuizBuilderDesign, QuizBuilderTheme, QuizDefinition, QuizVariant, QuizWorkflowNode, ResultKey } from '../../lib/types'
import { createId } from '../../lib/utils'
import './admin-v2.css'

type AdminSection = 'forms' | 'contacts' | 'automations'
type BuilderTab = 'content' | 'workflow' | 'connect'
type FormsViewMode = 'list' | 'grid'
type FormsSort = 'date-created' | 'last-updated' | 'alphabetical'
type ContactModal = 'create-list' | 'import' | null
type AutomationCategory = 'contact-updates' | 'form-submissions' | 'specific-date' | 'recurring'
type AutomationComposerStep = 'idle' | 'trigger-picker' | 'form-submission' | 'editor'
type QuizActionModal = 'rename' | 'copy' | 'move' | null
type NewFormCanvasMode = 'ai' | 'builder'
type NewFormComposerTab = 'elements' | 'ai'
type BuilderModeKey = 'universal' | 'lead' | 'knowledge' | 'match'
type BuilderDevice = 'desktop' | 'mobile'
type BuilderToolPanel = 'preview' | 'insights' | 'logic' | 'translate' | 'settings'
type BuilderLocale = 'en-GB' | 'en-US' | 'fr-FR'
type BuilderToggleKey = 'required' | 'multipleSelection' | 'randomize' | 'otherOption' | 'verticalAlignment' | 'mapToContacts' | 'showLabels' | 'supersize' | 'maxCharacters' | 'answerValidation' | 'video' | 'audio' | 'allowTextAnswer'
type BuilderDesignView = 'library' | 'editor'
type BuilderThemeEditorTab = 'logo' | 'font' | 'buttons' | 'background'
type BuilderThemeFontSize = 'sm' | 'md' | 'lg'
type BuilderThemeAlign = 'left' | 'center' | 'right'
type BuilderThemeCornerRadius = QuizBuilderTheme['cornerRadius']
type NewFormElement = {
  key: string
  label: string
  color: 'rose' | 'violet' | 'green' | 'blue' | 'amber' | 'stone'
}
type BuilderTheme = QuizBuilderTheme
type BuilderSelection =
  | { kind: 'intro'; variantId: string }
  | { kind: 'question'; variantId: string; questionId: string }
  | { kind: 'lead'; stepId: string }
  | { kind: 'transition' }
  | { kind: 'result'; resultKey: ResultKey }
  | { kind: 'thank-you' }

type BuilderPageItem = {
  key: string
  label: string
  onClick: () => void
  active: boolean
  kind: 'intro' | 'question' | 'lead'
  elementKey: string
  elementColor: NewFormElement['color']
  variantId?: string
  questionId?: string
  stepId?: string
}

const CONTACT_FILTER_FIELDS = [
  'Last updated',
  'Email',
  'Data enrichment',
  'Name',
  'Subscription status',
  'Notes',
  'Phone number',
  'Job title',
  'LinkedIn URL',
  'Company name',
  'Company description',
  'Company industry',
]

const AUTOMATION_ACTION_OPTIONS = [
  {
    title: 'Send email to respondents',
    body: 'Create a fully customisable follow-up email sent once someone answers your form.',
  },
  {
    title: 'Receive email notifications',
    body: 'Notify your team when the form gets a new response.',
  },
  {
    title: 'Deliver a webhook',
    body: 'Send the response data to your own infrastructure or CRM endpoint.',
  },
  {
    title: 'Slack',
    body: 'Notify a channel or individual in Slack with the response details in real time.',
  },
]

const QUIZ_SORT_OPTIONS: Array<{ key: FormsSort; label: string }> = [
  { key: 'date-created', label: 'Date created' },
  { key: 'last-updated', label: 'Last updated' },
  { key: 'alphabetical', label: 'Alphabetical' },
]

const NEW_FORM_ELEMENT_SECTIONS: Array<{ title: string; items: NewFormElement[] }> = [
  {
    title: 'Contact info',
    items: [
      { key: 'contact-info', label: 'Contact info', color: 'rose' },
      { key: 'email', label: 'Email', color: 'rose' },
      { key: 'phone-number', label: 'Phone Number', color: 'rose' },
      { key: 'address', label: 'Address', color: 'rose' },
      { key: 'website', label: 'Website', color: 'rose' },
    ],
  },
  {
    title: 'Choice',
    items: [
      { key: 'multiple-choice', label: 'Multiple Choice', color: 'violet' },
      { key: 'dropdown', label: 'Dropdown', color: 'violet' },
      { key: 'picture-choice', label: 'Picture Choice', color: 'violet' },
      { key: 'yes-no', label: 'Yes/No', color: 'violet' },
      { key: 'legal', label: 'Legal', color: 'violet' },
      { key: 'checkbox', label: 'Checkbox', color: 'violet' },
    ],
  },
  {
    title: 'Rating & ranking',
    items: [
      { key: 'nps', label: 'Net Promoter Score', color: 'green' },
      { key: 'opinion-scale', label: 'Opinion Scale', color: 'green' },
      { key: 'rating', label: 'Rating', color: 'green' },
      { key: 'ranking', label: 'Ranking', color: 'green' },
      { key: 'matrix', label: 'Matrix', color: 'green' },
    ],
  },
  {
    title: 'Text & Video',
    items: [
      { key: 'long-text', label: 'Long Text', color: 'blue' },
      { key: 'short-text', label: 'Short Text', color: 'blue' },
      { key: 'video', label: 'Video and Audio', color: 'blue' },
      { key: 'clarify-ai', label: 'Clarify with AI', color: 'blue' },
      { key: 'faq-ai', label: 'FAQ with AI', color: 'blue' },
    ],
  },
  {
    title: 'Other',
    items: [
      { key: 'number', label: 'Number', color: 'amber' },
      { key: 'date', label: 'Date', color: 'amber' },
      { key: 'signature', label: 'Signature', color: 'amber' },
      { key: 'payment', label: 'Payment', color: 'amber' },
      { key: 'file-upload', label: 'File Upload', color: 'amber' },
      { key: 'google-drive', label: 'Google Drive', color: 'amber' },
      { key: 'calendly', label: 'Calendly', color: 'amber' },
      { key: 'welcome-screen', label: 'Welcome Screen', color: 'stone' },
      { key: 'statement', label: 'Statement', color: 'stone' },
      { key: 'question-group', label: 'Question Group', color: 'stone' },
      { key: 'end-screen', label: 'End Screen', color: 'stone' },
      { key: 'redirect', label: 'Redirect to URL', color: 'stone' },
    ],
  },
] 

const ALL_NEW_FORM_ELEMENTS = NEW_FORM_ELEMENT_SECTIONS.flatMap((section) => section.items)

const CRM_SYNC_APPS: Array<{ key: 'hubspot' | 'salesforce'; label: string; color: 'orange' | 'blue' }> = [
  { key: 'hubspot', label: 'HubSpot', color: 'orange' },
  { key: 'salesforce', label: 'Salesforce', color: 'blue' },
]

const ADD_CONTENT_RECOMMENDED_KEYS = ['video', 'short-text', 'multiple-choice']

const BUILDER_THEME_COLOR_OPTIONS = [
  { value: '#ffffff', label: 'White' },
  { value: '#f3c441', label: 'Gold' },
  { value: '#7ea7d8', label: 'Steel blue' },
  { value: '#6e8f72', label: 'Military green' },
  { value: '#1d2530', label: 'Deep navy' },
  { value: '#d7d3cc', label: 'Sand' },
]

const BUILDER_THEME_FONT_OPTIONS = [
  { value: 'var(--font-sans)', label: 'System font' },
  { value: 'Georgia, serif', label: 'Editorial serif' },
  { value: '"Trebuchet MS", sans-serif', label: 'Rounded sans' },
]

const BUILDER_THEME_SAMPLE_LOGO = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"%3E%3Crect width="72" height="72" rx="10" fill="%23324860"/%3E%3Cpath d="M22 48V24h10.6c7.3 0 12 4.9 12 11.8 0 7.1-4.9 12.2-12 12.2H22Zm6.2-5.2h4c3.7 0 6.2-2.8 6.2-7s-2.4-6.7-6.2-6.7h-4v13.7Z" fill="%23dbe7f6"/%3E%3C/svg%3E'

const BUILDER_CORNER_RADIUS_OPTIONS: BuilderThemeCornerRadius[] = ['none', 'soft', 'pill']
const BUILDER_CORNER_RADIUS_INDEX: Record<BuilderThemeCornerRadius, number> = { none: 0, soft: 1, pill: 2 }
const BUILDER_CORNER_RADIUS_LABEL: Record<BuilderThemeCornerRadius, string> = { none: 'None', soft: 'Soft', pill: 'Pill' }
const BUILDER_ALIGN_LABEL: Record<BuilderThemeAlign, string> = { left: 'Left', center: 'Center', right: 'Right' }
const BUILDER_LOGO_SIZE_MIN = 72
const BUILDER_LOGO_SIZE_MAX = 220

function normalizeBuilderThemeCornerRadius(value: string | undefined): BuilderThemeCornerRadius {
  if (value === 'none' || value === 'soft' || value === 'pill') {
    return value
  }

  if (value === 'sm') {
    return 'none'
  }

  if (value === 'lg') {
    return 'pill'
  }

  return 'soft'
}

function normalizeBuilderThemeLogoSize(value: number | string | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(BUILDER_LOGO_SIZE_MAX, Math.max(BUILDER_LOGO_SIZE_MIN, Math.round(value)))
  }

  if (value === 'sm') {
    return 96
  }

  if (value === 'lg') {
    return 168
  }

  return 128
}

function normalizeBuilderThemeAlign(value: string | undefined): BuilderThemeAlign {
  if (value === 'left' || value === 'center' || value === 'right') {
    return value
  }

  return 'left'
}

function normalizeBuilderTheme(theme: BuilderTheme): BuilderTheme {
  return {
    ...theme,
    cornerRadius: normalizeBuilderThemeCornerRadius(theme.cornerRadius),
    logoSize: normalizeBuilderThemeLogoSize(theme.logoSize),
    logoAlign: normalizeBuilderThemeAlign(theme.logoAlign),
    contentOffsetX: typeof theme.contentOffsetX === 'number' && Number.isFinite(theme.contentOffsetX)
      ? Math.max(-160, Math.min(160, Math.round(theme.contentOffsetX)))
      : -28,
  }
}

function createBuilderTheme(id: string, name: string, source: BuilderTheme['source'], overrides: Partial<BuilderTheme> = {}): BuilderTheme {
  return normalizeBuilderTheme({
    id,
    name,
    source,
    preview: overrides.preview ?? '',
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
    backgroundImageThumb: overrides.backgroundImageThumb,
    logoImage: '',
    logoAlt: '',
    logoSize: 128,
    logoAlign: 'left',
    ...overrides,
  })
}

function cloneBuilderTheme(theme: BuilderTheme): BuilderTheme {
  return normalizeBuilderTheme({ ...theme })
}

const BUILDER_THEME_LIBRARY: BuilderTheme[] = [
  createBuilderTheme('theme-default', 'My new theme', 'mine', {
    preview: 'linear-gradient(180deg, #d8d2cc 0%, #d8d2cc 100%)',
  }),
  createBuilderTheme('theme-sand', 'Field notebook', 'mine', {
    preview: 'linear-gradient(135deg, #d8d2cc 0%, #cfc7bf 100%)',
    buttonColor: '#7d5f1d',
    buttonTextColor: '#f9f3dc',
    answerColor: 'rgba(125,95,29,0.24)',
  }),
]

const BUILDER_MODE_OPTIONS: Array<{ key: BuilderModeKey; label: string; description: string }> = [
  { key: 'universal', label: 'Universal mode', description: 'Create any form.' },
  { key: 'lead', label: 'Lead qualification mode', description: 'Score and prioritize leads.' },
  { key: 'knowledge', label: 'Knowledge quiz mode', description: 'Set correct answers.' },
  { key: 'match', label: 'Match quiz mode', description: 'Assign answers to endings.' },
]

const BUILDER_ANSWER_OPTIONS = ALL_NEW_FORM_ELEMENTS.filter((item) => !['welcome-screen', 'end-screen', 'redirect'].includes(item.key))

const BUILDER_GRAPH_NODE_WIDTH = 196
const BUILDER_GRAPH_NODE_HEIGHT = 88
const BUILDER_GRAPH_PADDING = 88

const BUILDER_TOOL_OPTIONS = [
  { key: 'preview', title: 'Preview', icon: 'preview' },
  { key: 'insights', title: 'Insights', icon: 'spark' },
  { key: 'logic', title: 'Logic', icon: 'logic' },
  { key: 'translate', title: 'Translate', icon: 'translate' },
  { key: 'settings', title: 'Settings', icon: 'settings' },
] as const satisfies Array<{ key: BuilderToolPanel; title: string; icon: 'preview' | 'spark' | 'logic' | 'translate' | 'settings' }>

const BUILDER_LOCALE_OPTIONS = [
  { key: 'en-GB', label: 'English (UK)' },
  { key: 'en-US', label: 'English (US)' },
  { key: 'fr-FR', label: 'Francais' },
] as const satisfies Array<{ key: BuilderLocale; label: string }>

const BUILDER_PREVIEW_COPY: Record<BuilderLocale, {
  welcome: string
  contactInfo: string
  transition: string
  result: string
  ending: string
  optionalDescription: string
  addChoice: string
  choiceFallback: string
}> = {
  'en-GB': {
    welcome: 'Welcome',
    contactInfo: 'Contact info',
    transition: 'Transition',
    result: 'Result',
    ending: 'Ending',
    optionalDescription: 'Description optional',
    addChoice: 'Add choice',
    choiceFallback: 'choice',
  },
  'en-US': {
    welcome: 'Welcome',
    contactInfo: 'Contact info',
    transition: 'Transition',
    result: 'Result',
    ending: 'Ending',
    optionalDescription: 'Optional description',
    addChoice: 'Add choice',
    choiceFallback: 'choice',
  },
  'fr-FR': {
    welcome: 'Bienvenue',
    contactInfo: 'Coordonnees',
    transition: 'Transition',
    result: 'Resultat',
    ending: 'Fin',
    optionalDescription: 'Description facultative',
    addChoice: 'Ajouter un choix',
    choiceFallback: 'choix',
  },
}

type BuilderGraphSurface = 'workflow' | 'connect'

type BuilderGraphDragState = {
  surface: BuilderGraphSurface
  nodeId: string
  offsetX: number
  offsetY: number
  canvasLeft: number
  canvasTop: number
}

const MULTI_CHOICE_ELEMENT_KEYS = new Set(['checkbox', 'ranking', 'matrix'])
const SINGLE_CHOICE_ELEMENT_KEYS = new Set(['multiple-choice', 'dropdown', 'picture-choice', 'yes-no', 'legal', 'rating', 'opinion-scale', 'nps'])
const BUILDER_FIELD_GROUP_KEYS = new Set(['contact-info', 'address'])
const BUILDER_TEXT_ENTRY_KEYS = new Set(['short-text', 'long-text', 'email', 'website', 'number', 'date'])
const BUILDER_SCALE_KEYS = new Set(['rating', 'opinion-scale', 'nps'])
const BUILDER_MEDIA_KEYS = new Set(['video', 'clarify-ai', 'faq-ai'])
const BUILDER_ACTION_KEYS = new Set(['payment', 'file-upload', 'google-drive', 'calendly', 'signature'])
const BUILDER_CHOICE_EDITOR_KEYS = new Set(['multiple-choice', 'dropdown', 'picture-choice', 'yes-no', 'legal', 'checkbox', 'ranking', 'matrix'])
const DEFAULT_BUILDER_TOGGLES: Record<BuilderToggleKey, boolean> = {
  required: true,
  multipleSelection: false,
  randomize: false,
  otherOption: false,
  verticalAlignment: true,
  mapToContacts: false,
  showLabels: true,
  supersize: false,
  maxCharacters: false,
  answerValidation: false,
  video: true,
  audio: false,
  allowTextAnswer: false,
}

function createQuestionOptionsFromLabels(labels: string[]) {
  return labels.map((label) => ({ id: createId('option'), label, result: 'neutral' as const }))
}

function getQuestionElementPreset(elementKey: string) {
  switch (elementKey) {
    case 'contact-info':
      return { kind: 'single' as const, optionLabels: ['First name', 'Last name', 'Phone number', 'Email', 'Company'] }
    case 'address':
      return { kind: 'single' as const, optionLabels: ['Address', 'Address line 2', 'City/Town', 'State/Region/Province', 'Zip/Post code', 'Country'] }
    case 'phone-number':
      return { kind: 'single' as const, optionLabels: ['Phone number'] }
    case 'email':
      return { kind: 'single' as const, optionLabels: ['name@example.com'] }
    case 'website':
      return { kind: 'single' as const, optionLabels: ['https://example.com'] }
    case 'short-text':
    case 'long-text':
      return { kind: 'single' as const, optionLabels: ['Type your answer here...'] }
    case 'number':
      return { kind: 'single' as const, optionLabels: ['0'] }
    case 'date':
      return { kind: 'single' as const, optionLabels: ['Select a date'] }
    case 'video':
      return { kind: 'single' as const, optionLabels: ['Add video answer'] }
    case 'clarify-ai':
      return { kind: 'single' as const, optionLabels: ['Clarify with AI'] }
    case 'faq-ai':
      return { kind: 'single' as const, optionLabels: ['Ask with AI'] }
    case 'payment':
      return { kind: 'single' as const, optionLabels: ['Add payment details'] }
    case 'file-upload':
      return { kind: 'single' as const, optionLabels: ['Upload file'] }
    case 'google-drive':
      return { kind: 'single' as const, optionLabels: ['Choose from Google Drive'] }
    case 'calendly':
      return { kind: 'single' as const, optionLabels: ['Book time'] }
    case 'signature':
      return { kind: 'single' as const, optionLabels: ['Sign here'] }
    case 'picture-choice':
      return { kind: 'single' as const, optionLabels: ['Choice 1', 'Choice 2'] }
    case 'yes-no':
      return { kind: 'single' as const, optionLabels: ['Yes', 'No'] }
    case 'legal':
      return { kind: 'single' as const, optionLabels: ['I agree to the terms'] }
    case 'checkbox':
      return { kind: 'multi' as const, optionLabels: ['Choice 1', 'Choice 2'] }
    case 'ranking':
      return { kind: 'multi' as const, optionLabels: ['choice', 'choice'] }
    case 'matrix':
      return { kind: 'multi' as const, optionLabels: ['Statement 1', 'Statement 2'] }
    case 'statement':
      return { kind: 'single' as const, optionLabels: ['This is a statement block'] }
    case 'question-group':
      return { kind: 'multi' as const, optionLabels: ['Question 1', 'Question 2'] }
    case 'dropdown':
      return { kind: 'single' as const, optionLabels: ['Option 1', 'Option 2'] }
    case 'rating':
      return { kind: 'single' as const, optionLabels: ['1', '2', '3', '4', '5'] }
    case 'opinion-scale':
      return { kind: 'single' as const, optionLabels: ['1', '2', '3', '4', '5'] }
    case 'nps':
      return { kind: 'single' as const, optionLabels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] }
    default:
      return { kind: 'single' as const, optionLabels: ['Choice 1', 'Choice 2'] }
  }
}

function getQuestionElementKey(question: Question | null) {
  if (!question) {
    return 'multiple-choice'
  }

  return question.builderElementKey ?? (question.kind === 'multi' ? 'checkbox' : 'multiple-choice')
}

function getQuestionToggleKeys(elementKey: string): BuilderToggleKey[] {
  if (elementKey === 'picture-choice') {
    return ['required', 'showLabels', 'supersize', 'multipleSelection', 'randomize', 'otherOption']
  }

  if (elementKey === 'ranking') {
    return ['required', 'randomize']
  }

  if (BUILDER_TEXT_ENTRY_KEYS.has(elementKey)) {
    return ['required', 'maxCharacters', 'answerValidation']
  }

  if (elementKey === 'phone-number') {
    return ['required']
  }

  if (BUILDER_MEDIA_KEYS.has(elementKey)) {
    return ['required', 'video', 'audio', 'allowTextAnswer']
  }

  if (BUILDER_SCALE_KEYS.has(elementKey)) {
    return ['required']
  }

  if (BUILDER_ACTION_KEYS.has(elementKey)) {
    return ['required']
  }

  if (elementKey === 'dropdown') {
    return ['required', 'randomize']
  }

  if (elementKey === 'contact-info' || elementKey === 'address') {
    return []
  }

  return ['required', 'multipleSelection', 'randomize', 'otherOption', 'verticalAlignment']
}

function getBuilderToggleLabel(toggleKey: BuilderToggleKey) {
  switch (toggleKey) {
    case 'multipleSelection':
      return 'Multiple selection'
    case 'randomize':
      return 'Randomize'
    case 'otherOption':
      return '"Other" option'
    case 'verticalAlignment':
      return 'Vertical alignment'
    case 'mapToContacts':
      return 'Map to contacts ⓘ'
    case 'showLabels':
      return 'Show labels'
    case 'supersize':
      return 'Supersize'
    case 'maxCharacters':
      return 'Max characters'
    case 'answerValidation':
      return 'Answer validation ⓘ'
    case 'video':
      return 'Video'
    case 'audio':
      return 'Audio'
    case 'allowTextAnswer':
      return 'Allow text answer ⓘ'
    default:
      return 'Required'
  }
}

function hashValue(value: string) {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 100000
  }
  return hash
}

function getQuizTimestamp(quiz: QuizDefinition) {
  const baseDate = new Date('2026-04-08T10:00:00Z')
  baseDate.setDate(baseDate.getDate() - (hashValue(quiz.id) % 45))
  return baseDate.getTime()
}

function getQuizDateLabel(quiz: QuizDefinition) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(getQuizTimestamp(quiz)))
}

function cloneQuizDefinition(quiz: QuizDefinition, overrides: Partial<QuizDefinition> = {}) {
  const copy = JSON.parse(JSON.stringify(quiz)) as QuizDefinition
  return createQuizDefinition({
    ...copy,
    id: createId('quiz'),
    slug: toSlug(overrides.name ?? `${quiz.name}-copy`, `quiz-${Date.now()}`),
    customDomain: '',
    ...overrides,
  })
}

function toSlug(value: string, fallback: string) {
  const next = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return next || fallback
}

function createDefaultSelection(quiz: QuizDefinition): BuilderSelection {
  const firstVariant = quiz.variants[0]
  const firstQuestion = firstVariant?.questions[0]

  if (firstVariant && firstQuestion) {
    return { kind: 'question', variantId: firstVariant.id, questionId: firstQuestion.id }
  }

  if (firstVariant) {
    return { kind: 'intro', variantId: firstVariant.id }
  }

  if (quiz.leadSteps[0]) {
    return { kind: 'lead', stepId: quiz.leadSteps[0].id }
  }

  return { kind: 'thank-you' }
}

function isBuilderSelectionEqual(left: BuilderSelection | null, right: BuilderSelection | null) {
  if (!left || !right || left.kind !== right.kind) {
    return false
  }

  switch (left.kind) {
    case 'intro':
      return right.kind === 'intro' && left.variantId === right.variantId
    case 'question':
      return right.kind === 'question' && left.variantId === right.variantId && left.questionId === right.questionId
    case 'lead':
      return right.kind === 'lead' && left.stepId === right.stepId
    case 'result':
      return right.kind === 'result' && left.resultKey === right.resultKey
    case 'transition':
    case 'thank-you':
      return true
    default:
      return false
  }
}

function getSelectionLabel(selection: BuilderSelection, quiz: QuizDefinition) {
  if (selection.kind === 'intro') {
    const variant = quiz.variants.find((item) => item.id === selection.variantId)
    return variant?.name ?? 'Intro'
  }

  if (selection.kind === 'question') {
    const variant = quiz.variants.find((item) => item.id === selection.variantId)
    return variant?.questions.find((item) => item.id === selection.questionId)?.prompt ?? 'Question'
  }

  if (selection.kind === 'lead') {
    return quiz.leadSteps.find((step) => step.id === selection.stepId)?.label ?? 'Contact info'
  }

  if (selection.kind === 'transition') {
    return 'Transition'
  }

  if (selection.kind === 'result') {
    return selection.resultKey
  }

  return 'Thank you'
}

function getElementMeta(elementKey: string) {
  return ALL_NEW_FORM_ELEMENTS.find((item) => item.key === elementKey) ?? { key: elementKey, label: 'Item', color: 'stone' as const }
}

function getPageChipLabel(rawLabel: string | undefined, elementKey: string) {
  const nextLabel = rawLabel?.trim() ?? ''
  if (!nextLabel || nextLabel === '...' || nextLabel === 'New question' || nextLabel === 'New field') {
    return getElementMeta(elementKey).label
  }

  return nextLabel
}

function hasVisibleIntroScreen(variant: QuizVariant | undefined) {
  if (!variant) {
    return false
  }

  if (variant.introHidden) {
    return false
  }

  return Boolean(
    variant.intro.heading.trim()
    || variant.intro.subcopy.trim()
    || variant.intro.cta.trim()
    || variant.intro.trustPoints.some((point) => point.trim()),
  )
}

function getWorkspaceActiveQuiz(project: ProjectDefinition | null) {
  if (!project) {
    return null
  }

  return project.quizzes.find((quiz) => quiz.id === project.activeQuizId) ?? project.quizzes[0] ?? null
}

function createEmptyWorkspace(index: number): ProjectDefinition {
  return {
    id: createId('project'),
    name: `Workspace ${index}`,
    slug: toSlug(`workspace-${index}`, `workspace-${Date.now()}`),
    notes: '',
    activeQuizId: '',
    quizzes: [],
  }
}

function createBlankQuiz(name: string, slug: string): QuizDefinition {
  const baseQuiz = createQuizDefinition({ name, slug })

  return {
    ...baseQuiz,
    variants: [],
    leadSteps: [],
    workflow: { startNodeId: '', nodes: [], edges: [] },
  }
}

function isBlankComposerQuiz(quiz: QuizDefinition) {
  return quiz.variants.length === 0 && quiz.leadSteps.length === 0 && quiz.workflow.nodes.length === 0
}

function ComposerElementGlyph({ elementKey }: { elementKey: string }) {
  switch (elementKey) {
    case 'contact-info':
      return <path d="M6.5 18.5a5.5 5.5 0 0 1 11 0M12 12.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'email':
      return <path d="M4.75 7.5h14.5v9h-14.5zM5.5 8.25 12 13l6.5-4.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'phone-number':
      return <path d="M8.35 5.75c.35-.35 1-.35 1.35 0l1.55 1.55c.35.35.35.92.06 1.31l-1.06 1.4a12.38 12.38 0 0 0 3.74 3.74l1.4-1.06c.39-.29.96-.29 1.31.06l1.55 1.55c.35.35.35 1 0 1.35l-1.25 1.25c-.58.58-1.43.83-2.23.67-5.18-1.05-9.34-5.21-10.39-10.39-.16-.8.1-1.65.67-2.23l1.3-1.25Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'address':
      return <path d="M12 20c3.9-4.25 5.85-7.3 5.85-9.2A5.85 5.85 0 1 0 6.15 10.8C6.15 12.7 8.1 15.75 12 20Zm0-7.25a2.35 2.35 0 1 0 0-4.7 2.35 2.35 0 0 0 0 4.7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'website':
    case 'redirect':
      return <path d="M10 7.5h7v7M19 7.5l-8.25 8.25M7.5 10v6.5h6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'multiple-choice':
      return <path d="M8.25 8.5h8.25M8.25 12h8.25M8.25 15.5h8.25M5.6 8.5h.01M5.6 12h.01M5.6 15.5h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'dropdown':
      return <path d="M5.25 7.75h13.5v8.5H5.25zM9.5 11l2.5 2.5 2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'picture-choice':
      return <path d="M5 6.75h14v10.5H5zM8.1 10.1h.01M7.25 15l3.25-3.5 2.4 2.4 2.35-2.65 1.75 3.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'yes-no':
      return <path d="M7 12.5 9.75 15.25 17 8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    case 'legal':
      return <path d="M8 6.5h8l2 2v9H8zM16 6.5v2h2M10 12h6M10 15h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'checkbox':
      return <path d="M6.5 6.5h11v11h-11zM9.2 12l1.7 1.7 3.9-4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'nps':
      return <path d="M6.75 16.75h10.5M8.5 14.25V11.5M12 14.25V8.5M15.5 14.25v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'opinion-scale':
      return <path d="M5.75 15.5h3v-2.5h-3zM10.5 15.5h3v-5h-3zM15.25 15.5h3v-7.5h-3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'rating':
      return <path d="m12 6.5 1.62 3.28 3.63.53-2.62 2.56.62 3.62L12 14.8 8.75 16.5l.62-3.62-2.62-2.56 3.63-.53L12 6.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    case 'ranking':
      return <path d="M9.25 8h8.25M9.25 12h8.25M9.25 16h8.25M6.35 8h.01M6.35 12h.01M6.35 16h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'matrix':
      return <path d="M6.5 6.5h11v11h-11zM6.5 10.17h11M6.5 13.83h11M10.17 6.5v11M13.83 6.5v11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    case 'long-text':
      return <path d="M7 8h10M7 11.5h10M7 15h6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'short-text':
      return <path d="M7.25 12h9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'video':
      return <path d="M5.5 7.5h9.75v9H5.5zM15.25 10.5l3.25-1.75v6.5l-3.25-1.75M9.25 10.5v3l2.75-1.5-2.75-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    case 'clarify-ai':
    case 'faq-ai':
      return <path d="M12 5.75 13.4 9l3.35 1.35L13.4 11.7 12 15l-1.4-3.3-3.35-1.35L10.6 9 12 5.75ZM17.25 14.5l.8 1.85 1.95.8-1.95.8-.8 1.8-.8-1.8-1.9-.8 1.9-.8.8-1.85Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    case 'number':
      return <path d="M8.25 7.25 7 16.75M13.5 7.25l-1.25 9.5M6 10.25h10.5M5.5 13.75H16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    case 'date':
      return <path d="M7 6.75v2.5M17 6.75v2.5M6 9.25h12M6.5 7.75h11a.5.5 0 0 1 .5.5v9.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-9.5a.5.5 0 0 1 .5-.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'signature':
      return <path d="M6 15.25c2.1 0 2.9-5 5.1-5 1.05 0 .95 2 .3 3.2 1.5-1.85 2.75-2.7 3.8-2.7 1.35 0 1.75 1.05 1.75 2.1 0 .8-.2 1.55-.6 2.4M5.75 18h12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    case 'payment':
      return <path d="M5.5 8h13v8h-13zM5.5 10.75h13M8 14h2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'file-upload':
      return <path d="M8 6.5h6l2 2v9H8zM14 6.5v2h2M12 15.75v-5M9.9 12.85 12 10.75l2.1 2.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'google-drive':
      return <path d="m10.35 6.75 2.1 0 3.95 6.75-1.95 3.5H9.55L7.6 13.5l2.75-4.75Zm-.8 10.25h4.9M8.45 13.5h7.9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    case 'calendly':
      return <path d="M12 6.25a5.75 5.75 0 1 0 5.75 5.75M12 6.25A5.75 5.75 0 0 1 17.75 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'welcome-screen':
      return <path d="M5.5 7.5h13v9h-13zM8.25 10.5h7.5M8.25 13.5h4.25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'statement':
      return <path d="M7 9.25h10M7 12h10M7 14.75h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'question-group':
      return <path d="M6.75 8.5h10.5M6.75 12h10.5M6.75 15.5h6.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    case 'end-screen':
      return <path d="M7.5 16.5h9M8.75 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    default:
      return <circle cx="12" cy="12" r="3.25" fill="currentColor" />
  }
}

function ComposerElementIcon({ color, elementKey, label }: { color: string; elementKey: string; label: string }) {
  return (
    <span className={`admin-v2-element-icon is-${color}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" aria-label={label} role="img">
        <ComposerElementGlyph elementKey={elementKey} />
      </svg>
    </span>
  )
}

function CrmIcon({ provider }: { provider: 'hubspot' | 'salesforce' }) {
  if (provider === 'hubspot') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.4" fill="currentColor" />
        <circle cx="19.1" cy="6" r="2.1" fill="currentColor" />
        <circle cx="18.3" cy="18.2" r="2.1" fill="currentColor" />
        <circle cx="7.1" cy="4.5" r="1.8" fill="currentColor" />
        <path d="M12 4.2v3.3M15.2 10l2.2-2.1M13.8 14.7l3 1.6M8.7 8.4 7.6 6.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.9 14.7c0-2.2 1.8-4 4-4 .6-2.2 2.7-3.8 5.1-3.8 2.9 0 5.2 2.2 5.2 5.1 0 .3 0 .6-.1.9 1.4.3 2.4 1.6 2.4 3.1 0 1.8-1.4 3.3-3.2 3.3H8.3a3.8 3.8 0 0 1-3.8-3.8c0-1.7 1-3.1 2.4-3.8Z" fill="currentColor" />
    </svg>
  )
}

function BuilderDesignIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5.5a6.5 6.5 0 1 0 0 13h1.5a2.5 2.5 0 0 0 0-5h-.4a1.35 1.35 0 0 1 0-2.7h.75a2.55 2.55 0 0 0 0-5.1H12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.1" cy="11.2" r="1" fill="currentColor" />
      <circle cx="10.5" cy="8.55" r="1" fill="currentColor" />
      <circle cx="14.2" cy="8.9" r="1" fill="currentColor" />
      <circle cx="15.8" cy="12.3" r="1" fill="currentColor" />
    </svg>
  )
}

function BuilderPanelIcon({ kind }: { kind: 'mobile' | 'desktop' | 'preview' | 'logic' | 'translate' | 'settings' | 'spark' | 'grid' | 'close' | 'image' | 'upload' | 'trash' | 'logo' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (kind) {
    case 'mobile':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4.5" width="8" height="15" rx="2.2" {...common} /><path d="M11 16.5h2" {...common} /></svg>
    case 'desktop':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="6" width="15" height="10" rx="1.8" {...common} /><path d="M9 19h6" {...common} /></svg>
    case 'preview':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z" {...common} /></svg>
    case 'logic':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="7" r="2.1" {...common} /><circle cx="17" cy="7" r="2.1" {...common} /><circle cx="12" cy="17" r="2.1" {...common} /><path d="M8.8 8.2 11 15M15.2 8.2 13 15" {...common} /></svg>
    case 'translate':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 7.5h9M10 7.5c0 4.2-2.2 7.5-5 9.5M8.25 11.5c1.1 1.45 2.5 2.75 4.25 3.85M15 8.5h4l-2 8m-1.05-3h2.1" {...common} /></svg>
    case 'settings':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" {...common} /><path d="M12 4.75v2.1M12 17.15v2.1M19.25 12h-2.1M6.85 12h-2.1M17.13 6.87l-1.48 1.48M8.35 15.65l-1.48 1.48M17.13 17.13l-1.48-1.48M8.35 8.35 6.87 6.87" {...common} /></svg>
    case 'spark':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5 13.4 9l3.6 1.4-3.6 1.35L12 15.25l-1.4-3.5L7 10.4 10.6 9 12 5.5ZM17.5 15l.75 1.7L20 17.45l-1.75.75-.75 1.8-.75-1.8-1.75-.75 1.75-.75.75-1.7Z" {...common} /></svg>
    case 'grid':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01" {...common} /></svg>
    case 'close':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" {...common} /></svg>
    case 'image':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5.5" width="15" height="13" rx="2" {...common} /><path d="M8 10h.01M7 16l3.3-3.2 2.4 2.2 2.9-3.1 1.4 4.1" {...common} /></svg>
    case 'upload':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V8M8.8 11.2 12 8l3.2 3.2M6 18.5h12" {...common} /></svg>
    case 'trash':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7.5h8M9 7.5V6h6v1.5M8.2 9.5l.7 8h6.2l.7-8" {...common} /></svg>
    case 'logo':
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17V7l5 5 5-5v10" {...common} /></svg>
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" {...common} /></svg>
  }
}

function getBuilderAnswerTypeKey(selection: BuilderSelection | null, selectedQuestion: Question | null, selectedLeadStep: LeadStep | null) {
  if (!selection) {
    return 'multiple-choice'
  }

  if (selection.kind === 'question' && selectedQuestion) {
    return getQuestionElementKey(selectedQuestion)
  }

  if (selection.kind === 'lead' && selectedLeadStep) {
    if (selectedLeadStep.builderElementKey) {
      return selectedLeadStep.builderElementKey
    }

    if (selectedLeadStep.kind === 'email') {
      return 'email'
    }

    if (selectedLeadStep.kind === 'phone') {
      return 'phone-number'
    }

    if (selectedLeadStep.kind === 'single') {
      return 'multiple-choice'
    }

    return 'short-text'
  }

  if (selection.kind === 'intro') {
    return 'welcome-screen'
  }

  return 'multiple-choice'
}

export function AdminV2App() {
  const [isUnlocked, setIsUnlocked] = useState(getAdminSession())
  const [isBooting, setIsBooting] = useState(hasSupabaseConfig)
  const [isSaving, setIsSaving] = useState(false)
  const [email, setEmail] = useState(() => String(import.meta.env.VITE_ADMIN_EMAIL ?? 'contact@neptunys.com'))
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(getAdminRememberPreference())
  const [loginError, setLoginError] = useState('')
  const [section, setSection] = useState<AdminSection>('forms')
  const [builderTab, setBuilderTab] = useState<BuilderTab>('content')
  const [formsViewMode, setFormsViewMode] = useState<FormsViewMode>('list')
  const [formsSort, setFormsSort] = useState<FormsSort>('date-created')
  const [formsSortMenuOpen, setFormsSortMenuOpen] = useState(false)
  const [formsSearchQuery, setFormsSearchQuery] = useState('')
  const [formsSearchOpen, setFormsSearchOpen] = useState(false)
  const [formActionMenuQuizId, setFormActionMenuQuizId] = useState<string | null>(null)
  const [quizActionModal, setQuizActionModal] = useState<QuizActionModal>(null)
  const [quizActionQuizId, setQuizActionQuizId] = useState<string | null>(null)
  const [quizActionName, setQuizActionName] = useState('')
  const [quizActionTargetProjectId, setQuizActionTargetProjectId] = useState('')
  const [projects, setProjects] = useState<ProjectDefinition[]>(() => getProjectRegistry())
  const [selectedProjectId, setSelectedProjectId] = useState(() => getProjectRegistry()[0]?.id ?? '')
  const [selectedQuizId, setSelectedQuizId] = useState(() => getProjectRegistry()[0] ? getActiveQuiz(getProjectRegistry()[0])?.id ?? '' : '')
  const [openedQuizId, setOpenedQuizId] = useState<string | null>(null)
  const [selection, setSelection] = useState<BuilderSelection | null>(null)
  const [automationCreateOpen, setAutomationCreateOpen] = useState(false)
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false)
  const [workspaceModalMode, setWorkspaceModalMode] = useState<'create' | 'rename'>('create')
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [automationRefreshKey, setAutomationRefreshKey] = useState(0)
  const [contactAddMenuOpen, setContactAddMenuOpen] = useState(false)
  const [contactModal, setContactModal] = useState<ContactModal>(null)
  const [contactListFieldMenuOpen, setContactListFieldMenuOpen] = useState(false)
  const [contactListName, setContactListName] = useState('')
  const [selectedContactFilterField, setSelectedContactFilterField] = useState('')
  const [automationCategory, setAutomationCategory] = useState<AutomationCategory>('contact-updates')
  const [automationComposerStep, setAutomationComposerStep] = useState<AutomationComposerStep>('idle')
  const [automationWorkspaceSelectOpen, setAutomationWorkspaceSelectOpen] = useState(false)
  const [automationFormSelectOpen, setAutomationFormSelectOpen] = useState(false)
  const [automationWorkspaceId, setAutomationWorkspaceId] = useState('')
  const [automationQuizId, setAutomationQuizId] = useState('')
  const [automationEditor, setAutomationEditor] = useState<ProjectAutomation | null>(null)
  const [selectedWorkflowNodeId, setSelectedWorkflowNodeId] = useState<string | null>(null)
  const [selectedWorkflowEdgeId, setSelectedWorkflowEdgeId] = useState<string | null>(null)
  const [selectedConnectAutomationId, setSelectedConnectAutomationId] = useState<string | null>(null)
  const [selectedConnectNodeId, setSelectedConnectNodeId] = useState<string | null>(null)
  const [selectedConnectEdgeId, setSelectedConnectEdgeId] = useState<string | null>(null)
  const [builderGraphDragState, setBuilderGraphDragState] = useState<BuilderGraphDragState | null>(null)
  const [builderGraphPreviewPositions, setBuilderGraphPreviewPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [newFormCanvasMode, setNewFormCanvasMode] = useState<NewFormCanvasMode>('builder')
  const [newFormComposerTab, setNewFormComposerTab] = useState<NewFormComposerTab>('elements')
  const [newFormLibraryOpen, setNewFormLibraryOpen] = useState(false)
  const [newFormLibraryQuery, setNewFormLibraryQuery] = useState('')
  const [newFormAiPrompt, setNewFormAiPrompt] = useState('')
  const [builderMode, setBuilderMode] = useState<BuilderModeKey>('universal')
  const [builderModeMenuOpen, setBuilderModeMenuOpen] = useState(false)
  const [builderDevice, setBuilderDevice] = useState<BuilderDevice>('desktop')
  const [builderToolPanel, setBuilderToolPanel] = useState<BuilderToolPanel | null>(null)
  const [builderLocale, setBuilderLocale] = useState<BuilderLocale>('en-GB')
  const [builderEndingsMenuOpen, setBuilderEndingsMenuOpen] = useState(false)
  const [builderAnswerMenuOpen, setBuilderAnswerMenuOpen] = useState(false)
  const [builderAnswerTypeKey, setBuilderAnswerTypeKey] = useState('multiple-choice')
  const [builderPageMenuOpen, setBuilderPageMenuOpen] = useState<string | null>(null)
  const [builderToggleState, setBuilderToggleState] = useState<Record<string, Record<BuilderToggleKey, boolean>>>({})
  const [builderRailSplit, setBuilderRailSplit] = useState(0.62)
  const [builderRailResizeActive, setBuilderRailResizeActive] = useState(false)
  const [builderDesignOpen, setBuilderDesignOpen] = useState(false)
  const [builderDesignView, setBuilderDesignView] = useState<BuilderDesignView>('library')
  const [builderThemeEditorTab, setBuilderThemeEditorTab] = useState<BuilderThemeEditorTab>('logo')
  const [builderThemeDraft, setBuilderThemeDraft] = useState<BuilderTheme | null>(null)
  const [builderThemeSavedSnapshot, setBuilderThemeSavedSnapshot] = useState<BuilderTheme | null>(null)
  const [builderThemeCloseConfirmOpen, setBuilderThemeCloseConfirmOpen] = useState(false)
  const [builderThemeMenuId, setBuilderThemeMenuId] = useState<string | null>(null)
  const [builderThemeSaveState, setBuilderThemeSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const builderRailSplitRef = useRef<HTMLDivElement | null>(null)
  const builderLogoInputRef = useRef<HTMLInputElement | null>(null)
  const builderBackgroundInputRef = useRef<HTMLInputElement | null>(null)
  const builderThemeSaveFeedbackTimeoutRef = useRef<number | null>(null)

  const isBuilderThemeDirty = useMemo(() => {
    if (!builderThemeDraft || !builderThemeSavedSnapshot) {
      return false
    }

    return JSON.stringify(builderThemeDraft) !== JSON.stringify(builderThemeSavedSnapshot)
  }, [builderThemeDraft, builderThemeSavedSnapshot])

  useEffect(() => {
    if (!builderRailResizeActive) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rail = builderRailSplitRef.current
      if (!rail) {
        return
      }

      const rect = rail.getBoundingClientRect()
      if (!rect.height) {
        return
      }

      const nextSplit = (event.clientY - rect.top) / rect.height
      setBuilderRailSplit(Math.min(0.82, Math.max(0.2, nextSplit)))
    }

    const stopResize = () => {
      setBuilderRailResizeActive(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [builderRailResizeActive])

  useEffect(() => {
    return () => {
      if (builderThemeSaveFeedbackTimeoutRef.current) {
        window.clearTimeout(builderThemeSaveFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isBuilderThemeDirty && builderThemeSaveState === 'saved') {
      setBuilderThemeSaveState('idle')
    }
  }, [builderThemeSaveState, isBuilderThemeDirty])

  const filteredNewFormSections = useMemo(() => {
    const query = newFormLibraryQuery.trim().toLowerCase()

    if (!query) {
      return NEW_FORM_ELEMENT_SECTIONS
    }

    return NEW_FORM_ELEMENT_SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label.toLowerCase().includes(query)),
      }))
      .filter((section) => section.items.length > 0)
  }, [newFormLibraryQuery])

  const recommendedNewFormElements = useMemo(
    () => ADD_CONTENT_RECOMMENDED_KEYS
      .map((key) => ALL_NEW_FORM_ELEMENTS.find((item) => item.key === key))
      .filter((item): item is NewFormElement => Boolean(item)),
    [],
  )

  const addContentLibrarySections = useMemo(() => {
    const getItem = (key: string) => ALL_NEW_FORM_ELEMENTS.find((item) => item.key === key) ?? null

    return [
      { title: 'Contact info', items: ['contact-info', 'email', 'phone-number', 'address', 'website'].map(getItem).filter((item): item is NewFormElement => Boolean(item)) },
      { title: 'Choice', items: ['multiple-choice', 'dropdown', 'picture-choice', 'yes-no', 'legal', 'checkbox'].map(getItem).filter((item): item is NewFormElement => Boolean(item)) },
      { title: 'Rating & ranking', items: ['nps', 'opinion-scale', 'rating', 'ranking', 'matrix'].map(getItem).filter((item): item is NewFormElement => Boolean(item)) },
      { title: 'Text & Video', items: ['long-text', 'short-text', 'video', 'clarify-ai', 'faq-ai'].map(getItem).filter((item): item is NewFormElement => Boolean(item)) },
      { title: 'Other', items: ['number', 'date', 'signature', 'payment', 'file-upload', 'google-drive', 'calendly'].map(getItem).filter((item): item is NewFormElement => Boolean(item)) },
      { title: '', items: ['welcome-screen', 'statement', 'question-group', 'end-screen', 'redirect'].map(getItem).filter((item): item is NewFormElement => Boolean(item)) },
    ]
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsBooting(false)
      return
    }

    restoreAdminSession()
      .then(async (active) => {
        if (!active) {
          setIsUnlocked(false)
          return
        }

        const remoteProjects = await loadProjectRegistry()
        setProjects(remoteProjects)
        setSelectedProjectId(remoteProjects[0]?.id ?? '')
        setSelectedQuizId(remoteProjects[0] ? getActiveQuiz(remoteProjects[0])?.id ?? '' : '')
        setIsUnlocked(true)
      })
      .finally(() => setIsBooting(false))
  }, [])

  function openBuilderDesignLibrary() {
    setBuilderDesignOpen(true)
    setBuilderDesignView('library')
    setBuilderThemeDraft(null)
    setBuilderThemeSavedSnapshot(null)
    setBuilderThemeCloseConfirmOpen(false)
    setBuilderThemeMenuId(null)
  }

  function getQuizBuilderDesignWithSharedThemes(quiz: QuizDefinition, themes: BuilderTheme[]): QuizBuilderDesign {
    const normalizedThemes = themes.map((theme) => cloneBuilderTheme(theme))
    const fallbackThemeId = normalizedThemes[0]?.id ?? 'theme-default'
    const requestedThemeId = quiz.builderDesign?.activeThemeId ?? fallbackThemeId

    return {
      activeThemeId: normalizedThemes.some((theme) => theme.id === requestedThemeId) ? requestedThemeId : fallbackThemeId,
      themes: normalizedThemes,
    }
  }

  function getSharedBuilderThemePatch(
    mutate: (themes: BuilderTheme[]) => BuilderTheme[],
    selectedQuizActiveThemeId?: string,
  ) {
    if (!selectedQuiz) {
      return null
    }

    const nextThemes = mutate(sharedBuilderThemes.map((theme) => cloneBuilderTheme(theme))).map((theme) => normalizeBuilderTheme(theme))
    const fallbackThemeId = nextThemes[0]?.id ?? 'theme-default'

    const nextProjects = projects.map((project) => ({
      ...project,
      quizzes: project.quizzes.map((quiz) => {
        const nextDesign = getQuizBuilderDesignWithSharedThemes(quiz, nextThemes)
        const requestedThemeId = quiz.id === selectedQuiz.id && selectedQuizActiveThemeId
          ? selectedQuizActiveThemeId
          : nextDesign.activeThemeId

        return {
          ...quiz,
          builderDesign: {
            activeThemeId: nextThemes.some((theme) => theme.id === requestedThemeId) ? requestedThemeId : fallbackThemeId,
            themes: nextThemes.map((theme) => cloneBuilderTheme(theme)),
          },
        }
      }),
    }))

    return {
      nextProjects,
      nextSelectedQuizDesign: {
        activeThemeId: nextThemes.some((theme) => theme.id === (selectedQuizActiveThemeId ?? selectedQuiz.builderDesign?.activeThemeId))
          ? (selectedQuizActiveThemeId ?? selectedQuiz.builderDesign?.activeThemeId ?? fallbackThemeId)
          : fallbackThemeId,
        themes: nextThemes,
      } satisfies QuizBuilderDesign,
    }
  }

  function updateSelectedQuizActiveTheme(themeId: string) {
    if (!selectedQuiz) {
      return null
    }

    const patch = getSharedBuilderThemePatch((themes) => themes, themeId)
    if (!patch) {
      return null
    }

    void persistProjects(patch.nextProjects)
    return patch.nextSelectedQuizDesign
  }

  function applySharedThemesToQuiz(quiz: QuizDefinition, preferredThemeId?: string) {
    const nextDesign = getQuizBuilderDesignWithSharedThemes(quiz, sharedBuilderThemes)
    const activeThemeId = sharedBuilderThemes.some((theme) => theme.id === preferredThemeId)
      ? preferredThemeId ?? nextDesign.activeThemeId
      : nextDesign.activeThemeId

    return {
      ...quiz,
      builderDesign: {
        activeThemeId,
        themes: sharedBuilderThemes.map((theme) => cloneBuilderTheme(theme)),
      },
    }
  }

  function openBuilderThemeEditor(theme: BuilderTheme) {
    const snapshot = cloneBuilderTheme(theme)
    setBuilderDesignOpen(true)
    setBuilderDesignView('editor')
    setBuilderThemeEditorTab('logo')
    setBuilderThemeDraft(snapshot)
    setBuilderThemeSavedSnapshot(snapshot)
    setBuilderThemeCloseConfirmOpen(false)
    setBuilderThemeMenuId(null)
    setBuilderThemeSaveState('idle')
  }

  function handleCreateBuilderTheme() {
    openBuilderThemeEditor(createBuilderTheme(createId('theme'), 'My new theme', 'mine', { preview: 'linear-gradient(180deg, #d8d2cc 0%, #d8d2cc 100%)' }))
  }

  function closeBuilderDesign() {
    if (isBuilderThemeDirty) {
      setBuilderThemeCloseConfirmOpen(true)
      return
    }

    setBuilderDesignOpen(false)
    setBuilderDesignView('library')
    setBuilderThemeDraft(null)
    setBuilderThemeSavedSnapshot(null)
    setBuilderThemeCloseConfirmOpen(false)
    setBuilderThemeMenuId(null)
  }

  function updateBuilderThemeDraft(mutate: (theme: BuilderTheme) => BuilderTheme) {
    setBuilderThemeDraft((current) => (current ? mutate(current) : current))
  }

  async function readImageAsDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  async function handleBuilderThemeFileChange(event: ChangeEvent<HTMLInputElement>, target: 'logo' | 'background') {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const dataUrl = await readImageAsDataUrl(file)

    updateBuilderThemeDraft((theme) => ({
      ...theme,
      logoImage: target === 'logo' ? dataUrl : theme.logoImage,
      backgroundImage: target === 'background' ? dataUrl : theme.backgroundImage,
      backgroundImageThumb: target === 'background' ? dataUrl : theme.backgroundImageThumb,
    }))

    if (target === 'background') {
      setBuilderDesignView('editor')
      setBuilderThemeEditorTab('background')
    }

    event.target.value = ''
  }

  function resetBuilderThemeSaveFeedback(delay = 1600) {
    if (builderThemeSaveFeedbackTimeoutRef.current) {
      window.clearTimeout(builderThemeSaveFeedbackTimeoutRef.current)
    }

    builderThemeSaveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setBuilderThemeSaveState('idle')
      builderThemeSaveFeedbackTimeoutRef.current = null
    }, delay)
  }

  async function saveBuilderTheme() {
    if (!builderThemeDraft) {
      return
    }

    const nextTheme = cloneBuilderTheme(builderThemeDraft)
    setBuilderThemeSaveState('saving')

    const patch = getSharedBuilderThemePatch((themes) => {
      const existing = themes.some((theme) => theme.id === nextTheme.id)
      return existing
        ? themes.map((theme) => theme.id === nextTheme.id ? nextTheme : theme)
        : [nextTheme, ...themes]
    }, nextTheme.id)

    const nextDesign = patch?.nextSelectedQuizDesign ?? null

    if (patch) {
      await persistProjects(patch.nextProjects)
    }

    if (!nextDesign) {
      setBuilderThemeSaveState('idle')
      return
    }

    setBuilderThemeSavedSnapshot(nextTheme)
    setBuilderThemeDraft(nextTheme)
    setBuilderDesignView('editor')
    setBuilderThemeMenuId(null)
    setBuilderThemeSaveState('saved')
    resetBuilderThemeSaveFeedback()
  }

  function revertBuilderTheme() {
    if (!builderThemeSavedSnapshot) {
      return
    }

    setBuilderThemeDraft(cloneBuilderTheme(builderThemeSavedSnapshot))
    setBuilderThemeSaveState('idle')
  }

  function discardBuilderThemeChanges() {
    setBuilderThemeDraft(builderThemeSavedSnapshot ? cloneBuilderTheme(builderThemeSavedSnapshot) : null)
    setBuilderThemeCloseConfirmOpen(false)
    setBuilderDesignOpen(false)
    setBuilderDesignView('library')
    setBuilderThemeMenuId(null)
    setBuilderThemeSaveState('idle')
  }

  async function confirmBuilderThemeSaveAndClose() {
    await saveBuilderTheme()
    setBuilderThemeCloseConfirmOpen(false)
    setBuilderDesignOpen(false)
    setBuilderDesignView('library')
    setBuilderThemeMenuId(null)
  }

  async function handleRenameBuilderTheme(theme: BuilderTheme) {
    const nextName = window.prompt('Rename theme', theme.name)?.trim()
    setBuilderThemeMenuId(null)

    if (!nextName || nextName === theme.name) {
      return
    }

    const patch = getSharedBuilderThemePatch((themes) => (
      themes.map((item) => item.id === theme.id ? { ...item, name: nextName } : item)
    ))

    if (patch) {
      await persistProjects(patch.nextProjects)
    }

    if (builderThemeDraft?.id === theme.id) {
      const nextTheme = { ...builderThemeDraft, name: nextName }
      setBuilderThemeDraft(nextTheme)
      setBuilderThemeSavedSnapshot(nextTheme)
    }
  }

  async function handleDuplicateBuilderTheme(theme: BuilderTheme) {
    const duplicate = {
      ...cloneBuilderTheme(theme),
      id: createId('theme'),
      name: `${theme.name} copy`,
      source: 'mine' as const,
    }

    const patch = getSharedBuilderThemePatch((themes) => [duplicate, ...themes], duplicate.id)
    const nextDesign = patch?.nextSelectedQuizDesign ?? null

    if (patch) {
      await persistProjects(patch.nextProjects)
    }

    setBuilderThemeMenuId(null)

    if (!nextDesign) {
      return
    }

    openBuilderThemeEditor(duplicate)
  }

  async function handleDeleteBuilderTheme(theme: BuilderTheme) {
    const remainingThemes = builderThemeConfig.themes.filter((item) => item.id !== theme.id)
    setBuilderThemeMenuId(null)

    if (!remainingThemes.length || !window.confirm(`Delete ${theme.name}?`)) {
      return
    }

    const nextActiveThemeId = builderThemeConfig.activeThemeId === theme.id
      ? remainingThemes[0]?.id ?? builderThemeConfig.activeThemeId
      : builderThemeConfig.activeThemeId

    const patch = getSharedBuilderThemePatch(() => remainingThemes, nextActiveThemeId)

    if (patch) {
      await persistProjects(patch.nextProjects)
    }
  }

  const selectedProject = useMemo(
    () => (projects.length ? getProjectById(projects, selectedProjectId || projects[0].id) : null),
    [projects, selectedProjectId],
  )

  const selectedQuiz = useMemo(() => {
    if (!selectedProject) {
      return null
    }

    return selectedProject.quizzes.find((quiz) => quiz.id === (openedQuizId ?? selectedQuizId)) ?? getWorkspaceActiveQuiz(selectedProject)
  }, [openedQuizId, selectedProject, selectedQuizId])

  const sharedBuilderThemes = useMemo<BuilderTheme[]>(() => {
    const seen = new Set<string>()
    const mergedThemes: BuilderTheme[] = []

    for (const project of projects) {
      for (const quiz of project.quizzes) {
        for (const theme of quiz.builderDesign?.themes ?? []) {
          const normalizedTheme = normalizeBuilderTheme(theme)
          if (seen.has(normalizedTheme.id)) {
            continue
          }

          seen.add(normalizedTheme.id)
          mergedThemes.push(cloneBuilderTheme(normalizedTheme))
        }
      }
    }

    return mergedThemes.length
      ? mergedThemes
      : BUILDER_THEME_LIBRARY.map((theme) => cloneBuilderTheme(theme))
  }, [projects])

  const builderThemeConfig = useMemo<QuizBuilderDesign>(() => (
    selectedQuiz
      ? getQuizBuilderDesignWithSharedThemes(selectedQuiz, sharedBuilderThemes)
      : {
          activeThemeId: sharedBuilderThemes[0]?.id ?? 'theme-default',
          themes: sharedBuilderThemes,
        }
  ), [selectedQuiz, sharedBuilderThemes])

  const activeBuilderTheme = useMemo(() => {
    if (builderThemeDraft) {
      return builderThemeDraft
    }

    return builderThemeConfig.themes.find((theme) => theme.id === builderThemeConfig.activeThemeId) ?? builderThemeConfig.themes[0]
  }, [builderThemeConfig, builderThemeDraft])

  const builderPreviewStyles = useMemo(() => {
    if (!activeBuilderTheme) {
      return {
        cardStyle: {},
        bodyStyle: {},
        titleStyle: {},
        descriptionStyle: {},
        choiceStyle: {},
        multipleChoiceStyle: {},
        choiceBadgeStyle: {},
        multipleChoiceBadgeStyle: {},
        addChoiceStyle: {},
        buttonStyle: {},
        secondaryButtonStyle: {},
        fieldStyle: {},
        logoWrapStyle: {},
        logoStyle: {},
      }
    }

    const radiusMap = { none: '0px', soft: '10px', pill: '999px' } satisfies Record<BuilderThemeCornerRadius, string>
    const fontMap = { sm: '1rem', md: '1.24rem', lg: '1.55rem' }
    const alignMap = { left: 'left', center: 'center', right: 'right' } satisfies Record<BuilderThemeAlign, CSSProperties['textAlign']>
    const overlayOpacity = Math.max(0, Math.min(0.68, 0.26 + Math.max(0, -activeBuilderTheme.backgroundBrightness) / 100))
    const backgroundLayers = activeBuilderTheme.backgroundImage
      ? `linear-gradient(rgba(4, 7, 10, ${overlayOpacity}), rgba(4, 7, 10, ${overlayOpacity})), url(${activeBuilderTheme.backgroundImage})`
      : `linear-gradient(180deg, ${activeBuilderTheme.backgroundColor} 0%, ${activeBuilderTheme.backgroundColor} 100%)`
    const fieldBorder = `color-mix(in srgb, ${activeBuilderTheme.textColor} 34%, transparent 66%)`
    const fieldBackground = activeBuilderTheme.answerColor
    const offsetX = builderDevice === 'desktop' ? activeBuilderTheme.contentOffsetX : 0
    const logoInset = builderDevice === 'mobile' ? '8px' : '4px'
    const logoPositionStyle = activeBuilderTheme.logoAlign === 'center'
      ? {
          left: '50%',
          transform: 'translateX(-50%)',
        }
      : activeBuilderTheme.logoAlign === 'right'
        ? {
            right: logoInset,
          }
        : {
            left: logoInset,
          }

    return {
      cardStyle: {
        backgroundColor: activeBuilderTheme.backgroundColor,
        backgroundImage: backgroundLayers,
        backgroundSize: activeBuilderTheme.backgroundImage ? 'cover' : undefined,
        backgroundPosition: 'center',
        color: activeBuilderTheme.textColor,
        fontFamily: activeBuilderTheme.fontFamily,
      } satisfies CSSProperties,
      titleStyle: {
        color: activeBuilderTheme.textColor,
        fontSize: fontMap[activeBuilderTheme.questionSize],
        textAlign: alignMap[activeBuilderTheme.questionAlign],
      } satisfies CSSProperties,
      bodyStyle: {
        transform: offsetX === 0 ? undefined : `translateX(${offsetX}px)`,
      } satisfies CSSProperties,
      descriptionStyle: {
        color: activeBuilderTheme.textColor,
        opacity: 0.74,
        lineHeight: 1.15,
        textAlign: alignMap[activeBuilderTheme.questionAlign],
      } satisfies CSSProperties,
      choiceStyle: {
        background: activeBuilderTheme.answerColor,
        borderColor: activeBuilderTheme.answerColor,
        color: activeBuilderTheme.textColor,
        borderRadius: radiusMap[activeBuilderTheme.cornerRadius],
      } satisfies CSSProperties,
      multipleChoiceStyle: {
        background: 'transparent',
        borderColor: `color-mix(in srgb, ${activeBuilderTheme.textColor} 42%, transparent 58%)`,
        color: activeBuilderTheme.textColor,
        borderRadius: radiusMap[activeBuilderTheme.cornerRadius],
      } satisfies CSSProperties,
      choiceBadgeStyle: {
        borderColor: 'rgba(255,255,255,0.34)',
        color: activeBuilderTheme.textColor,
        borderRadius: radiusMap[activeBuilderTheme.cornerRadius],
      } satisfies CSSProperties,
      multipleChoiceBadgeStyle: {
        borderColor: `color-mix(in srgb, ${activeBuilderTheme.textColor} 48%, transparent 52%)`,
        background: 'transparent',
        color: activeBuilderTheme.textColor,
        borderRadius: radiusMap[activeBuilderTheme.cornerRadius],
      } satisfies CSSProperties,
      addChoiceStyle: {
        color: activeBuilderTheme.textColor,
      } satisfies CSSProperties,
      buttonStyle: {
        background: activeBuilderTheme.buttonColor,
        color: activeBuilderTheme.buttonTextColor,
        borderRadius: radiusMap[activeBuilderTheme.cornerRadius],
      } satisfies CSSProperties,
      secondaryButtonStyle: {
        background: 'rgba(255,255,255,0.08)',
        color: activeBuilderTheme.textColor,
        borderRadius: radiusMap[activeBuilderTheme.cornerRadius],
      } satisfies CSSProperties,
      fieldStyle: {
        background: fieldBackground,
        border: `1px solid ${fieldBorder}`,
        color: activeBuilderTheme.textColor,
        borderRadius: '0px',
      } satisfies CSSProperties,
      logoWrapStyle: {
        top: logoInset,
        width: 'fit-content',
        maxWidth: `calc(100% - (${logoInset} * 2))`,
        ...logoPositionStyle,
      } satisfies CSSProperties,
      logoStyle: {
        width: `${activeBuilderTheme.logoSize}px`,
        height: `${activeBuilderTheme.logoSize}px`,
      } satisfies CSSProperties,
    }
  }, [activeBuilderTheme, builderDevice])

  const formsInWorkspace = selectedProject?.quizzes ?? []
  const automationsByProject = useMemo(() => getAutomationRegistry(projects), [projects, automationRefreshKey])
  const selectedAutomations = selectedProject ? automationsByProject[selectedProject.id] ?? [] : []
  const selectedQuizAutomations = useMemo(
    () => selectedAutomations.filter((automation) => automation.quizId === selectedQuiz?.id),
    [selectedAutomations, selectedQuiz],
  )
  const automationInsights = useMemo(
    () => (selectedProject ? getProjectAutomationInsights(selectedProject, selectedAutomations) : null),
    [selectedAutomations, selectedProject],
  )
  const totalQuizCount = useMemo(() => projects.reduce((total, project) => total + project.quizzes.length, 0), [projects])
  const liveQuizCount = useMemo(() => projects.reduce((total, project) => total + project.quizzes.filter((quiz) => quiz.status === 'published').length, 0), [projects])
  const visibleForms = useMemo(() => {
    const filteredForms = formsInWorkspace.filter((quiz) => quiz.name.toLowerCase().includes(formsSearchQuery.trim().toLowerCase()))
    return [...filteredForms].sort((left, right) => {
      if (formsSort === 'alphabetical') {
        return left.name.localeCompare(right.name)
      }

      const leftTimestamp = getQuizTimestamp(left)
      const rightTimestamp = getQuizTimestamp(right)

      if (formsSort === 'last-updated') {
        return rightTimestamp - leftTimestamp
      }

      return rightTimestamp - leftTimestamp
    })
  }, [formsInWorkspace, formsSearchQuery, formsSort])

  const selectedVariant = useMemo(() => {
    if (!selectedQuiz || !selection) {
      return selectedQuiz?.variants[0] ?? null
    }

    if (selection.kind === 'intro' || selection.kind === 'question') {
      return selectedQuiz.variants.find((variant) => variant.id === selection.variantId) ?? selectedQuiz.variants[0] ?? null
    }

    return selectedQuiz.variants[0] ?? null
  }, [selectedQuiz, selection])

  const selectedQuestion = useMemo(() => {
    if (!selectedVariant || !selection || selection.kind !== 'question') {
      return null
    }

    return selectedVariant.questions.find((question) => question.id === selection.questionId) ?? null
  }, [selectedVariant, selection])

  const selectedLeadStep = useMemo(() => {
    if (!selectedQuiz || !selection || selection.kind !== 'lead') {
      return null
    }

    return selectedQuiz.leadSteps.find((step) => step.id === selection.stepId) ?? null
  }, [selectedQuiz, selection])

  const selectedContentWorkflowNode = useMemo(() => {
    if (!selectedQuiz || !selection) {
      return null
    }

    return selectedQuiz.workflow.nodes.find((node) => isBuilderSelectionEqual(getBuilderSelectionFromWorkflowNode(node), selection)) ?? null
  }, [selectedQuiz, selection])

  const selectedMetrics = useMemo(() => (selectedQuiz ? getDashboardMetricsForQuiz(selectedQuiz) : null), [selectedQuiz])

  const workflowCanvasNodes = useMemo(
    () => selectedQuiz?.workflow.nodes.map((node) => ({
      ...node,
      position: builderGraphPreviewPositions[`workflow:${node.id}`] ?? node.position,
    })) ?? [],
    [builderGraphPreviewPositions, selectedQuiz],
  )

  const selectedWorkflowNode = useMemo(
    () => selectedQuiz?.workflow.nodes.find((node) => node.id === selectedWorkflowNodeId) ?? null,
    [selectedQuiz, selectedWorkflowNodeId],
  )

  const selectedWorkflowEdge = useMemo(
    () => selectedQuiz?.workflow.edges.find((edge) => edge.id === selectedWorkflowEdgeId) ?? null,
    [selectedQuiz, selectedWorkflowEdgeId],
  )

  const selectedConnectAutomation = useMemo(
    () => selectedQuizAutomations.find((automation) => automation.id === selectedConnectAutomationId) ?? selectedQuizAutomations[0] ?? null,
    [selectedConnectAutomationId, selectedQuizAutomations],
  )

  const connectCanvasNodes = useMemo(
    () => selectedConnectAutomation?.nodes.map((node) => ({
      ...node,
      position: builderGraphPreviewPositions[`connect:${node.id}`] ?? node.position,
    })) ?? [],
    [builderGraphPreviewPositions, selectedConnectAutomation],
  )

  const selectedConnectNode = useMemo(
    () => selectedConnectAutomation?.nodes.find((node) => node.id === selectedConnectNodeId) ?? selectedConnectAutomation?.nodes[0] ?? null,
    [selectedConnectAutomation, selectedConnectNodeId],
  )

  const selectedConnectEdge = useMemo(
    () => selectedConnectAutomation?.edges.find((edge) => edge.id === selectedConnectEdgeId) ?? null,
    [selectedConnectAutomation, selectedConnectEdgeId],
  )

  const selectedAnswerType = useMemo(
    () => BUILDER_ANSWER_OPTIONS.find((item) => item.key === builderAnswerTypeKey) ?? BUILDER_ANSWER_OPTIONS[0],
    [builderAnswerTypeKey],
  )

  const currentSelectionStorageKey = useMemo(() => {
    if (!selection) {
      return 'global'
    }

    if (selection.kind === 'question') {
      return `question:${selection.questionId}`
    }

    if (selection.kind === 'lead') {
      return `lead:${selection.stepId}`
    }

    return `selection:${selection.kind}`
  }, [selection])

  const currentBuilderToggles = useMemo(() => {
    const stored = builderToggleState[currentSelectionStorageKey]
    return {
      ...DEFAULT_BUILDER_TOGGLES,
      ...stored,
    }
  }, [builderToggleState, currentSelectionStorageKey])

  const builderPreviewCopy = BUILDER_PREVIEW_COPY[builderLocale]
  const selectedQuestionElementKey = selectedQuestion ? getQuestionElementKey(selectedQuestion) : builderAnswerTypeKey
  const selectedLeadElementKey = selectedLeadStep ? getLeadElementKey(selectedLeadStep) : builderAnswerTypeKey

  useEffect(() => {
    if (!selectedProject) {
      return
    }

    if (!selectedProject.quizzes.some((quiz) => quiz.id === selectedQuizId)) {
      const nextQuiz = getWorkspaceActiveQuiz(selectedProject)
      setSelectedQuizId(nextQuiz?.id ?? '')
    }
  }, [selectedProject, selectedQuizId])

  useEffect(() => {
    if (!selectedQuiz) {
      setSelection(null)
      setBuilderToolPanel(null)
      return
    }

    setSelection((current) => current ?? createDefaultSelection(selectedQuiz))
  }, [selectedQuiz])

  useEffect(() => {
    setBuilderAnswerTypeKey(getBuilderAnswerTypeKey(selection, selectedQuestion, selectedLeadStep))
  }, [selection, selectedLeadStep, selectedQuestion])

  useEffect(() => {
    if (!selectedQuiz?.workflow.nodes.length) {
      setSelectedWorkflowNodeId(null)
      return
    }

    setSelectedWorkflowNodeId((current) => (
      current && selectedQuiz.workflow.nodes.some((node) => node.id === current)
        ? current
        : selectedQuiz.workflow.startNodeId || selectedQuiz.workflow.nodes[0]?.id || null
    ))
  }, [selectedQuiz])

  useEffect(() => {
    if (!selectedQuiz?.workflow.edges.length) {
      setSelectedWorkflowEdgeId(null)
      return
    }

    const preferredEdgeId = selectedWorkflowNode
      ? selectedQuiz.workflow.edges.find((edge) => edge.source === selectedWorkflowNode.id)?.id
      : selectedQuiz.workflow.edges[0]?.id

    setSelectedWorkflowEdgeId((current) => (
      current && selectedQuiz.workflow.edges.some((edge) => edge.id === current)
        ? current
        : preferredEdgeId ?? null
    ))
  }, [selectedQuiz, selectedWorkflowNode])

  useEffect(() => {
    setSelectedConnectAutomationId((current) => (
      current && selectedQuizAutomations.some((automation) => automation.id === current)
        ? current
        : selectedQuizAutomations[0]?.id ?? null
    ))
  }, [selectedQuizAutomations])

  useEffect(() => {
    if (!selectedConnectAutomation?.nodes.length) {
      setSelectedConnectNodeId(null)
      return
    }

    setSelectedConnectNodeId((current) => (
      current && selectedConnectAutomation.nodes.some((node) => node.id === current)
        ? current
        : selectedConnectAutomation.nodes[0]?.id ?? null
    ))
  }, [selectedConnectAutomation])

  useEffect(() => {
    if (!selectedConnectAutomation?.edges.length) {
      setSelectedConnectEdgeId(null)
      return
    }

    const preferredEdgeId = selectedConnectNode
      ? selectedConnectAutomation.edges.find((edge) => edge.source === selectedConnectNode.id)?.id
      : selectedConnectAutomation.edges[0]?.id

    setSelectedConnectEdgeId((current) => (
      current && selectedConnectAutomation.edges.some((edge) => edge.id === current)
        ? current
        : preferredEdgeId ?? null
    ))
  }, [selectedConnectAutomation, selectedConnectNode])

  useEffect(() => {
    if (!builderGraphDragState) {
      return
    }

    const previewKey = `${builderGraphDragState.surface}:${builderGraphDragState.nodeId}`

    const handlePointerMove = (event: PointerEvent) => {
      const nextX = Math.max(24, Math.round((event.clientX - builderGraphDragState.canvasLeft - builderGraphDragState.offsetX) / 12) * 12)
      const nextY = Math.max(24, Math.round((event.clientY - builderGraphDragState.canvasTop - builderGraphDragState.offsetY) / 12) * 12)
      setBuilderGraphPreviewPositions((current) => ({
        ...current,
        [previewKey]: { x: nextX, y: nextY },
      }))
    }

    const handlePointerUp = () => {
      const nextPosition = builderGraphPreviewPositions[previewKey]

      if (nextPosition) {
        if (builderGraphDragState.surface === 'workflow') {
          updateSelectedQuizWorkflow((workflow) => ({
            ...workflow,
            nodes: workflow.nodes.map((node) => node.id === builderGraphDragState.nodeId ? { ...node, position: nextPosition } : node),
          }))
        } else {
          updateSelectedConnectAutomation((automation) => ({
            ...automation,
            nodes: automation.nodes.map((node) => node.id === builderGraphDragState.nodeId ? { ...node, position: nextPosition } : node),
            updatedAt: new Date().toISOString(),
          }))
        }
      }

      setBuilderGraphDragState(null)
      setBuilderGraphPreviewPositions((current) => {
        const next = { ...current }
        delete next[previewKey]
        return next
      })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [builderGraphDragState, builderGraphPreviewPositions])

  async function persistProjects(nextProjects: ProjectDefinition[]) {
    setProjects(nextProjects)
    setIsSaving(true)
    try {
      await saveProjectRegistry(nextProjects)
    } finally {
      setIsSaving(false)
    }
  }

  function updateSelectedQuiz(mutate: (quiz: QuizDefinition) => QuizDefinition) {
    if (!selectedProject || !selectedQuiz) {
      return
    }

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            quizzes: project.quizzes.map((quiz) => {
              if (quiz.id !== selectedQuiz.id) {
                return quiz
              }

              const nextQuiz = mutate(quiz)
              return isBlankComposerQuiz(nextQuiz) ? nextQuiz : ensureQuizWorkflow(nextQuiz)
            }),
          }
        : project,
    )

    void persistProjects(nextProjects)
  }

  function updateSelectedQuizWorkflow(mutate: (workflow: QuizDefinition['workflow']) => QuizDefinition['workflow']) {
    updateSelectedQuiz((quiz) => ({
      ...quiz,
      workflow: mutate(quiz.workflow),
    }))
  }

  function updateSelectedQuestion(mutate: (question: Question) => Question) {
    if (!selectedQuestion || !selectedVariant) {
      return
    }

    updateSelectedQuiz((quiz) => ({
      ...quiz,
      variants: quiz.variants.map((variant) =>
        variant.id === selectedVariant.id
          ? {
              ...variant,
              questions: variant.questions.map((question) => question.id === selectedQuestion.id ? mutate(question) : question),
            }
          : variant,
      ),
    }))
  }

  function updateSelectedLeadStep(mutate: (step: LeadStep) => LeadStep) {
    if (!selectedLeadStep) {
      return
    }

    updateSelectedQuiz((quiz) => ({
      ...quiz,
      leadSteps: quiz.leadSteps.map((step) => step.id === selectedLeadStep.id ? mutate(step) : step),
    }))
  }

  function updateProjectAutomations(mutate: (automations: ProjectAutomation[]) => ProjectAutomation[]) {
    if (!selectedProject) {
      return null
    }

    const registry = getAutomationRegistry(projects)
    const nextAutomations = mutate(registry[selectedProject.id] ?? [])
    saveAutomationRegistry({
      ...registry,
      [selectedProject.id]: nextAutomations,
    })
    setAutomationRefreshKey((current) => current + 1)
    return nextAutomations
  }

  function updateSelectedConnectAutomation(mutate: (automation: ProjectAutomation) => ProjectAutomation) {
    if (!selectedConnectAutomation) {
      return null
    }

    const nextAutomations = updateProjectAutomations((automations) =>
      automations.map((automation) => automation.id === selectedConnectAutomation.id ? mutate(automation) : automation),
    )

    return nextAutomations?.find((automation) => automation.id === selectedConnectAutomation.id) ?? null
  }

  function updateSelectedWorkflowEdge(mutate: (edge: QuizDefinition['workflow']['edges'][number]) => QuizDefinition['workflow']['edges'][number]) {
    if (!selectedWorkflowEdge) {
      return
    }

    updateSelectedQuizWorkflow((workflow) => ({
      ...workflow,
      edges: workflow.edges.map((edge) => edge.id === selectedWorkflowEdge.id ? mutate(edge) : edge),
    }))
  }

  function updateSelectedConnectEdge(mutate: (edge: ProjectAutomation['edges'][number]) => ProjectAutomation['edges'][number]) {
    if (!selectedConnectEdge) {
      return
    }

    updateSelectedConnectAutomation((automation) => ({
      ...automation,
      edges: automation.edges.map((edge) => edge.id === selectedConnectEdge.id ? mutate(edge) : edge),
      updatedAt: new Date().toISOString(),
    }))
  }

  function getBuilderSelectionFromWorkflowNode(node: QuizWorkflowNode): BuilderSelection | null {
    if (node.type === 'intro' && node.variantId) {
      return { kind: 'intro', variantId: node.variantId }
    }

    if (node.type === 'question' && node.variantId && node.questionId) {
      return { kind: 'question', variantId: node.variantId, questionId: node.questionId }
    }

    if (node.type === 'lead' && node.leadStepId) {
      return { kind: 'lead', stepId: node.leadStepId }
    }

    if (node.type === 'transition') {
      return { kind: 'transition' }
    }

    if (node.type === 'result' && node.resultKey) {
      return { kind: 'result', resultKey: node.resultKey }
    }

    if (node.type === 'thank-you') {
      return { kind: 'thank-you' }
    }

    return null
  }

  function getWorkflowRuleLabel(node: QuizWorkflowNode) {
    if (node.type === 'question') {
      return 'Question branch'
    }

    if (node.type === 'lead') {
      return 'Lead capture step'
    }

    if (node.type === 'result') {
      return 'Outcome route'
    }

    return 'Flow node'
  }

  function getWorkflowEdgeRuleLabel(edge: QuizDefinition['workflow']['edges'][number]) {
    if (edge.rule?.kind === 'result') {
      return `Result: ${edge.rule.resultKey ?? 'unset'}`
    }

    if (edge.rule?.kind === 'answer') {
      return `Answer: ${edge.rule.answerValue ?? 'unset'}`
    }

    return 'Always'
  }

  function toggleBuilderToolPanel(tool: BuilderToolPanel) {
    setBuilderToolPanel((current) => current === tool ? null : tool)
  }

  function renderBuilderToolPanel() {
    if (!selectedQuiz || !builderToolPanel) {
      return null
    }

    const quickPreviewTargets: Array<{ key: string; label: string; nextSelection: BuilderSelection }> = []
    if (selectedVariant) {
      quickPreviewTargets.push({ key: `intro:${selectedVariant.id}`, label: 'Intro', nextSelection: { kind: 'intro', variantId: selectedVariant.id } })
      if (selectedVariant.questions[0]) {
        quickPreviewTargets.push({
          key: `question:${selectedVariant.questions[0].id}`,
          label: 'First question',
          nextSelection: { kind: 'question', variantId: selectedVariant.id, questionId: selectedVariant.questions[0].id },
        })
      }
    }
    if (selectedQuiz.leadSteps[0]) {
      quickPreviewTargets.push({ key: `lead:${selectedQuiz.leadSteps[0].id}`, label: 'Lead step', nextSelection: { kind: 'lead', stepId: selectedQuiz.leadSteps[0].id } })
    }
    quickPreviewTargets.push({ key: 'transition', label: 'Transition', nextSelection: { kind: 'transition' } })
    const firstResultKey = (Object.keys(selectedQuiz.resultContent) as ResultKey[])[0]
    if (firstResultKey) {
      quickPreviewTargets.push({ key: `result:${firstResultKey}`, label: 'Primary result', nextSelection: { kind: 'result', resultKey: firstResultKey } })
    }
    quickPreviewTargets.push({ key: 'thank-you', label: 'Thank you', nextSelection: { kind: 'thank-you' } })

    if (builderToolPanel === 'preview') {
      return (
        <section className="admin-v2-builder-tool-panel">
          <div className="admin-v2-builder-tool-panel-header">
            <div>
              <span className="admin-v2-builder-tool-panel-eyebrow">Preview controls</span>
              <h3>Drive the live builder preview</h3>
            </div>
            <button type="button" className="admin-v2-builder-tool-panel-close" onClick={() => setBuilderToolPanel(null)} aria-label="Close preview tools">
              <BuilderPanelIcon kind="close" />
            </button>
          </div>
          <div className="admin-v2-builder-tool-grid">
            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Device</span>
              <div className="admin-v2-builder-tool-button-row">
                <button type="button" className={`admin-v2-builder-tool-button ${builderDevice === 'desktop' ? 'is-active' : ''}`} onClick={() => setBuilderDevice('desktop')}>Desktop</button>
                <button type="button" className={`admin-v2-builder-tool-button ${builderDevice === 'mobile' ? 'is-active' : ''}`} onClick={() => setBuilderDevice('mobile')}>Mobile</button>
              </div>
              <p className="admin-v2-builder-tool-note">The preview frame switches immediately without leaving the current builder context.</p>
            </section>

            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Jump to</span>
              <div className="admin-v2-builder-tool-button-row is-wrap">
                {quickPreviewTargets.map((target) => (
                  <button
                    key={target.key}
                    type="button"
                    className={`admin-v2-builder-tool-button ${isBuilderSelectionEqual(selection, target.nextSelection) ? 'is-active' : ''}`}
                    onClick={() => {
                      setBuilderTab('content')
                      setSelection(target.nextSelection)
                    }}
                  >
                    {target.label}
                  </button>
                ))}
              </div>
              {builderTab !== 'content' ? <p className="admin-v2-builder-tool-note">Opening a step returns the stage to the content preview.</p> : null}
            </section>
          </div>
        </section>
      )
    }

    if (builderToolPanel === 'insights') {
      const completion = `${Math.round((selectedMetrics?.completionRate ?? 0) * 100)}%`
      const avgLeadTime = `${(selectedMetrics?.averageLeadTimeSeconds ?? 0).toFixed(1)}s`
      const activeQuestionStats = selectedMetrics?.questionStats.slice(0, 3) ?? []

      return (
        <section className="admin-v2-builder-tool-panel">
          <div className="admin-v2-builder-tool-panel-header">
            <div>
              <span className="admin-v2-builder-tool-panel-eyebrow">Insights</span>
              <h3>Keep conversion signals in view while editing</h3>
            </div>
            <button type="button" className="admin-v2-builder-tool-panel-close" onClick={() => setBuilderToolPanel(null)} aria-label="Close insights tools">
              <BuilderPanelIcon kind="close" />
            </button>
          </div>
          <div className="admin-v2-builder-tool-metrics">
            <article className="admin-v2-builder-tool-metric">
              <span>Sessions</span>
              <strong>{selectedMetrics?.sessions ?? 0}</strong>
            </article>
            <article className="admin-v2-builder-tool-metric">
              <span>Leads</span>
              <strong>{selectedMetrics?.leadCount ?? 0}</strong>
            </article>
            <article className="admin-v2-builder-tool-metric">
              <span>Completion</span>
              <strong>{completion}</strong>
            </article>
            <article className="admin-v2-builder-tool-metric">
              <span>Avg lead time</span>
              <strong>{avgLeadTime}</strong>
            </article>
          </div>
          <div className="admin-v2-builder-tool-grid">
            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Workflow depth</span>
              <p className="admin-v2-builder-tool-note">{selectedQuiz.workflow.nodes.length} nodes and {selectedQuiz.workflow.edges.length} routes are currently active in this form.</p>
            </section>
            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Automation coverage</span>
              <p className="admin-v2-builder-tool-note">{automationInsights?.liveAutomations ?? 0} live flows, {automationInsights?.draftAutomations ?? 0} draft flows, {automationInsights?.totalLeads ?? 0} total captured leads.</p>
            </section>
          </div>
          {activeQuestionStats.length ? (
            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Top watched questions</span>
              <div className="admin-v2-builder-tool-list">
                {activeQuestionStats.map((item) => (
                  <div key={item.questionId} className="admin-v2-builder-tool-list-row">
                    <strong>{item.prompt}</strong>
                    <span>{item.views} views / {Math.round(item.dropOffRate * 100)}% drop-off</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      )
    }

    if (builderToolPanel === 'logic') {
      if (builderTab === 'workflow') {
        const connectedSelection = selectedWorkflowNode ? getBuilderSelectionFromWorkflowNode(selectedWorkflowNode) : null
        return (
          <section className="admin-v2-builder-tool-panel">
            <div className="admin-v2-builder-tool-panel-header">
              <div>
                <span className="admin-v2-builder-tool-panel-eyebrow">Logic tools</span>
                <h3>Work directly on routes and branch structure</h3>
              </div>
              <button type="button" className="admin-v2-builder-tool-panel-close" onClick={() => setBuilderToolPanel(null)} aria-label="Close logic tools">
                <BuilderPanelIcon kind="close" />
              </button>
            </div>
            <div className="admin-v2-builder-tool-grid">
              <section className="admin-v2-builder-tool-card">
                <span className="admin-v2-builder-tool-card-label">Selected node</span>
                <strong>{selectedWorkflowNode?.title ?? 'No node selected'}</strong>
                <p className="admin-v2-builder-tool-note">{selectedWorkflowNode ? getWorkflowRuleLabel(selectedWorkflowNode) : 'Pick a node in the canvas to edit its route behaviour.'}</p>
                <div className="admin-v2-builder-tool-button-row is-wrap">
                  <button type="button" className="admin-v2-builder-tool-button" onClick={handleRebuildWorkflowLayout}>Auto-layout</button>
                  {connectedSelection ? (
                    <button
                      type="button"
                      className="admin-v2-builder-tool-button"
                      onClick={() => {
                        setBuilderTab('content')
                        setSelection(connectedSelection)
                      }}
                    >
                      Open content
                    </button>
                  ) : null}
                </div>
              </section>
              <section className="admin-v2-builder-tool-card">
                <span className="admin-v2-builder-tool-card-label">Selected route</span>
                <strong>{selectedWorkflowEdge?.label ?? 'No route selected'}</strong>
                <p className="admin-v2-builder-tool-note">{selectedWorkflowEdge ? getWorkflowEdgeRuleLabel(selectedWorkflowEdge) : 'Select a route label in the graph to tune its branch rule.'}</p>
              </section>
            </div>
          </section>
        )
      }

      if (builderTab === 'connect') {
        return (
          <section className="admin-v2-builder-tool-panel">
            <div className="admin-v2-builder-tool-panel-header">
              <div>
                <span className="admin-v2-builder-tool-panel-eyebrow">Automation logic</span>
                <h3>Shape the active handoff flow</h3>
              </div>
              <button type="button" className="admin-v2-builder-tool-panel-close" onClick={() => setBuilderToolPanel(null)} aria-label="Close automation logic tools">
                <BuilderPanelIcon kind="close" />
              </button>
            </div>
            <div className="admin-v2-builder-tool-grid">
              <section className="admin-v2-builder-tool-card">
                <span className="admin-v2-builder-tool-card-label">Flow</span>
                <strong>{selectedConnectAutomation?.name ?? 'No flow selected'}</strong>
                <p className="admin-v2-builder-tool-note">{selectedConnectAutomation ? `${selectedConnectAutomation.nodes.length} nodes, ${selectedConnectAutomation.edges.length} connections.` : 'Create a builder automation to start orchestrating follow-ups.'}</p>
                <div className="admin-v2-builder-tool-button-row is-wrap">
                  <button type="button" className="admin-v2-builder-tool-button" onClick={handleCreateBuilderAutomation}>New flow</button>
                  <button type="button" className="admin-v2-builder-tool-button" onClick={() => handleAddBuilderAutomationNode('condition')} disabled={!selectedConnectAutomation}>Add condition</button>
                  <button type="button" className="admin-v2-builder-tool-button" onClick={() => handleAddBuilderAutomationNode('action')} disabled={!selectedConnectAutomation}>Add action</button>
                </div>
              </section>
              <section className="admin-v2-builder-tool-card">
                <span className="admin-v2-builder-tool-card-label">Connection</span>
                <strong>{selectedConnectEdge?.label ?? 'No connection selected'}</strong>
                <p className="admin-v2-builder-tool-note">{selectedConnectEdge ? 'Edge labels now route directly into the inspector for naming and meaning.' : 'Select a connection label in the graph to edit how this automation handoff reads.'}</p>
              </section>
            </div>
          </section>
        )
      }

      return (
        <section className="admin-v2-builder-tool-panel">
          <div className="admin-v2-builder-tool-panel-header">
            <div>
              <span className="admin-v2-builder-tool-panel-eyebrow">Content logic</span>
              <h3>Move from the page editor into its branch node</h3>
            </div>
            <button type="button" className="admin-v2-builder-tool-panel-close" onClick={() => setBuilderToolPanel(null)} aria-label="Close content logic tools">
              <BuilderPanelIcon kind="close" />
            </button>
          </div>
          <div className="admin-v2-builder-tool-grid">
            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Current step</span>
              <strong>{selectedContentWorkflowNode?.title ?? 'No mapped workflow node'}</strong>
              <p className="admin-v2-builder-tool-note">{selectedContentWorkflowNode ? getWorkflowRuleLabel(selectedContentWorkflowNode) : 'This screen does not have a dedicated workflow node yet.'}</p>
              <div className="admin-v2-builder-tool-button-row is-wrap">
                <button
                  type="button"
                  className="admin-v2-builder-tool-button"
                  onClick={() => {
                    setBuilderTab('workflow')
                    if (selectedContentWorkflowNode) {
                      setSelectedWorkflowNodeId(selectedContentWorkflowNode.id)
                    }
                  }}
                >
                  Open workflow
                </button>
                <button type="button" className="admin-v2-builder-tool-button" onClick={handleRebuildWorkflowLayout}>Auto-layout</button>
              </div>
            </section>
          </div>
        </section>
      )
    }

    if (builderToolPanel === 'translate') {
      return (
        <section className="admin-v2-builder-tool-panel">
          <div className="admin-v2-builder-tool-panel-header">
            <div>
              <span className="admin-v2-builder-tool-panel-eyebrow">Translation preview</span>
              <h3>Switch preview locale without rewriting stored content</h3>
            </div>
            <button type="button" className="admin-v2-builder-tool-panel-close" onClick={() => setBuilderToolPanel(null)} aria-label="Close translation tools">
              <BuilderPanelIcon kind="close" />
            </button>
          </div>
          <div className="admin-v2-builder-tool-grid">
            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Preview locale</span>
              <div className="admin-v2-builder-tool-button-row is-wrap">
                {BUILDER_LOCALE_OPTIONS.map((locale) => (
                  <button key={locale.key} type="button" className={`admin-v2-builder-tool-button ${builderLocale === locale.key ? 'is-active' : ''}`} onClick={() => setBuilderLocale(locale.key)}>{locale.label}</button>
                ))}
              </div>
              <p className="admin-v2-builder-tool-note">Only shared system labels in the preview are localized here. Your authored quiz copy stays unchanged.</p>
            </section>
            <section className="admin-v2-builder-tool-card">
              <span className="admin-v2-builder-tool-card-label">Current labels</span>
              <div className="admin-v2-builder-tool-list">
                <div className="admin-v2-builder-tool-list-row"><strong>{builderPreviewCopy.welcome}</strong><span>Intro kicker</span></div>
                <div className="admin-v2-builder-tool-list-row"><strong>{builderPreviewCopy.contactInfo}</strong><span>Lead section</span></div>
                <div className="admin-v2-builder-tool-list-row"><strong>{builderPreviewCopy.addChoice}</strong><span>Question affordance</span></div>
              </div>
            </section>
          </div>
        </section>
      )
    }

    return (
      <section className="admin-v2-builder-tool-panel">
        <div className="admin-v2-builder-tool-panel-header">
          <div>
            <span className="admin-v2-builder-tool-panel-eyebrow">Form settings</span>
            <h3>Adjust delivery and publish behaviour</h3>
          </div>
          <button type="button" className="admin-v2-builder-tool-panel-close" onClick={() => setBuilderToolPanel(null)} aria-label="Close settings tools">
            <BuilderPanelIcon kind="close" />
          </button>
        </div>
        <div className="admin-v2-builder-tool-grid">
          <section className="admin-v2-builder-tool-card">
            <span className="admin-v2-builder-tool-card-label">Identity</span>
            <div className="admin-v2-builder-form-stack">
              <label>
                <span>Name</span>
                <input value={selectedQuiz.name} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, name: event.target.value }))} />
              </label>
              <label>
                <span>Slug</span>
                <input value={selectedQuiz.slug} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, slug: toSlug(event.target.value, quiz.slug) }))} />
              </label>
              <label>
                <span>Custom domain</span>
                <input value={selectedQuiz.customDomain ?? ''} placeholder="claims.yourdomain.com" onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, customDomain: event.target.value }))} />
              </label>
            </div>
          </section>
          <section className="admin-v2-builder-tool-card">
            <span className="admin-v2-builder-tool-card-label">Delivery</span>
            <div className="admin-v2-builder-tool-button-row is-wrap">
              <button type="button" className={`admin-v2-builder-tool-button ${selectedQuiz.status === 'draft' ? 'is-active' : ''}`} onClick={() => updateSelectedQuiz((quiz) => ({ ...quiz, status: 'draft' }))}>Draft</button>
              <button type="button" className={`admin-v2-builder-tool-button ${selectedQuiz.status === 'published' ? 'is-active' : ''}`} onClick={() => updateSelectedQuiz((quiz) => ({ ...quiz, status: 'published' }))}>Published</button>
            </div>
            <div className="admin-v2-builder-tool-button-row is-wrap">
              <button type="button" className={`admin-v2-builder-tool-button ${selectedQuiz.layoutMode === 'standalone' ? 'is-active' : ''}`} onClick={() => updateSelectedQuiz((quiz) => ({ ...quiz, layoutMode: 'standalone' }))}>Standalone</button>
              <button type="button" className={`admin-v2-builder-tool-button ${selectedQuiz.layoutMode === 'embed' ? 'is-active' : ''}`} onClick={() => updateSelectedQuiz((quiz) => ({ ...quiz, layoutMode: 'embed' }))}>Embed</button>
            </div>
            <p className="admin-v2-builder-tool-note">These values persist on the selected form, so the shell stays shared while each form keeps its own delivery settings.</p>
          </section>
        </div>
      </section>
    )
  }

  function renderEditablePreviewOption(optionId: string, value: string, placeholder: string, className = 'admin-v2-preview-inline-option') {
    return (
      <input
        value={value}
        className={className}
        placeholder={placeholder}
        onChange={(event) => handleUpdateSelectedQuestionOption(optionId, event.target.value)}
      />
    )
  }

  function renderQuestionPreviewBody() {
    if (!selectedQuestion) {
      return null
    }

    if (selectedQuestionElementKey === 'statement') {
      return (
        <div className="admin-v2-preview-statement-card" style={builderPreviewStyles.fieldStyle}>
          <textarea
            value={selectedQuestion.options[0]?.label ?? ''}
            className="admin-v2-preview-inline-helper"
            placeholder="This is a statement block"
            onChange={(event) => selectedQuestion.options[0] ? handleUpdateSelectedQuestionOption(selectedQuestion.options[0].id, event.target.value) : null}
          />
        </div>
      )
    }

    if (selectedQuestionElementKey === 'question-group') {
      return (
        <div className="admin-v2-preview-group-stack">
          {selectedQuestion.options.map((option, index) => (
            <div key={option.id} className="admin-v2-preview-group-row" style={builderPreviewStyles.fieldStyle}>
              <span className="admin-v2-preview-choice-badge" style={builderPreviewStyles.choiceBadgeStyle}>{index + 1}</span>
              {renderEditablePreviewOption(option.id, option.label, `Question ${index + 1}`)}
            </div>
          ))}
          <button type="button" className="admin-v2-preview-add-choice" style={builderPreviewStyles.addChoiceStyle} onClick={handleAddChoice}>{builderPreviewCopy.addChoice}</button>
        </div>
      )
    }

    if (BUILDER_FIELD_GROUP_KEYS.has(selectedQuestionElementKey)) {
      return (
        <div className="admin-v2-preview-field-stack">
          {selectedQuestion.options.map((option, index) => {
            const isPhoneField = /phone/i.test(option.label)
            const isCountryField = /country/i.test(option.label)
            return (
              <label key={option.id} className="admin-v2-preview-field-row">
                <span className="admin-v2-preview-field-label">{renderEditablePreviewOption(option.id, option.label, `Field ${index + 1}`, 'admin-v2-preview-inline-field-label')}</span>
                {isPhoneField ? (
                  <div className="admin-v2-preview-phone-row" style={builderPreviewStyles.fieldStyle}>
                    <span className="admin-v2-preview-phone-flag">🇺🇸</span>
                    <span className="admin-v2-preview-phone-code">United States</span>
                    <span className="admin-v2-preview-phone-number">(201) 555-0123</span>
                  </div>
                ) : isCountryField ? (
                  <div className="admin-v2-preview-dropdown-row" style={builderPreviewStyles.fieldStyle}>
                    <span>United States</span>
                    <span>⌄</span>
                  </div>
                ) : (
                  <input readOnly value={index === 0 ? 'Jane' : index === 1 ? 'Smith' : option.label} style={builderPreviewStyles.fieldStyle} />
                )}
              </label>
            )
          })}
        </div>
      )
    }

    if (selectedQuestionElementKey === 'phone-number') {
      return (
        <div className="admin-v2-preview-field-stack">
          <label className="admin-v2-preview-field-row">
            <span className="admin-v2-preview-field-label">{renderEditablePreviewOption(selectedQuestion.options[0]?.id ?? createId('option'), selectedQuestion.options[0]?.label ?? 'Phone number', 'Phone number', 'admin-v2-preview-inline-field-label')}</span>
            <div className="admin-v2-preview-phone-row" style={builderPreviewStyles.fieldStyle}>
              <span className="admin-v2-preview-phone-flag">🇺🇸</span>
              <span className="admin-v2-preview-phone-code">⌄</span>
              <span className="admin-v2-preview-phone-number">(201) 555-0123</span>
            </div>
          </label>
        </div>
      )
    }

    if (BUILDER_TEXT_ENTRY_KEYS.has(selectedQuestionElementKey)) {
      const isLongText = selectedQuestionElementKey === 'long-text'
      return (
        <div className="admin-v2-preview-text-response">
          <input
            value={selectedQuestion.options[0]?.label ?? 'Type your answer here...'}
            className={`admin-v2-preview-inline-placeholder ${isLongText ? 'is-long' : ''}`}
            onChange={(event) => selectedQuestion.options[0] ? handleUpdateSelectedQuestionOption(selectedQuestion.options[0].id, event.target.value) : null}
          />
          {isLongText ? <span className="admin-v2-preview-text-hint">Shift + Enter to make a line break</span> : null}
        </div>
      )
    }

    if (BUILDER_MEDIA_KEYS.has(selectedQuestionElementKey)) {
      return (
        <div className="admin-v2-preview-media-stack">
          <button type="button" className="admin-v2-preview-media-button" style={builderPreviewStyles.choiceStyle}>
            <BuilderPanelIcon kind="upload" />
            <span>{selectedQuestion.options[0]?.label ?? 'Add video answer'}</span>
          </button>
          {currentBuilderToggles.allowTextAnswer ? <input readOnly value="Add text fallback" style={builderPreviewStyles.fieldStyle} /> : null}
        </div>
      )
    }

    if (BUILDER_ACTION_KEYS.has(selectedQuestionElementKey)) {
      return (
        <div className="admin-v2-preview-media-stack">
          <button type="button" className="admin-v2-preview-media-button" style={builderPreviewStyles.choiceStyle}>
            <span>{selectedQuestion.options[0]?.label ?? 'Continue'}</span>
          </button>
        </div>
      )
    }

    if (selectedQuestionElementKey === 'picture-choice') {
      return (
        <div className={`admin-v2-preview-picture-grid ${currentBuilderToggles.supersize ? 'is-supersize' : ''}`}>
          {selectedQuestion.options.map((option, index) => (
            <div key={option.id} className="admin-v2-preview-picture-card" style={builderPreviewStyles.choiceStyle}>
              <div className="admin-v2-preview-picture-frame">
                <BuilderPanelIcon kind="image" />
              </div>
              {currentBuilderToggles.showLabels ? renderEditablePreviewOption(option.id, option.label, `Choice ${index + 1}`) : null}
              <span className="admin-v2-preview-choice-badge" style={builderPreviewStyles.choiceBadgeStyle}>{String.fromCharCode(65 + index)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (selectedQuestionElementKey === 'ranking') {
      return (
        <div className="admin-v2-preview-ranking-stack">
          {selectedQuestion.options.map((option, index) => (
            <div key={option.id} className="admin-v2-preview-ranking-row" style={builderPreviewStyles.choiceStyle}>
              <span className="admin-v2-preview-ranking-handle">↕</span>
              {renderEditablePreviewOption(option.id, option.label, `${builderPreviewCopy.choiceFallback} ${index + 1}`)}
              <span className="admin-v2-preview-ranking-menu">⋮</span>
            </div>
          ))}
          <button type="button" className="admin-v2-preview-add-choice" style={builderPreviewStyles.addChoiceStyle} onClick={handleAddChoice}>{builderPreviewCopy.addChoice}</button>
        </div>
      )
    }

    if (selectedQuestionElementKey === 'dropdown') {
      return (
        <div className="admin-v2-preview-dropdown-list">
          {selectedQuestion.options.slice(0, 1).map((option) => (
            <div key={option.id} className="admin-v2-preview-dropdown-row" style={builderPreviewStyles.choiceStyle}>
              {renderEditablePreviewOption(option.id, option.label, 'Option 1')}
              <span>⌄</span>
            </div>
          ))}
        </div>
      )
    }

    if (BUILDER_SCALE_KEYS.has(selectedQuestionElementKey)) {
      return (
        <div className={`admin-v2-preview-scale-row is-${selectedQuestionElementKey}`}>
          {selectedQuestion.options.map((option, index) => (
            <div key={option.id} className="admin-v2-preview-scale-chip" style={builderPreviewStyles.choiceStyle}>
              <span>{option.label || String(index + 1)}</span>
            </div>
          ))}
        </div>
      )
    }

    if (selectedQuestionElementKey === 'legal') {
      return (
        <div className="admin-v2-preview-legal-row" style={builderPreviewStyles.choiceStyle}>
          <span className="admin-v2-preview-legal-check">☐</span>
          {renderEditablePreviewOption(selectedQuestion.options[0]?.id ?? createId('option'), selectedQuestion.options[0]?.label ?? 'I agree to the terms', 'I agree to the terms')}
        </div>
      )
    }

    return (
      <div className="admin-v2-preview-choice-stack">
        {selectedQuestion.options.map((option, index) => (
          <div key={option.id} className={`admin-v2-preview-choice-field${selectedQuestionElementKey === 'multiple-choice' ? ' is-multiple-choice' : ''}`} style={selectedQuestionElementKey === 'multiple-choice' ? builderPreviewStyles.multipleChoiceStyle : builderPreviewStyles.choiceStyle}>
            <span className="admin-v2-preview-choice-badge" style={selectedQuestionElementKey === 'multiple-choice' ? builderPreviewStyles.multipleChoiceBadgeStyle : builderPreviewStyles.choiceBadgeStyle}>{String.fromCharCode(65 + index)}</span>
            {renderEditablePreviewOption(option.id, option.label, `${builderPreviewCopy.choiceFallback} ${index + 1}`)}
          </div>
        ))}
        <button type="button" className="admin-v2-preview-add-choice" style={builderPreviewStyles.addChoiceStyle} onClick={handleAddChoice}>{builderPreviewCopy.addChoice}</button>
      </div>
    )
  }

  function renderLeadPreviewBody() {
    if (!selectedLeadStep) {
      return null
    }

    if (selectedLeadElementKey === 'contact-info' || selectedLeadElementKey === 'address') {
      return (
        <div className="admin-v2-preview-field-stack">
          {(selectedLeadStep.options ?? []).map((field, index) => {
            const isPhoneField = /phone/i.test(field)
            const isCountryField = /country/i.test(field)
            const sampleValue = isPhoneField
              ? '(201) 555-0123'
              : isCountryField
                ? 'United States'
                : index === 0
                  ? 'Jane'
                  : index === 1
                    ? 'Smith'
                    : field
            return (
              <label key={`${selectedLeadStep.id}-${field}-${index}`} className="admin-v2-preview-field-row">
                <span className="admin-v2-preview-field-label">{field}</span>
                {isPhoneField ? (
                  <div className="admin-v2-preview-phone-row" style={builderPreviewStyles.fieldStyle}>
                    <span className="admin-v2-preview-phone-flag">🇺🇸</span>
                    <span className="admin-v2-preview-phone-code">⌄</span>
                    <span className="admin-v2-preview-phone-number">{sampleValue}</span>
                  </div>
                ) : isCountryField ? (
                  <div className="admin-v2-preview-dropdown-row" style={builderPreviewStyles.fieldStyle}>
                    <span>{sampleValue}</span>
                    <span>⌄</span>
                  </div>
                ) : (
                  <input readOnly value={sampleValue} style={builderPreviewStyles.fieldStyle} />
                )}
              </label>
            )
          })}
        </div>
      )
    }

    if (selectedLeadElementKey === 'phone-number') {
      return (
        <div className="admin-v2-preview-field-stack">
          <label className="admin-v2-preview-field-row">
            <span className="admin-v2-preview-field-label">Phone number</span>
            <div className="admin-v2-preview-phone-row" style={builderPreviewStyles.fieldStyle}>
              <span className="admin-v2-preview-phone-flag">🇺🇸</span>
              <span className="admin-v2-preview-phone-code">⌄</span>
              <span className="admin-v2-preview-phone-number">(201) 555-0123</span>
            </div>
          </label>
        </div>
      )
    }

    if (selectedLeadElementKey === 'email' || selectedLeadElementKey === 'website') {
      return (
        <div className="admin-v2-preview-field-stack">
          <label className="admin-v2-preview-field-row">
            <span className="admin-v2-preview-field-label">{selectedLeadStep.label}</span>
            <input readOnly value={selectedLeadElementKey === 'website' ? 'https://example.com' : 'name@example.com'} style={builderPreviewStyles.fieldStyle} />
          </label>
        </div>
      )
    }

    if (selectedLeadStep.kind === 'single') {
      return (
        <div className="admin-v2-preview-options">
          {(selectedLeadStep.options ?? []).map((option) => (
            <button key={option} type="button" className="admin-v2-preview-option" style={builderPreviewStyles.choiceStyle}>{option}</button>
          ))}
        </div>
      )
    }

    return (
      <div className="admin-v2-preview-fields">
        <label>
          <span>{selectedLeadStep.label}</span>
          <input value={selectedLeadStep.placeholder ?? ''} readOnly style={builderPreviewStyles.fieldStyle} />
        </label>
      </div>
    )
  }

  function getAutomationTriggerLabel(trigger: ProjectAutomation['trigger']) {
    switch (trigger) {
      case 'lead_submitted':
        return 'Lead submitted'
      case 'result_likely':
        return 'Likely result'
      case 'result_maybe':
        return 'Maybe result'
      case 'result_soft_fail':
        return 'Soft fail result'
      case 'result_hard_fail':
        return 'Hard fail result'
      default:
        return trigger
    }
  }

  function getFlowCanvasMetrics<T extends { position: { x: number; y: number } }>(nodes: T[]) {
    const maxX = Math.max(...nodes.map((node) => node.position.x), 0)
    const maxY = Math.max(...nodes.map((node) => node.position.y), 0)

    return {
      width: maxX + BUILDER_GRAPH_NODE_WIDTH + BUILDER_GRAPH_PADDING * 2,
      height: maxY + BUILDER_GRAPH_NODE_HEIGHT + BUILDER_GRAPH_PADDING * 2,
    }
  }

  function handleGraphNodePointerDown(surface: BuilderGraphSurface, nodeId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const canvas = event.currentTarget.closest('.admin-v2-builder-graph-canvas')
    if (!(canvas instanceof HTMLElement)) {
      return
    }

    const canvasRect = canvas.getBoundingClientRect()
    const node = surface === 'workflow'
      ? workflowCanvasNodes.find((item) => item.id === nodeId)
      : connectCanvasNodes.find((item) => item.id === nodeId)

    if (!node) {
      return
    }

    setBuilderGraphDragState({
      surface,
      nodeId,
      offsetX: event.clientX - canvasRect.left - node.position.x,
      offsetY: event.clientY - canvasRect.top - node.position.y,
      canvasLeft: canvasRect.left,
      canvasTop: canvasRect.top,
    })
  }

  function handleFocusWorkflowStart() {
    if (!selectedQuiz?.workflow.startNodeId) {
      return
    }

    setSelectedWorkflowNodeId(selectedQuiz.workflow.startNodeId)
  }

  function handleRebuildWorkflowLayout() {
    if (!selectedQuiz) {
      return
    }

    const nextWorkflow = buildQuizWorkflow(selectedQuiz)
    setSelectedWorkflowNodeId(nextWorkflow.startNodeId)
    updateSelectedQuizWorkflow(() => nextWorkflow)
  }

  function handleSetWorkflowStartNode() {
    if (!selectedWorkflowNode) {
      return
    }

    updateSelectedQuizWorkflow((workflow) => ({
      ...workflow,
      startNodeId: selectedWorkflowNode.id,
    }))
  }

  function handleOpenWorkflowNodeInContent() {
    if (!selectedWorkflowNode) {
      return
    }

    const nextSelection = getBuilderSelectionFromWorkflowNode(selectedWorkflowNode)
    if (!nextSelection) {
      return
    }

    setSelection(nextSelection)
    setBuilderTab('content')
  }

  function createBuilderAutomationClone(automation: ProjectAutomation) {
    const nodeIdMap = new Map<string, string>()
    const nextNodes = automation.nodes.map((node) => {
      const nextId = createId('automation-node')
      nodeIdMap.set(node.id, nextId)
      return {
        ...node,
        id: nextId,
        position: {
          x: node.position.x + 28,
          y: node.position.y + 28,
        },
      }
    })

    return {
      ...automation,
      id: createId('automation'),
      name: `${automation.name} copy`,
      status: 'draft' as const,
      nodes: nextNodes,
      edges: automation.edges.map((edge) => ({
        ...edge,
        id: createId('automation-edge'),
        source: nodeIdMap.get(edge.source) ?? edge.source,
        target: nodeIdMap.get(edge.target) ?? edge.target,
      })),
      updatedAt: new Date().toISOString(),
    }
  }

  function handleCreateBuilderAutomation() {
    if (!selectedProject || !selectedQuiz) {
      return
    }

    const nextAutomation = createAutomationTemplate('lead-intake', selectedProject.id, selectedQuiz, {
      name: `${selectedQuiz.name} flow ${selectedQuizAutomations.length + 1}`,
      description: `Connected follow-up flow for ${selectedQuiz.name}.`,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    })

    updateProjectAutomations((automations) => [...automations, nextAutomation])
    setSelectedConnectAutomationId(nextAutomation.id)
    setSelectedConnectNodeId(nextAutomation.nodes[0]?.id ?? null)
  }

  function handleDuplicateBuilderAutomation() {
    if (!selectedConnectAutomation) {
      return
    }

    const nextAutomation = createBuilderAutomationClone(selectedConnectAutomation)
    updateProjectAutomations((automations) => [...automations, nextAutomation])
    setSelectedConnectAutomationId(nextAutomation.id)
    setSelectedConnectNodeId(nextAutomation.nodes[0]?.id ?? null)
  }

  function handleToggleBuilderAutomationStatus() {
    if (!selectedConnectAutomation) {
      return
    }

    updateSelectedConnectAutomation((automation) => ({
      ...automation,
      status: automation.status === 'live' ? 'draft' : 'live',
      updatedAt: new Date().toISOString(),
    }))
  }

  function handleAddBuilderAutomationNode(type: AutomationNode['type']) {
    if (!selectedConnectAutomation) {
      return
    }

    const anchorNode = selectedConnectNode ?? selectedConnectAutomation.nodes[selectedConnectAutomation.nodes.length - 1]
    const nextNode: AutomationNode = {
      id: createId('automation-node'),
      type,
      title: type === 'condition' ? 'New condition' : type === 'trigger' ? 'New trigger' : 'New action',
      body: type === 'condition'
        ? 'Define a rule before routing the next step.'
        : type === 'trigger'
          ? 'Choose which event starts this flow.'
          : 'Pick what should happen next.',
      position: {
        x: (anchorNode?.position.x ?? 40) + 272,
        y: anchorNode?.position.y ?? 140,
      },
      tone: type === 'condition' ? 'warning' : anchorNode?.tone,
    }

    updateSelectedConnectAutomation((automation) => ({
      ...automation,
      nodes: [...automation.nodes, nextNode],
      edges: anchorNode
        ? [...automation.edges, { id: createId('automation-edge'), source: anchorNode.id, target: nextNode.id, label: type === 'condition' ? 'Rule' : 'Next' }]
        : automation.edges,
      updatedAt: new Date().toISOString(),
    }))
    setSelectedConnectNodeId(nextNode.id)
  }

  function handleDeleteSelectedConnectNode() {
    if (!selectedConnectAutomation || !selectedConnectNode || selectedConnectNode.type === 'trigger') {
      return
    }

    const fallbackNodeId = selectedConnectAutomation.nodes.find((node) => node.id !== selectedConnectNode.id)?.id ?? null

    updateSelectedConnectAutomation((automation) => ({
      ...automation,
      nodes: automation.nodes.filter((node) => node.id !== selectedConnectNode.id),
      edges: automation.edges.filter((edge) => edge.source !== selectedConnectNode.id && edge.target !== selectedConnectNode.id),
      updatedAt: new Date().toISOString(),
    }))
    setSelectedConnectNodeId(fallbackNodeId)
  }

  function handleUpdateSelectedConnectNode(field: 'title' | 'body', value: string) {
    if (!selectedConnectNode) {
      return
    }

    updateSelectedConnectAutomation((automation) => ({
      ...automation,
      nodes: automation.nodes.map((node) => node.id === selectedConnectNode.id ? { ...node, [field]: value } : node),
      updatedAt: new Date().toISOString(),
    }))
  }

  function handleUpdateSelectedConnectAutomation(field: 'name' | 'description', value: string) {
    if (!selectedConnectAutomation) {
      return
    }

    updateSelectedConnectAutomation((automation) => ({
      ...automation,
      [field]: value,
      updatedAt: new Date().toISOString(),
    }))
  }

  function renderWorkflowCanvas() {
    if (!selectedQuiz) {
      return null
    }

    const metrics = getFlowCanvasMetrics(workflowCanvasNodes)

    return (
      <div className="admin-v2-builder-graph-shell">
        <div className="admin-v2-builder-graph-toolbar">
          <button type="button" className="admin-v2-builder-graph-action" onClick={handleFocusWorkflowStart}>Start node</button>
          <button type="button" className="admin-v2-builder-graph-action" onClick={handleRebuildWorkflowLayout}>Auto-layout</button>
          <button type="button" className="admin-v2-builder-graph-action" onClick={handleOpenWorkflowNodeInContent} disabled={!selectedWorkflowNode}>Open in content</button>
        </div>

        <div className="admin-v2-builder-graph-scroll">
          <div className="admin-v2-builder-graph-canvas admin-v2-builder-graph-canvas--workflow" style={{ width: metrics.width, height: metrics.height }}>
            <svg className="admin-v2-builder-graph-lines" width={metrics.width} height={metrics.height} aria-hidden="true">
              {selectedQuiz.workflow.edges.map((edge) => {
                const source = workflowCanvasNodes.find((node) => node.id === edge.source)
                const target = workflowCanvasNodes.find((node) => node.id === edge.target)
                if (!source || !target) {
                  return null
                }

                return (
                  <line
                    key={edge.id}
                    x1={source.position.x + BUILDER_GRAPH_NODE_WIDTH}
                    y1={source.position.y + BUILDER_GRAPH_NODE_HEIGHT / 2}
                    x2={target.position.x}
                    y2={target.position.y + BUILDER_GRAPH_NODE_HEIGHT / 2}
                  />
                )
              })}
            </svg>

            {selectedQuiz.workflow.edges.map((edge) => {
              const source = workflowCanvasNodes.find((node) => node.id === edge.source)
              const target = workflowCanvasNodes.find((node) => node.id === edge.target)
              if (!source || !target) {
                return null
              }

              return (
                <button
                  key={`${edge.id}-label`}
                  type="button"
                  className={`admin-v2-builder-graph-edge-label ${selectedWorkflowEdgeId === edge.id ? 'is-active' : ''}`}
                  style={{
                    left: (source.position.x + BUILDER_GRAPH_NODE_WIDTH + target.position.x) / 2 - 42,
                    top: (source.position.y + target.position.y) / 2 + BUILDER_GRAPH_NODE_HEIGHT / 2 - 14,
                  }}
                  onClick={() => {
                    setSelectedWorkflowEdgeId(edge.id)
                    setSelectedWorkflowNodeId(edge.source)
                  }}
                >
                  {edge.label || edge.rule?.kind || 'Next'}
                </button>
              )
            })}

            {workflowCanvasNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`admin-v2-builder-graph-node is-${node.type} ${selectedWorkflowNodeId === node.id ? 'is-active' : ''} ${selectedQuiz.workflow.startNodeId === node.id ? 'is-start' : ''} ${builderGraphDragState?.surface === 'workflow' && builderGraphDragState.nodeId === node.id ? 'is-dragging' : ''}`}
                style={{ left: node.position.x, top: node.position.y }}
                onClick={() => setSelectedWorkflowNodeId(node.id)}
                onDoubleClick={handleOpenWorkflowNodeInContent}
                onPointerDown={(event) => handleGraphNodePointerDown('workflow', node.id, event)}
              >
                <span className="admin-v2-builder-graph-node-kicker">{node.type.replace('-', ' ')}</span>
                <strong>{node.title}</strong>
                <small>{getWorkflowRuleLabel(node)}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderConnectCanvas() {
    if (!selectedQuiz) {
      return null
    }

    if (!selectedConnectAutomation) {
      return (
        <div className="admin-v2-builder-graph-empty">
          <h3>No automation flow yet</h3>
          <p>Create a connected follow-up flow for {selectedQuiz.name} without leaving the current builder shell.</p>
          <Button tone="primary" onClick={handleCreateBuilderAutomation}>Create flow</Button>
        </div>
      )
    }

    const metrics = getFlowCanvasMetrics(connectCanvasNodes)

    return (
      <div className="admin-v2-builder-graph-shell">
        <div className="admin-v2-builder-connect-head">
          <div className="admin-v2-builder-connect-flows">
            {selectedQuizAutomations.map((automation) => (
              <button
                key={automation.id}
                type="button"
                className={`admin-v2-builder-flow-pill ${selectedConnectAutomation.id === automation.id ? 'is-active' : ''}`}
                onClick={() => setSelectedConnectAutomationId(automation.id)}
              >
                <strong>{automation.name}</strong>
                <span>{automation.status}</span>
              </button>
            ))}
          </div>

          <div className="admin-v2-builder-graph-toolbar is-connect">
            <button type="button" className="admin-v2-builder-graph-action" onClick={handleCreateBuilderAutomation}>New flow</button>
            <button type="button" className="admin-v2-builder-graph-action" onClick={handleDuplicateBuilderAutomation} disabled={!selectedConnectAutomation}>Duplicate</button>
            <button type="button" className="admin-v2-builder-graph-action" onClick={handleToggleBuilderAutomationStatus} disabled={!selectedConnectAutomation}>{selectedConnectAutomation.status === 'live' ? 'Move to draft' : 'Publish'}</button>
            <button type="button" className="admin-v2-builder-graph-action" onClick={() => handleAddBuilderAutomationNode('condition')} disabled={!selectedConnectAutomation}>Add condition</button>
            <button type="button" className="admin-v2-builder-graph-action" onClick={() => handleAddBuilderAutomationNode('action')} disabled={!selectedConnectAutomation}>Add action</button>
          </div>
        </div>

        <div className="admin-v2-builder-graph-scroll">
          <div className="admin-v2-builder-graph-canvas admin-v2-builder-graph-canvas--connect" style={{ width: metrics.width, height: metrics.height }}>
            <svg className="admin-v2-builder-graph-lines" width={metrics.width} height={metrics.height} aria-hidden="true">
              {selectedConnectAutomation.edges.map((edge) => {
                const source = connectCanvasNodes.find((node) => node.id === edge.source)
                const target = connectCanvasNodes.find((node) => node.id === edge.target)
                if (!source || !target) {
                  return null
                }

                return (
                  <line
                    key={edge.id}
                    x1={source.position.x + BUILDER_GRAPH_NODE_WIDTH}
                    y1={source.position.y + BUILDER_GRAPH_NODE_HEIGHT / 2}
                    x2={target.position.x}
                    y2={target.position.y + BUILDER_GRAPH_NODE_HEIGHT / 2}
                  />
                )
              })}
            </svg>

            {selectedConnectAutomation.edges.map((edge) => {
              const source = connectCanvasNodes.find((node) => node.id === edge.source)
              const target = connectCanvasNodes.find((node) => node.id === edge.target)
              if (!source || !target) {
                return null
              }

              return (
                <button
                  key={`${edge.id}-label`}
                  type="button"
                  className={`admin-v2-builder-graph-edge-label ${selectedConnectEdgeId === edge.id ? 'is-active' : ''}`}
                  style={{
                    left: (source.position.x + BUILDER_GRAPH_NODE_WIDTH + target.position.x) / 2 - 42,
                    top: (source.position.y + target.position.y) / 2 + BUILDER_GRAPH_NODE_HEIGHT / 2 - 14,
                  }}
                  onClick={() => {
                    setSelectedConnectEdgeId(edge.id)
                    setSelectedConnectNodeId(edge.source)
                  }}
                >
                  {edge.label || 'Next'}
                </button>
              )
            })}

            {connectCanvasNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`admin-v2-builder-graph-node is-connect-node is-${node.type} ${selectedConnectNode?.id === node.id ? 'is-active' : ''} ${builderGraphDragState?.surface === 'connect' && builderGraphDragState.nodeId === node.id ? 'is-dragging' : ''}`}
                style={{ left: node.position.x, top: node.position.y }}
                onClick={() => setSelectedConnectNodeId(node.id)}
                onPointerDown={(event) => handleGraphNodePointerDown('connect', node.id, event)}
              >
                <span className="admin-v2-builder-graph-node-kicker">{node.type}</span>
                <strong>{node.title}</strong>
                <small>{node.body}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  async function handleSignIn() {
    try {
      setLoginError('')
      await signInAdmin(email, password, rememberMe)
      const nextProjects = await loadProjectRegistry()
      setProjects(nextProjects)
      setSelectedProjectId(nextProjects[0]?.id ?? '')
      setSelectedQuizId(nextProjects[0] ? getActiveQuiz(nextProjects[0])?.id ?? '' : '')
      setIsUnlocked(true)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Sign-in failed.')
    }
  }

  async function handleSubmitWorkspace() {
    const trimmedName = workspaceName.trim()

    if (workspaceModalMode === 'rename') {
      if (!selectedProject || !trimmedName) {
        return
      }

      const nextProjects = projects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              name: trimmedName,
              slug: toSlug(trimmedName, project.slug),
            }
          : project,
      )

      setWorkspaceModalOpen(false)
      setWorkspaceName('')
      await persistProjects(nextProjects)
      return
    }

    const nextProject = createEmptyWorkspace(projects.length + 1)
    const projectName = trimmedName || nextProject.name
    const nextProjectWithName = {
      ...nextProject,
      name: projectName,
      slug: toSlug(projectName, nextProject.slug),
    }
    const projectsWithNext = [...projects, nextProjectWithName]
    setSelectedProjectId(nextProjectWithName.id)
    setSelectedQuizId('')
    setSection('forms')
    setOpenedQuizId(null)
    setWorkspaceModalOpen(false)
    setWorkspaceName('')
    await persistProjects(projectsWithNext)
  }

  async function handleCreateForm() {
    if (!selectedProject) {
      return
    }

    const nextQuiz = applySharedThemesToQuiz(
      createBlankQuiz(
        selectedProject.quizzes.length ? `New form ${selectedProject.quizzes.length + 1}` : 'My new form',
        toSlug(`new-form-${selectedProject.quizzes.length + 1}`, `form-${Date.now()}`),
      ),
      builderThemeConfig.activeThemeId,
    )

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            activeQuizId: nextQuiz.id,
            quizzes: [...project.quizzes, nextQuiz],
          }
        : project,
    )

    setSelectedQuizId(nextQuiz.id)
    setOpenedQuizId(nextQuiz.id)
    setBuilderTab('content')
    setSelection(createDefaultSelection(nextQuiz))
    setNewFormCanvasMode('ai')
    setNewFormComposerTab('elements')
    setNewFormLibraryOpen(true)
    setNewFormAiPrompt('')
    await persistProjects(nextProjects)
  }

  function selectWorkspace(projectId: string) {
    const project = getProjectById(projects, projectId)
    const activeQuiz = getWorkspaceActiveQuiz(project)
    setSelectedProjectId(project.id)
    setSelectedQuizId(activeQuiz?.id ?? '')
    setOpenedQuizId(null)
    setSelection(activeQuiz ? createDefaultSelection(activeQuiz) : null)
    setWorkspaceMenuOpen(false)
  }

  function openWorkspaceModal() {
    setWorkspaceModalMode('create')
    setWorkspaceModalOpen(true)
    setWorkspaceName('')
    setWorkspaceMenuOpen(false)
  }

  function openRenameWorkspaceModal() {
    if (!selectedProject) {
      return
    }

    setWorkspaceModalMode('rename')
    setWorkspaceName(selectedProject.name)
    setWorkspaceModalOpen(true)
    setWorkspaceMenuOpen(false)
  }

  async function removeWorkspace(projectId: string) {
    const nextProjects = projects.filter((project) => project.id !== projectId)
    const nextSelectedProject = nextProjects[0] ?? null
    const nextSelectedQuiz = getWorkspaceActiveQuiz(nextSelectedProject)

    setSelectedProjectId(nextSelectedProject?.id ?? '')
    setSelectedQuizId(nextSelectedQuiz?.id ?? '')
    setOpenedQuizId(null)
    setSelection(nextSelectedQuiz ? createDefaultSelection(nextSelectedQuiz) : null)
    setWorkspaceMenuOpen(false)
    await persistProjects(nextProjects)
  }

  function closeContactSurfaces() {
    setContactAddMenuOpen(false)
    setContactModal(null)
    setContactListFieldMenuOpen(false)
  }

  function openContactImportModal() {
    setContactAddMenuOpen(false)
    setContactModal('import')
  }

  function openContactListModal() {
    setContactAddMenuOpen(false)
    setContactModal('create-list')
    setContactListName('')
    setSelectedContactFilterField('')
    setContactListFieldMenuOpen(false)
  }

  function openAutomationTriggerPicker() {
    setAutomationCreateOpen(true)
    setAutomationComposerStep('trigger-picker')
    setAutomationWorkspaceId(selectedProject?.id ?? '')
    setAutomationQuizId(selectedQuiz?.id ?? '')
    setAutomationWorkspaceSelectOpen(false)
    setAutomationFormSelectOpen(false)
    setAutomationEditor(null)
  }

  function openFormSubmissionModal() {
    setAutomationComposerStep('form-submission')
    setAutomationWorkspaceId(selectedProject?.id ?? '')
    setAutomationQuizId(selectedQuiz?.id ?? '')
    setAutomationWorkspaceSelectOpen(false)
    setAutomationFormSelectOpen(false)
  }

  function closeAutomationComposer() {
    setAutomationCreateOpen(false)
    setAutomationComposerStep('idle')
    setAutomationWorkspaceSelectOpen(false)
    setAutomationFormSelectOpen(false)
    setAutomationEditor(null)
  }

  async function handleCreateFormSubmissionAutomation() {
    const project = getProjectById(projects, automationWorkspaceId)
    const quiz = project.quizzes.find((item) => item.id === automationQuizId)

    if (!project || !quiz) {
      return
    }

    const registry = getAutomationRegistry(projects)
    const nextAutomation = createAutomationTemplate('lead-intake', project.id, quiz, {
      name: `Messages for ${quiz.name}`,
      description: `Always-on follow-up flow for ${quiz.name}.`,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    })

    const nextRegistry = {
      ...registry,
      [project.id]: [...(registry[project.id] ?? []), nextAutomation],
    }

    saveAutomationRegistry(nextRegistry)
    setAutomationRefreshKey((current) => current + 1)
    setAutomationEditor(nextAutomation)
    setAutomationCategory('form-submissions')
    setAutomationCreateOpen(false)
    setAutomationComposerStep('editor')
    setSelectedProjectId(project.id)
    setSelectedQuizId(quiz.id)
  }

  function openQuizInBuilder(quizId: string, tab: BuilderTab = 'content') {
    const nextQuiz = formsInWorkspace.find((quiz) => quiz.id === quizId)
    if (!nextQuiz) {
      return
    }

    setOpenedQuizId(quizId)
    setSelectedQuizId(quizId)
    setBuilderTab(tab)
    setSelection(createDefaultSelection(nextQuiz))
    setFormActionMenuQuizId(null)
    setFormsSortMenuOpen(false)
    setFormsSearchOpen(false)
    setNewFormCanvasMode(isBlankComposerQuiz(nextQuiz) ? 'ai' : 'builder')
    setNewFormLibraryOpen(false)
  }

  async function handleStartFromScratch() {
    if (!selectedProject || !selectedQuiz) {
      return
    }

    const nextVariant = createQuizVariant({
      name: 'Page 1',
      questions: [
        {
          ...createQuestion('single', '...'),
          helper: 'Description (optional)',
          options: [{ id: createId('option'), label: 'choice 1', result: 'neutral' }],
        },
      ],
      intro: {
        heading: selectedQuiz.name,
        subcopy: 'Add a first question and shape the rest of the journey from here.',
        trustPoints: ['Draft', 'Not published', 'Editable'],
        cta: 'Start',
      },
    })

    const nextQuiz = ensureQuizWorkflow({
      ...selectedQuiz,
      variants: [nextVariant],
      leadSteps: [],
    })

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
          }
        : project,
    )

    setSelection({ kind: 'question', variantId: nextVariant.id, questionId: nextVariant.questions[0].id })
    setNewFormCanvasMode('builder')
    setNewFormLibraryOpen(false)
    setNewFormAiPrompt('')
    await persistProjects(nextProjects)
  }

  async function handleSubmitAiPrompt() {
    const trimmedPrompt = newFormAiPrompt.trim()
    if (!trimmedPrompt || !selectedProject || !selectedQuiz) {
      return
    }

    const nextVariant = createQuizVariant({
      name: 'Page 1',
      questions: [createQuestion('single', trimmedPrompt)],
      intro: {
        heading: selectedQuiz.name,
        subcopy: 'AI drafted the first step. You can now refine the rest of the flow manually.',
        trustPoints: ['Editable draft', 'Local preview', 'Ready to customize'],
        cta: 'Start',
      },
    })

    const nextLeadStep = createLeadStep('email')
    nextLeadStep.label = 'Where should we send the follow-up?'
    nextLeadStep.placeholder = 'Email address'

    const nextQuiz = ensureQuizWorkflow({
      ...selectedQuiz,
      name: selectedQuiz.name === 'My new form' ? trimmedPrompt.slice(0, 48) : selectedQuiz.name,
      variants: [nextVariant],
      leadSteps: [nextLeadStep],
    })

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
          }
        : project,
    )

    setSelection({ kind: 'question', variantId: nextVariant.id, questionId: nextVariant.questions[0].id })
    setNewFormCanvasMode('builder')
    setNewFormLibraryOpen(false)
    setNewFormComposerTab('ai')
    setNewFormAiPrompt('')
    await persistProjects(nextProjects)
  }

  async function handleInsertComposerElement(elementKey: string) {
    if (!selectedProject || !selectedQuiz) {
      return
    }

    const element = ALL_NEW_FORM_ELEMENTS.find((item) => item.key === elementKey)
    let nextSelection: BuilderSelection = selection ?? { kind: 'thank-you' }
    let nextQuiz = selectedQuiz

    if (elementKey === 'welcome-screen') {
      const firstVariant = selectedQuiz.variants[0] ?? createQuizVariant({ name: 'Page 1', questions: [] })
      const restoredVariant = {
        ...firstVariant,
        introHidden: false,
        intro: hasVisibleIntroScreen(firstVariant)
          ? firstVariant.intro
          : {
              heading: 'Welcome',
              subcopy: 'Add a short intro for this form.',
              trustPoints: ['Fast review', 'Confidential'],
              cta: 'Start',
            },
      }
      nextQuiz = ensureQuizWorkflow({
        ...selectedQuiz,
        variants: selectedQuiz.variants.length ? [restoredVariant, ...selectedQuiz.variants.slice(1)] : [restoredVariant],
      })
      nextSelection = { kind: 'intro', variantId: restoredVariant.id }
    } else if (['contact-info', 'email', 'phone-number', 'address', 'website'].includes(elementKey)) {
      const leadKind: LeadStep['kind'] = elementKey === 'email' ? 'email' : elementKey === 'phone-number' ? 'phone' : 'text'
      const nextLeadStep = createLeadStep(leadKind)
      nextLeadStep.label = element?.label ?? 'New field'
      nextLeadStep.builderElementKey = elementKey
      nextLeadStep.options = elementKey === 'contact-info'
        ? ['First name', 'Last name', 'Phone number', 'Email', 'Company']
        : elementKey === 'address'
          ? ['Address', 'Address line 2', 'City/Town', 'State/Region/Province', 'Zip/Post code', 'Country']
          : undefined
      nextLeadStep.placeholder = leadKind === 'text' ? `Enter ${nextLeadStep.label.toLowerCase()}` : nextLeadStep.placeholder
      nextQuiz = ensureQuizWorkflow({
        ...selectedQuiz,
        leadSteps: [...selectedQuiz.leadSteps, nextLeadStep],
      })
      nextSelection = { kind: 'lead', stepId: nextLeadStep.id }
    } else if (elementKey === 'end-screen') {
      handleAddEnding('end-screen')
      setNewFormCanvasMode('builder')
      setNewFormLibraryOpen(false)
      return
    } else if (elementKey === 'redirect') {
      handleAddEnding('redirect')
      setNewFormCanvasMode('builder')
      setNewFormLibraryOpen(false)
      return
    } else {
      const questionKind: Question['kind'] = ['checkbox', 'ranking', 'matrix', 'question-group'].includes(elementKey) ? 'multi' : 'single'
      const nextQuestion = createQuestion(questionKind, element?.label ?? 'New question')
      nextQuestion.builderElementKey = elementKey

      if (elementKey === 'yes-no') {
        nextQuestion.options = [
          { id: createId('option'), label: 'Yes', result: 'likely' },
          { id: createId('option'), label: 'No', result: 'soft-fail' },
        ]
      } else {
        const preset = getQuestionElementPreset(elementKey)
        nextQuestion.kind = preset.kind
        nextQuestion.options = createQuestionOptionsFromLabels(preset.optionLabels)
      }

      const baseVariant = selectedQuiz.variants[0] ?? createQuizVariant({ name: 'Page 1', questions: [] })
      const nextVariants = selectedQuiz.variants.length
        ? selectedQuiz.variants.map((variant, index) => (index === 0 ? { ...variant, questions: [...variant.questions, nextQuestion] } : variant))
        : [{ ...baseVariant, questions: [nextQuestion] }]

      nextQuiz = ensureQuizWorkflow({
        ...selectedQuiz,
        variants: nextVariants,
      })
      nextSelection = { kind: 'question', variantId: nextVariants[0].id, questionId: nextQuestion.id }
    }

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
          }
        : project,
    )

    setSelection(nextSelection)
    setNewFormCanvasMode('builder')
    setNewFormLibraryOpen(false)
    await persistProjects(nextProjects)
  }

  function handleAddPage() {
    setNewFormComposerTab('elements')
    setNewFormLibraryOpen(true)
  }

  async function handleDuplicateCurrentPage(item: BuilderPageItem) {
    if (!selectedProject || !selectedQuiz) {
      return
    }

    if (item.kind === 'intro') {
      const sourceVariant = selectedQuiz.variants.find((variant) => variant.id === item.variantId)
      if (!sourceVariant) {
        return
      }

      const duplicatedVariant = createQuizVariant({
        ...JSON.parse(JSON.stringify(sourceVariant)) as QuizVariant,
        id: createId('variant'),
        name: `${sourceVariant.name} copy`,
        questions: sourceVariant.questions.map((question) => ({
          ...question,
          id: createId('question'),
          options: question.options.map((option) => ({ ...option, id: createId('option') })),
        })),
      })

      const nextQuiz = ensureQuizWorkflow({
        ...selectedQuiz,
        variants: [...selectedQuiz.variants, duplicatedVariant],
      })

      const nextProjects = projects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
            }
          : project,
      )

      setBuilderPageMenuOpen(null)
      setSelection({ kind: 'intro', variantId: duplicatedVariant.id })
      await persistProjects(nextProjects)
      return
    }

    if (item.kind === 'question') {
      const sourceVariant = selectedQuiz.variants.find((variant) => variant.id === item.variantId)
      const questionIndex = sourceVariant?.questions.findIndex((question) => question.id === item.questionId) ?? -1
      if (!sourceVariant || questionIndex < 0) {
        return
      }

      const sourceQuestion = sourceVariant.questions[questionIndex]
      const duplicatedQuestion: Question = {
        ...JSON.parse(JSON.stringify(sourceQuestion)) as Question,
        id: createId('question'),
        options: sourceQuestion.options.map((option) => ({ ...option, id: createId('option') })),
      }

      const nextQuestions = [...sourceVariant.questions]
      nextQuestions.splice(questionIndex + 1, 0, duplicatedQuestion)

      const nextQuiz = ensureQuizWorkflow({
        ...selectedQuiz,
        variants: selectedQuiz.variants.map((variant) =>
          variant.id === sourceVariant.id
            ? { ...variant, questions: nextQuestions }
            : variant,
        ),
      })

      const nextProjects = projects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
            }
          : project,
      )

      setBuilderPageMenuOpen(null)
      setSelection({ kind: 'question', variantId: sourceVariant.id, questionId: duplicatedQuestion.id })
      await persistProjects(nextProjects)
      return
    }

    const leadIndex = selectedQuiz.leadSteps.findIndex((step) => step.id === item.stepId)
    if (item.kind !== 'lead' || leadIndex < 0) {
      return
    }

    const sourceStep = selectedQuiz.leadSteps[leadIndex]
    const duplicatedStep: LeadStep = {
      ...JSON.parse(JSON.stringify(sourceStep)) as LeadStep,
      id: createId('lead-step'),
      label: `${sourceStep.label} copy`,
    }

    const nextLeadSteps = [...selectedQuiz.leadSteps]
    nextLeadSteps.splice(leadIndex + 1, 0, duplicatedStep)

    const nextQuiz = ensureQuizWorkflow({
      ...selectedQuiz,
      leadSteps: nextLeadSteps,
    })

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
          }
        : project,
    )

    setBuilderPageMenuOpen(null)
    setSelection({ kind: 'lead', stepId: duplicatedStep.id })
    await persistProjects(nextProjects)
  }

  async function handleDeleteCurrentPage(item: BuilderPageItem, totalPageItems: number) {
    if (!selectedProject || !selectedQuiz) {
      return
    }

    if (totalPageItems <= 1) {
      setBuilderPageMenuOpen(null)
      return
    }

    if (item.kind === 'intro') {
      const nextQuiz = selectedQuiz.variants.length <= 1
        ? ensureQuizWorkflow({
            ...selectedQuiz,
            variants: selectedQuiz.variants.map((variant) =>
              variant.id === item.variantId
                ? {
                    ...variant,
                  introHidden: true,
                  }
                : variant,
            ),
          })
        : ensureQuizWorkflow({
            ...selectedQuiz,
            variants: selectedQuiz.variants.filter((variant) => variant.id !== item.variantId),
          })

      const nextProjects = projects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
            }
          : project,
      )

      setBuilderPageMenuOpen(null)
      setSelection(createDefaultSelection(nextQuiz))
      await persistProjects(nextProjects)
      return
    }

    if (item.kind === 'question') {
      const sourceVariant = selectedQuiz.variants.find((variant) => variant.id === item.variantId)
      if (!sourceVariant) {
        return
      }

      const nextQuiz = ensureQuizWorkflow({
        ...selectedQuiz,
        variants: selectedQuiz.variants.map((variant) =>
          variant.id === sourceVariant.id
            ? { ...variant, questions: variant.questions.filter((question) => question.id !== item.questionId) }
            : variant,
        ),
      })

      const nextProjects = projects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
            }
          : project,
      )

      setBuilderPageMenuOpen(null)
      setSelection(createDefaultSelection(nextQuiz))
      await persistProjects(nextProjects)
      return
    }

    if (item.kind !== 'lead') {
      return
    }

    const nextQuiz = ensureQuizWorkflow({
      ...selectedQuiz,
      leadSteps: selectedQuiz.leadSteps.filter((step) => step.id !== item.stepId),
    })

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            quizzes: project.quizzes.map((quiz) => (quiz.id === selectedQuiz.id ? nextQuiz : quiz)),
          }
        : project,
    )

    setBuilderPageMenuOpen(null)
    setSelection(createDefaultSelection(nextQuiz))
    await persistProjects(nextProjects)
  }

  function handleAddChoice() {
    if (!selectedQuestion || !selectedVariant || selection?.kind !== 'question') {
      return
    }

    const nextLabel = selectedQuestionElementKey === 'picture-choice'
      ? `Choice ${selectedQuestion.options.length + 1}`
      : selectedQuestionElementKey === 'ranking'
        ? 'choice'
        : `${builderPreviewCopy.choiceFallback} ${selectedQuestion.options.length + 1}`

    updateSelectedQuestion((question) => ({
      ...question,
      options: [...question.options, { id: createId('option'), label: nextLabel, result: 'neutral' }],
    }))
  }

  function handleUpdateSelectedQuestionOption(optionId: string, value: string) {
    updateSelectedQuestion((question) => ({
      ...question,
      options: question.options.map((option) => option.id === optionId ? { ...option, label: value } : option),
    }))
  }

  function handleRemoveSelectedQuestionOption(optionId: string) {
    if (!selectedQuestion || selectedQuestion.options.length <= 1) {
      return
    }

    updateSelectedQuestion((question) => ({
      ...question,
      options: question.options.filter((option) => option.id !== optionId),
    }))
  }

  function handleAddEnding(type: 'end-screen' | 'redirect') {
    setBuilderEndingsMenuOpen(false)
    setSelection({ kind: 'thank-you' })

    if (type === 'redirect') {
      updateSelectedQuiz((quiz) => ({
        ...quiz,
        thankYouScreen: {
          ...quiz.thankYouScreen,
          primaryCta: 'Continue',
          secondaryCta: 'Redirect to URL',
        },
      }))
    }
  }

  function handleSelectBuilderAnswerType(elementKey: string) {
    setBuilderAnswerTypeKey(elementKey)
    setBuilderAnswerMenuOpen(false)

    if (!selectedQuestion || !selectedVariant || selection?.kind !== 'question') {
      return
    }

    if (elementKey === 'yes-no') {
      updateSelectedQuestion((question) => ({
        ...question,
        kind: 'single',
        builderElementKey: 'yes-no',
        options: [
          { id: createId('option'), label: 'Yes', result: 'likely' },
          { id: createId('option'), label: 'No', result: 'soft-fail' },
        ],
      }))
      return
    }

    const preset = getQuestionElementPreset(elementKey)
    const shouldPreserveOptions = BUILDER_CHOICE_EDITOR_KEYS.has(elementKey) && selectedQuestion.options.length > 0

    updateSelectedQuestion((question) => ({
      ...question,
      kind: preset.kind,
      builderElementKey: elementKey,
      options: shouldPreserveOptions ? question.options : createQuestionOptionsFromLabels(preset.optionLabels),
    }))
  }

  function handleToggleBuilderSetting(toggleKey: BuilderToggleKey) {
    setBuilderToggleState((current) => ({
      ...current,
      [currentSelectionStorageKey]: {
        ...DEFAULT_BUILDER_TOGGLES,
        ...current[currentSelectionStorageKey],
        [toggleKey]: !(current[currentSelectionStorageKey]?.[toggleKey] ?? DEFAULT_BUILDER_TOGGLES[toggleKey]),
      },
    }))
  }

  async function copyQuizLink(quiz: QuizDefinition) {
    const nextUrl = `${window.location.origin}/q/${quiz.slug}`
    await navigator.clipboard.writeText(nextUrl)
    setFormActionMenuQuizId(null)
  }

  function openQuizActionModal(mode: QuizActionModal, quiz: QuizDefinition) {
    setQuizActionModal(mode)
    setQuizActionQuizId(quiz.id)
    setQuizActionName(quiz.name)
    setQuizActionTargetProjectId(selectedProject?.id ?? '')
    setFormActionMenuQuizId(null)
  }

  function closeQuizActionModal() {
    setQuizActionModal(null)
    setQuizActionQuizId(null)
    setQuizActionName('')
    setQuizActionTargetProjectId('')
  }

  async function handleDuplicateQuiz(quiz: QuizDefinition) {
    if (!selectedProject) {
      return
    }

    const duplicate = applySharedThemesToQuiz(
      cloneQuizDefinition(quiz, {
        name: `${quiz.name} copy`,
        status: 'draft',
      }),
      quiz.builderDesign?.activeThemeId,
    )

    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            quizzes: [...project.quizzes, duplicate],
          }
        : project,
    )

    await persistProjects(nextProjects)
    setFormActionMenuQuizId(null)
  }

  async function handleDeleteQuiz(quizId: string) {
    if (!selectedProject) {
      return
    }

    const nextQuizzes = selectedProject.quizzes.filter((quiz) => quiz.id !== quizId)
    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id
        ? {
            ...project,
            activeQuizId: nextQuizzes[0]?.id ?? '',
            quizzes: nextQuizzes,
          }
        : project,
    )

    if (selectedQuizId === quizId || openedQuizId === quizId) {
      setSelectedQuizId(nextQuizzes[0]?.id ?? '')
      setOpenedQuizId(null)
      setSelection(nextQuizzes[0] ? createDefaultSelection(nextQuizzes[0]) : null)
    }

    await persistProjects(nextProjects)
    setFormActionMenuQuizId(null)
  }

  async function handleSubmitQuizAction() {
    if (!selectedProject || !quizActionQuizId || !quizActionModal) {
      return
    }

    const sourceQuiz = selectedProject.quizzes.find((quiz) => quiz.id === quizActionQuizId)
    if (!sourceQuiz) {
      return
    }

    if (quizActionModal === 'rename') {
      const nextProjects = projects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              quizzes: project.quizzes.map((quiz) =>
                quiz.id === sourceQuiz.id
                  ? { ...quiz, name: quizActionName.trim() || quiz.name, slug: toSlug(quizActionName.trim() || quiz.name, quiz.slug) }
                  : quiz,
              ),
            }
          : project,
      )
      await persistProjects(nextProjects)
      closeQuizActionModal()
      return
    }

    const targetProjectId = quizActionTargetProjectId || selectedProject.id
    const clonedQuiz = applySharedThemesToQuiz(
      cloneQuizDefinition(sourceQuiz, { name: quizActionName.trim() || sourceQuiz.name }),
      sourceQuiz.builderDesign?.activeThemeId,
    )

    const nextProjects = projects.map((project) => {
      if (quizActionModal === 'move' && project.id === selectedProject.id) {
        return {
          ...project,
          activeQuizId: project.activeQuizId === sourceQuiz.id ? project.quizzes.find((quiz) => quiz.id !== sourceQuiz.id)?.id ?? '' : project.activeQuizId,
          quizzes: project.quizzes.filter((quiz) => quiz.id !== sourceQuiz.id),
        }
      }

      if (project.id === targetProjectId) {
        return {
          ...project,
          activeQuizId: project.activeQuizId || (quizActionModal === 'move' ? sourceQuiz.id : clonedQuiz.id),
          quizzes: [...project.quizzes, quizActionModal === 'move' ? sourceQuiz : clonedQuiz],
        }
      }

      return project
    })

    await persistProjects(nextProjects)

    if (quizActionModal === 'move') {
      const targetProject = getProjectById(nextProjects, targetProjectId)
      const movedQuiz = targetProject.quizzes.find((quiz) => quiz.id === sourceQuiz.id) ?? null
      setSelectedProjectId(targetProject.id)
      setSelectedQuizId(movedQuiz?.id ?? '')
      setOpenedQuizId(null)
      setSelection(movedQuiz ? createDefaultSelection(movedQuiz) : null)
    }

    closeQuizActionModal()
  }

  function renderFormsViewActions() {
    return (
      <div className="admin-v2-page-actions">
        <div className="admin-v2-dropdown-wrap" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="admin-v2-ghost-button" onClick={() => setFormsSortMenuOpen((current) => !current)}>
            {QUIZ_SORT_OPTIONS.find((option) => option.key === formsSort)?.label ?? 'Date created'}
          </button>
          {formsSortMenuOpen ? (
            <div className="admin-v2-popover-menu">
              {QUIZ_SORT_OPTIONS.map((option) => (
                <button key={option.key} type="button" className={formsSort === option.key ? 'is-active' : ''} onClick={() => { setFormsSort(option.key); setFormsSortMenuOpen(false) }}>
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="admin-v2-view-toggle" role="group" aria-label="Forms view mode">
          <button type="button" className={`admin-v2-ghost-button ${formsViewMode === 'list' ? 'is-active' : ''}`} aria-pressed={formsViewMode === 'list'} onClick={() => setFormsViewMode('list')}>
            List
          </button>
          <button type="button" className={`admin-v2-ghost-button ${formsViewMode === 'grid' ? 'is-active' : ''}`} aria-pressed={formsViewMode === 'grid'} onClick={() => setFormsViewMode('grid')}>
            Grid
          </button>
        </div>
      </div>
    )
  }

  function renderLogin() {
    return (
      <div className="admin-v2-login-shell">
        <section className="admin-v2-login-card">
          <div className="admin-v2-login-mark" aria-hidden="true">N</div>
          <div className="admin-v2-login-header">
            <div className="admin-v2-chip">Admin access</div>
          </div>
          <div className="admin-v2-login-copy">
            <h2>Open builder</h2>
            <p>Sign in to manage forms, themes, automations, leads, and your live builder workspace.</p>
          </div>
          <label className="admin-v2-login-field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label className="admin-v2-login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSignIn()
                }
              }}
            />
          </label>
          <div className="admin-v2-login-meta">
            <label className="admin-v2-check">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Remember me</span>
            </label>
          </div>
          <div className="admin-v2-login-actions">
            <Button tone="primary" onClick={() => void handleSignIn()}>Enter builder</Button>
          </div>
          {loginError ? <p className="admin-v2-error">{loginError}</p> : null}
        </section>
      </div>
    )
  }

  function renderFormsHome() {
    if (!selectedProject) {
      return (
        <div className="admin-v2-page admin-v2-forms-home">
          <section className="admin-v2-empty-state is-forms-empty is-no-workspace">
            <div>
              <h2>No workspace selected</h2>
              <p>Create a workspace first, then add forms inside it.</p>
              <div className="admin-v2-empty-actions">
                <Button tone="primary" onClick={openWorkspaceModal}>Create workspace</Button>
              </div>
            </div>
          </section>
        </div>
      )
    }

    if (!formsInWorkspace.length) {
      return (
        <div className="admin-v2-page admin-v2-forms-home">
          <header className="admin-v2-page-header">
            <div className="admin-v2-page-title-row">
              <div className="admin-v2-page-title-group">
                <h1>{selectedProject.name}</h1>
                <div className="admin-v2-page-inline-actions">
                  <div className="admin-v2-workspace-menu-wrap" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className={`admin-v2-icon-button ${workspaceMenuOpen ? 'is-active' : ''}`} onClick={() => setWorkspaceMenuOpen((current) => !current)}>
                      ⋯
                    </button>
                    {workspaceMenuOpen ? (
                      <div className="admin-v2-context-menu" onClick={(event) => event.stopPropagation()}>
                        <button type="button" onClick={openRenameWorkspaceModal}>Rename</button>
                        <button type="button" onClick={() => void removeWorkspace(selectedProject.id)}>Leave</button>
                        <button type="button" className="is-danger" onClick={() => void removeWorkspace(selectedProject.id)}>Delete</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {renderFormsViewActions()}
          </header>

          <section className="admin-v2-empty-state is-forms-empty">
            <div>
              <h2>There’s not a form in sight</h2>
              <p>{formsSearchQuery ? 'No forms match your current search.' : 'Create your first form in this workspace to start building qualification flows, lead capture, and follow-up.'}</p>
              <div className="admin-v2-empty-actions">
                <Button tone="primary" onClick={() => void handleCreateForm()}>Create a new form</Button>
              </div>
            </div>
          </section>
        </div>
      )
    }

    return (
      <div className="admin-v2-page admin-v2-forms-home">
        <header className="admin-v2-page-header">
          <div className="admin-v2-page-title-row">
            <div className="admin-v2-page-title-group">
              <h1>{selectedProject.name}</h1>
              <div className="admin-v2-page-inline-actions">
                <div className="admin-v2-workspace-menu-wrap" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className={`admin-v2-icon-button ${workspaceMenuOpen ? 'is-active' : ''}`} onClick={() => setWorkspaceMenuOpen((current) => !current)}>
                    ⋯
                  </button>
                  {workspaceMenuOpen ? (
                    <div className="admin-v2-context-menu" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={openRenameWorkspaceModal}>Rename</button>
                      <button type="button" onClick={() => void removeWorkspace(selectedProject.id)}>Leave</button>
                      <button type="button" className="is-danger" onClick={() => void removeWorkspace(selectedProject.id)}>Delete</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {renderFormsViewActions()}
        </header>

        {formsViewMode === 'list' ? (
          <section className="admin-v2-forms-table">
            <div className="admin-v2-forms-table-head">
              <span />
              <span />
              <span>Responses</span>
              <span>Completion</span>
              <span>Updated</span>
              <span>Integrations</span>
              <span />
            </div>
            {visibleForms.map((quiz) => {
              const metrics = getDashboardMetricsForQuiz(quiz)

              return (
                <div key={quiz.id} className="admin-v2-form-row-shell">
                  <div className="admin-v2-form-row" role="button" tabIndex={0} onClick={() => openQuizInBuilder(quiz.id, 'content')} onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openQuizInBuilder(quiz.id, 'content')
                    }
                  }}>
                    <span className="admin-v2-form-icon" />
                    <span className="admin-v2-form-title">{quiz.name}</span>
                    <span>{metrics.leadCount || '-'}</span>
                    <span>{Math.round(metrics.completionRate * 100)}%</span>
                    <span>{getQuizDateLabel(quiz)}</span>
                    <button type="button" className="admin-v2-inline-icon-button" title="Add integrations" onClick={(event) => { event.stopPropagation(); openQuizInBuilder(quiz.id, 'connect') }}>
                      {selectedAutomations.filter((automation) => automation.quizId === quiz.id).length}
                    </button>
                    <div className="admin-v2-form-action-anchor" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="admin-v2-inline-icon-button" onClick={() => setFormActionMenuQuizId((current) => current === quiz.id ? null : quiz.id)}>⋯</button>
                      {formActionMenuQuizId === quiz.id ? (
                        <div className="admin-v2-popover-menu is-form-actions">
                          <button type="button" onClick={() => void copyQuizLink(quiz)}>Copy link</button>
                          <button type="button" onClick={() => openQuizInBuilder(quiz.id, 'content')}>Content</button>
                          <button type="button" onClick={() => openQuizInBuilder(quiz.id, 'workflow')}>Workflow</button>
                          <button type="button" onClick={() => openQuizInBuilder(quiz.id, 'connect')}>Connect</button>
                          <button type="button" onClick={() => openQuizActionModal('rename', quiz)}>Rename</button>
                          <button type="button" onClick={() => void handleDuplicateQuiz(quiz)}>Duplicate</button>
                          <button type="button" onClick={() => openQuizActionModal('copy', quiz)}>Copy to</button>
                          <button type="button" onClick={() => openQuizActionModal('move', quiz)}>Move to</button>
                          <button type="button" className="is-danger" onClick={() => void handleDeleteQuiz(quiz.id)}>Delete</button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        ) : (
          <section className="admin-v2-forms-grid">
            {visibleForms.map((quiz) => (
              <article key={quiz.id} className="admin-v2-form-card" onClick={() => openQuizInBuilder(quiz.id, 'content')}>
                <div className="admin-v2-form-card-top">
                  <span className="admin-v2-form-icon" />
                  <div className="admin-v2-form-action-anchor" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="admin-v2-inline-icon-button" onClick={() => setFormActionMenuQuizId((current) => current === quiz.id ? null : quiz.id)}>⋯</button>
                    {formActionMenuQuizId === quiz.id ? (
                      <div className="admin-v2-popover-menu is-form-actions">
                        <button type="button" onClick={() => void copyQuizLink(quiz)}>Copy link</button>
                        <button type="button" onClick={() => openQuizInBuilder(quiz.id, 'content')}>Content</button>
                        <button type="button" onClick={() => openQuizInBuilder(quiz.id, 'workflow')}>Workflow</button>
                        <button type="button" onClick={() => openQuizInBuilder(quiz.id, 'connect')}>Connect</button>
                        <button type="button" onClick={() => openQuizActionModal('rename', quiz)}>Rename</button>
                        <button type="button" onClick={() => void handleDuplicateQuiz(quiz)}>Duplicate</button>
                        <button type="button" onClick={() => openQuizActionModal('copy', quiz)}>Copy to</button>
                        <button type="button" onClick={() => openQuizActionModal('move', quiz)}>Move to</button>
                        <button type="button" className="is-danger" onClick={() => void handleDeleteQuiz(quiz.id)}>Delete</button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="admin-v2-form-card-bottom">
                  <strong>{quiz.name}</strong>
                  <span>{getQuizDateLabel(quiz)}</span>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    )
  }

  function renderPreviewCanvas() {
    if (!selectedQuiz || !selection) {
      return null
    }

    const previewLogo = activeBuilderTheme?.logoImage ? (
      <div className="admin-v2-preview-theme-logo-wrap" style={builderPreviewStyles.logoWrapStyle}>
        <img
          className="admin-v2-preview-theme-logo"
          style={builderPreviewStyles.logoStyle}
          src={activeBuilderTheme.logoImage}
          alt={activeBuilderTheme.logoAlt || activeBuilderTheme.name}
        />
      </div>
    ) : null

    if (selection.kind === 'intro' && selectedVariant) {
      return (
        <div className="admin-v2-preview-card admin-v2-preview-card--themed" style={builderPreviewStyles.cardStyle}>
          {previewLogo}
          <div className="admin-v2-preview-body admin-v2-preview-body--intro" style={builderPreviewStyles.bodyStyle}>
            <div className="admin-v2-preview-kicker">{builderPreviewCopy.welcome}</div>
            <h2 style={builderPreviewStyles.titleStyle}>{selectedVariant.intro.heading}</h2>
            <p style={builderPreviewStyles.descriptionStyle}>{selectedVariant.intro.subcopy}</p>
            <div className="admin-v2-preview-tags">
              {selectedVariant.intro.trustPoints.map((point) => (
                <span key={point} style={builderPreviewStyles.secondaryButtonStyle}>{point}</span>
              ))}
            </div>
            <button type="button" className="admin-v2-preview-button" style={builderPreviewStyles.buttonStyle}>{selectedVariant.intro.cta}</button>
          </div>
        </div>
      )
    }

    if (selection.kind === 'question' && selectedQuestion) {
      return (
        <div className="admin-v2-preview-card admin-v2-preview-card--themed" style={builderPreviewStyles.cardStyle}>
          {previewLogo}
          <div className={`admin-v2-preview-body admin-v2-preview-body--question is-${selectedQuestionElementKey}`} style={builderPreviewStyles.bodyStyle}>
            <div className="admin-v2-preview-question-head">
              <span className="admin-v2-preview-kicker">1°</span>
              <textarea
                value={selectedQuestion.prompt}
                className="admin-v2-preview-inline-title"
                style={builderPreviewStyles.titleStyle}
                placeholder="..."
                onChange={(event) => updateSelectedQuestion((question) => ({ ...question, prompt: event.target.value }))}
              />
            </div>
            <textarea
              value={selectedQuestion.helper ?? ''}
              className="admin-v2-preview-inline-helper"
              style={builderPreviewStyles.descriptionStyle}
              placeholder={builderPreviewCopy.optionalDescription}
              onChange={(event) => updateSelectedQuestion((question) => ({ ...question, helper: event.target.value }))}
            />
            {renderQuestionPreviewBody()}
          </div>
        </div>
      )
    }

    if (selection.kind === 'lead' && selectedLeadStep) {
      return (
        <div className="admin-v2-preview-card admin-v2-preview-card--themed" style={builderPreviewStyles.cardStyle}>
          {previewLogo}
          <div className={`admin-v2-preview-body admin-v2-preview-body--lead is-${selectedLeadElementKey}`} style={builderPreviewStyles.bodyStyle}>
            <div className="admin-v2-preview-kicker">{builderPreviewCopy.contactInfo}</div>
            <textarea
              value={selectedLeadStep.label}
              className="admin-v2-preview-inline-title"
              style={builderPreviewStyles.titleStyle}
              placeholder="Lead step title"
              onChange={(event) => updateSelectedLeadStep((step) => ({ ...step, label: event.target.value }))}
            />
            <textarea
              value={selectedLeadStep.helper ?? ''}
              className="admin-v2-preview-inline-helper"
              style={builderPreviewStyles.descriptionStyle}
              placeholder={builderPreviewCopy.optionalDescription}
              onChange={(event) => updateSelectedLeadStep((step) => ({ ...step, helper: event.target.value }))}
            />
            {renderLeadPreviewBody()}
          </div>
        </div>
      )
    }

    if (selection.kind === 'transition') {
      return (
        <div className="admin-v2-preview-card admin-v2-preview-card--themed" style={builderPreviewStyles.cardStyle}>
          {previewLogo}
          <div className="admin-v2-preview-body admin-v2-preview-body--transition" style={builderPreviewStyles.bodyStyle}>
            <div className="admin-v2-preview-kicker">{builderPreviewCopy.transition}</div>
            <h2 style={builderPreviewStyles.titleStyle}>{selectedQuiz.transitionScreen.heading}</h2>
            <p style={builderPreviewStyles.descriptionStyle}>{selectedQuiz.transitionScreen.body}</p>
            <button type="button" className="admin-v2-preview-button" style={builderPreviewStyles.buttonStyle}>{selectedQuiz.transitionScreen.cta}</button>
          </div>
        </div>
      )
    }

    if (selection.kind === 'result') {
      const result = selectedQuiz.resultContent[selection.resultKey]
      return (
        <div className="admin-v2-preview-card admin-v2-preview-card--themed" style={builderPreviewStyles.cardStyle}>
          {previewLogo}
          <div className="admin-v2-preview-body admin-v2-preview-body--result" style={builderPreviewStyles.bodyStyle}>
            <div className="admin-v2-preview-kicker">{builderPreviewCopy.result}</div>
            <h2 style={builderPreviewStyles.titleStyle}>{result.title}</h2>
            <p style={builderPreviewStyles.descriptionStyle}>{result.body}</p>
            <div className="admin-v2-preview-actions-row">
              <button type="button" className="admin-v2-preview-button" style={builderPreviewStyles.buttonStyle}>{result.primaryCta}</button>
              {result.secondaryCta ? <button type="button" className="admin-v2-preview-secondary" style={builderPreviewStyles.secondaryButtonStyle}>{result.secondaryCta}</button> : null}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="admin-v2-preview-card admin-v2-preview-card--themed" style={builderPreviewStyles.cardStyle}>
        {previewLogo}
        <div className="admin-v2-preview-body admin-v2-preview-body--ending" style={builderPreviewStyles.bodyStyle}>
          <div className="admin-v2-preview-kicker">{builderPreviewCopy.ending}</div>
          <h2 style={builderPreviewStyles.titleStyle}>{selectedQuiz.thankYouScreen.heading}</h2>
          <p style={builderPreviewStyles.descriptionStyle}>{selectedQuiz.thankYouScreen.body}</p>
        </div>
      </div>
    )
  }

  function renderPropertiesPanel() {
    if (!selectedQuiz || !selection) {
      return null
    }

    if (selection.kind === 'intro' && selectedVariant) {
      return (
        <div className="admin-v2-properties-card">
          <h3>Welcome</h3>
          <label><span>Heading</span><input value={selectedVariant.intro.heading} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, variants: quiz.variants.map((variant) => variant.id === selectedVariant.id ? { ...variant, intro: { ...variant.intro, heading: event.target.value } } : variant) }))} /></label>
          <label><span>Subcopy</span><textarea value={selectedVariant.intro.subcopy} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, variants: quiz.variants.map((variant) => variant.id === selectedVariant.id ? { ...variant, intro: { ...variant.intro, subcopy: event.target.value } } : variant) }))} /></label>
          <label><span>CTA</span><input value={selectedVariant.intro.cta} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, variants: quiz.variants.map((variant) => variant.id === selectedVariant.id ? { ...variant, intro: { ...variant.intro, cta: event.target.value } } : variant) }))} /></label>
        </div>
      )
    }

    if (selection.kind === 'question' && selectedQuestion && selectedVariant) {
      return (
        <div className="admin-v2-properties-card">
          <h3>Question</h3>
          <label><span>Prompt</span><textarea value={selectedQuestion.prompt} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, variants: quiz.variants.map((variant) => variant.id === selectedVariant.id ? { ...variant, questions: variant.questions.map((question) => question.id === selectedQuestion.id ? { ...question, prompt: event.target.value } : question) } : variant) }))} /></label>
          <label><span>Helper</span><textarea value={selectedQuestion.helper ?? ''} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, variants: quiz.variants.map((variant) => variant.id === selectedVariant.id ? { ...variant, questions: variant.questions.map((question) => question.id === selectedQuestion.id ? { ...question, helper: event.target.value } : question) } : variant) }))} /></label>
          <div className="admin-v2-properties-list">
            {selectedQuestion.options.map((option, index) => (
              <label key={option.id}><span>Answer {index + 1}</span><input value={option.label} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, variants: quiz.variants.map((variant) => variant.id === selectedVariant.id ? { ...variant, questions: variant.questions.map((question) => question.id === selectedQuestion.id ? { ...question, options: question.options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item) } : question) } : variant) }))} /></label>
            ))}
          </div>
        </div>
      )
    }

    if (selection.kind === 'lead' && selectedLeadStep) {
      return (
        <div className="admin-v2-properties-card">
          <h3>Contact info</h3>
          <label><span>Label</span><textarea value={selectedLeadStep.label} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, leadSteps: quiz.leadSteps.map((step) => step.id === selectedLeadStep.id ? { ...step, label: event.target.value } : step) }))} /></label>
          <label><span>Helper</span><textarea value={selectedLeadStep.helper ?? ''} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, leadSteps: quiz.leadSteps.map((step) => step.id === selectedLeadStep.id ? { ...step, helper: event.target.value } : step) }))} /></label>
          <label><span>Type</span><input value={selectedLeadStep.kind} readOnly /></label>
        </div>
      )
    }

    if (selection.kind === 'transition') {
      return (
        <div className="admin-v2-properties-card">
          <h3>Transition</h3>
          <label><span>Heading</span><textarea value={selectedQuiz.transitionScreen.heading} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, transitionScreen: { ...quiz.transitionScreen, heading: event.target.value } }))} /></label>
          <label><span>Body</span><textarea value={selectedQuiz.transitionScreen.body} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, transitionScreen: { ...quiz.transitionScreen, body: event.target.value } }))} /></label>
        </div>
      )
    }

    if (selection.kind === 'result') {
      const result = selectedQuiz.resultContent[selection.resultKey]
      return (
        <div className="admin-v2-properties-card">
          <h3>Result</h3>
          <label><span>Title</span><textarea value={result.title} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, resultContent: { ...quiz.resultContent, [selection.resultKey]: { ...quiz.resultContent[selection.resultKey], title: event.target.value } } }))} /></label>
          <label><span>Body</span><textarea value={result.body} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, resultContent: { ...quiz.resultContent, [selection.resultKey]: { ...quiz.resultContent[selection.resultKey], body: event.target.value } } }))} /></label>
        </div>
      )
    }

    return (
      <div className="admin-v2-properties-card">
        <h3>Thank you</h3>
        <label><span>Heading</span><textarea value={selectedQuiz.thankYouScreen.heading} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, thankYouScreen: { ...quiz.thankYouScreen, heading: event.target.value } }))} /></label>
        <label><span>Body</span><textarea value={selectedQuiz.thankYouScreen.body} onChange={(event) => updateSelectedQuiz((quiz) => ({ ...quiz, thankYouScreen: { ...quiz.thankYouScreen, body: event.target.value } }))} /></label>
      </div>
    )
  }

  function renderQuestionInspectorFields() {
    if (!selectedQuestion) {
      return null
    }

    if (BUILDER_FIELD_GROUP_KEYS.has(selectedQuestionElementKey)) {
      return (
        <div className="admin-v2-builder-form-stack admin-v2-builder-form-stack--tight">
          {selectedQuestion.options.map((option) => (
            <div key={option.id} className="admin-v2-builder-inline-field-row">
              <input value={option.label} onChange={(event) => handleUpdateSelectedQuestionOption(option.id, event.target.value)} />
            </div>
          ))}
        </div>
      )
    }

    if (BUILDER_TEXT_ENTRY_KEYS.has(selectedQuestionElementKey) || selectedQuestionElementKey === 'phone-number') {
      return (
        <div className="admin-v2-builder-form-stack admin-v2-builder-form-stack--tight">
          <label>
            <span>Placeholder</span>
            <input value={selectedQuestion.options[0]?.label ?? ''} onChange={(event) => selectedQuestion.options[0] ? handleUpdateSelectedQuestionOption(selectedQuestion.options[0].id, event.target.value) : null} />
          </label>
        </div>
      )
    }

    if (BUILDER_MEDIA_KEYS.has(selectedQuestionElementKey) || BUILDER_ACTION_KEYS.has(selectedQuestionElementKey)) {
      return (
        <div className="admin-v2-builder-form-stack admin-v2-builder-form-stack--tight">
          <label>
            <span>Primary CTA</span>
            <input value={selectedQuestion.options[0]?.label ?? ''} onChange={(event) => selectedQuestion.options[0] ? handleUpdateSelectedQuestionOption(selectedQuestion.options[0].id, event.target.value) : null} />
          </label>
        </div>
      )
    }

    if (BUILDER_CHOICE_EDITOR_KEYS.has(selectedQuestionElementKey)) {
      return (
        <div className="admin-v2-builder-choice-editor">
          {selectedQuestion.options.map((option, index) => (
            <div key={option.id} className="admin-v2-builder-choice-editor-row">
              <input value={option.label} onChange={(event) => handleUpdateSelectedQuestionOption(option.id, event.target.value)} />
              <button type="button" className="admin-v2-builder-inline-remove" onClick={() => handleRemoveSelectedQuestionOption(option.id)} disabled={selectedQuestion.options.length <= 1}>×</button>
              <span className="admin-v2-builder-choice-editor-index">{index + 1}</span>
            </div>
          ))}
          <button type="button" className="admin-v2-builder-graph-action" onClick={handleAddChoice}>Add choice</button>
        </div>
      )
    }

    return null
  }

  function renderQuestionInspectorToggles() {
    const toggleKeys = getQuestionToggleKeys(selectedQuestionElementKey)
    if (!toggleKeys.length) {
      return null
    }

    return (
      <div className="admin-v2-builder-toggle-list">
        {toggleKeys.map((toggleKey) => (
          <div key={toggleKey} className="admin-v2-builder-toggle-row">
            <span>{getBuilderToggleLabel(toggleKey)}</span>
            <button type="button" className={`admin-v2-builder-toggle ${currentBuilderToggles[toggleKey] ? 'is-on' : ''}`} onClick={() => handleToggleBuilderSetting(toggleKey)}><span /></button>
          </div>
        ))}
      </div>
    )
  }

  function renderLeadInspectorFields() {
    if (!selectedLeadStep) {
      return null
    }

    if (selectedLeadElementKey === 'contact-info' || selectedLeadElementKey === 'address') {
      return (
        <div className="admin-v2-builder-form-stack admin-v2-builder-form-stack--tight">
          {(selectedLeadStep.options ?? []).map((field, index) => (
            <label key={`${selectedLeadStep.id}-${field}-${index}`}>
              <span>Field {index + 1}</span>
              <input value={field} onChange={(event) => updateSelectedLeadStep((step) => ({ ...step, options: (step.options ?? []).map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} />
            </label>
          ))}
        </div>
      )
    }

    return (
      <div className="admin-v2-builder-form-stack admin-v2-builder-form-stack--tight">
        <label>
          <span>Placeholder</span>
          <input value={selectedLeadStep.placeholder ?? ''} onChange={(event) => updateSelectedLeadStep((step) => ({ ...step, placeholder: event.target.value }))} />
        </label>
      </div>
    )
  }

  function renderLeadInspectorToggles() {
    const toggleKeys: BuilderToggleKey[] = selectedLeadElementKey === 'contact-info' || selectedLeadElementKey === 'address'
      ? []
      : ['required']

    if (!toggleKeys.length) {
      return null
    }

    return (
      <div className="admin-v2-builder-toggle-list">
        {toggleKeys.map((toggleKey) => (
          <div key={toggleKey} className="admin-v2-builder-toggle-row">
            <span>{getBuilderToggleLabel(toggleKey)}</span>
            <button type="button" className={`admin-v2-builder-toggle ${currentBuilderToggles[toggleKey] ? 'is-on' : ''}`} onClick={() => handleToggleBuilderSetting(toggleKey)}><span /></button>
          </div>
        ))}
      </div>
    )
  }

  function renderBuilderInspector() {
    if (builderTab !== 'content') {
      if (builderTab === 'workflow') {
        return (
          <aside className="admin-v2-builder-inspector">
            <section className="admin-v2-builder-panel-card">
              <div className="admin-v2-builder-panel-title-row">
                <h3>Workflow</h3>
                <span>{selectedQuiz?.workflow.edges.length ?? 0} routes</span>
              </div>
              <p>{selectedWorkflowNode ? `${selectedWorkflowNode.title} is selected in the graph.` : 'Select a node to inspect and route the journey.'}</p>
            </section>

            <section className="admin-v2-builder-panel-card">
              <div className="admin-v2-builder-panel-title-row">
                <h3>Selected node</h3>
                <span>{selectedWorkflowNode?.type ?? 'none'}</span>
              </div>
              {selectedWorkflowNode ? (
                <>
                  <strong>{selectedWorkflowNode.title}</strong>
                  <span className="admin-v2-builder-panel-meta">{getWorkflowRuleLabel(selectedWorkflowNode)}</span>
                  <div className="admin-v2-builder-action-list">
                    <button type="button" className="admin-v2-builder-graph-action" onClick={handleOpenWorkflowNodeInContent}>Open in content</button>
                    <button type="button" className="admin-v2-builder-graph-action" onClick={handleSetWorkflowStartNode}>Set as start</button>
                  </div>
                </>
              ) : (
                <p>No node selected.</p>
              )}
            </section>

            <section className="admin-v2-builder-panel-card is-branching">
              <div className="admin-v2-builder-panel-title-row">
                <h3>Outgoing routes</h3>
                <span>{selectedWorkflowNode ? selectedQuiz?.workflow.edges.filter((edge) => edge.source === selectedWorkflowNode.id).length ?? 0 : 0}</span>
              </div>
              <div className="admin-v2-builder-route-list">
                {selectedWorkflowNode
                  ? (selectedQuiz?.workflow.edges.filter((edge) => edge.source === selectedWorkflowNode.id) ?? []).map((edge) => {
                      const targetNode = selectedQuiz?.workflow.nodes.find((node) => node.id === edge.target)
                      return (
                        <button key={edge.id} type="button" className={`admin-v2-builder-route-card ${selectedWorkflowEdgeId === edge.id ? 'is-active' : ''}`} onClick={() => setSelectedWorkflowEdgeId(edge.id)}>
                          <strong>{edge.label || edge.rule?.kind || 'Next'}</strong>
                          <span>{targetNode?.title ?? 'Unknown target'}</span>
                        </button>
                      )
                    })
                  : null}
                {selectedWorkflowNode && !(selectedQuiz?.workflow.edges.filter((edge) => edge.source === selectedWorkflowNode.id).length) ? <p>No routes from this node yet.</p> : null}
              </div>
            </section>

            <section className="admin-v2-builder-panel-card">
              <div className="admin-v2-builder-panel-title-row">
                <h3>Route editor</h3>
                <span>{selectedWorkflowEdge ? getWorkflowEdgeRuleLabel(selectedWorkflowEdge) : 'none'}</span>
              </div>
              {selectedWorkflowEdge ? (
                <div className="admin-v2-builder-form-stack">
                  <label>
                    <span>Label</span>
                    <input value={selectedWorkflowEdge.label ?? ''} onChange={(event) => updateSelectedWorkflowEdge((edge) => ({ ...edge, label: event.target.value }))} />
                  </label>
                  <label>
                    <span>Rule type</span>
                    <select value={selectedWorkflowEdge.rule?.kind ?? 'always'} onChange={(event) => updateSelectedWorkflowEdge((edge) => ({
                      ...edge,
                      rule: event.target.value === 'result'
                        ? { kind: 'result', resultKey: 'likely' }
                        : event.target.value === 'answer'
                          ? { kind: 'answer', answerValue: 'Choice 1' }
                          : { kind: 'always' },
                    }))}>
                      <option value="always">Always</option>
                      <option value="result">Result</option>
                      <option value="answer">Answer</option>
                    </select>
                  </label>
                  {selectedWorkflowEdge.rule?.kind === 'result' ? (
                    <label>
                      <span>Result key</span>
                      <select value={selectedWorkflowEdge.rule.resultKey ?? 'likely'} onChange={(event) => updateSelectedWorkflowEdge((edge) => ({
                        ...edge,
                        rule: { kind: 'result', resultKey: event.target.value as ResultKey },
                      }))}>
                        <option value="likely">Likely</option>
                        <option value="maybe">Maybe</option>
                        <option value="soft-fail">Soft fail</option>
                        <option value="hard-fail">Hard fail</option>
                      </select>
                    </label>
                  ) : null}
                  {selectedWorkflowEdge.rule?.kind === 'answer' ? (
                    <label>
                      <span>Answer value</span>
                      <input value={selectedWorkflowEdge.rule.answerValue ?? ''} onChange={(event) => updateSelectedWorkflowEdge((edge) => ({
                        ...edge,
                        rule: { kind: 'answer', answerValue: event.target.value },
                      }))} />
                    </label>
                  ) : null}
                </div>
              ) : (
                <p>Select a route chip in the graph or route list.</p>
              )}
            </section>
          </aside>
        )
      }

      return (
        <aside className="admin-v2-builder-inspector">
          <section className="admin-v2-builder-panel-card">
            <div className="admin-v2-builder-panel-title-row">
              <h3>Connect</h3>
              <span>{selectedQuizAutomations.length} flows</span>
            </div>
            <p>{selectedConnectAutomation ? `${selectedConnectAutomation.name} is active in the builder.` : 'Select or create a flow to configure handoffs.'}</p>
          </section>

          <section className="admin-v2-builder-panel-card">
            <div className="admin-v2-builder-panel-title-row">
              <h3>Flow settings</h3>
              <span>{selectedConnectAutomation?.status ?? 'draft'}</span>
            </div>
            {selectedConnectAutomation ? (
              <div className="admin-v2-builder-form-stack">
                <label>
                  <span>Name</span>
                  <input value={selectedConnectAutomation.name} onChange={(event) => handleUpdateSelectedConnectAutomation('name', event.target.value)} />
                </label>
                <label>
                  <span>Description</span>
                  <textarea value={selectedConnectAutomation.description} onChange={(event) => handleUpdateSelectedConnectAutomation('description', event.target.value)} />
                </label>
                <div className="admin-v2-builder-action-list">
                  <button type="button" className="admin-v2-builder-graph-action" onClick={handleToggleBuilderAutomationStatus}>{selectedConnectAutomation.status === 'live' ? 'Move to draft' : 'Publish flow'}</button>
                  <button type="button" className="admin-v2-builder-graph-action" onClick={handleDuplicateBuilderAutomation}>Duplicate flow</button>
                </div>
              </div>
            ) : (
              <p>No flow selected.</p>
            )}
          </section>

          <section className="admin-v2-builder-panel-card is-branching">
            <div className="admin-v2-builder-panel-title-row">
              <h3>Selected node</h3>
              <span>{selectedConnectNode?.type ?? 'none'}</span>
            </div>
            {selectedConnectNode ? (
              <div className="admin-v2-builder-form-stack">
                <label>
                  <span>Title</span>
                  <input value={selectedConnectNode.title} onChange={(event) => handleUpdateSelectedConnectNode('title', event.target.value)} />
                </label>
                <label>
                  <span>Body</span>
                  <textarea value={selectedConnectNode.body} onChange={(event) => handleUpdateSelectedConnectNode('body', event.target.value)} />
                </label>
                <span className="admin-v2-builder-panel-meta">Trigger: {selectedConnectAutomation ? getAutomationTriggerLabel(selectedConnectAutomation.trigger) : 'None'}</span>
                <div className="admin-v2-builder-action-list">
                  <button type="button" className="admin-v2-builder-graph-action" onClick={() => handleAddBuilderAutomationNode('condition')}>Add condition after</button>
                  <button type="button" className="admin-v2-builder-graph-action" onClick={() => handleAddBuilderAutomationNode('action')}>Add action after</button>
                  <button type="button" className="admin-v2-builder-graph-action is-danger" onClick={handleDeleteSelectedConnectNode} disabled={selectedConnectNode.type === 'trigger'}>Delete node</button>
                </div>
              </div>
            ) : (
              <p>Select a node in the flow canvas.</p>
            )}
          </section>

          <section className="admin-v2-builder-panel-card">
            <div className="admin-v2-builder-panel-title-row">
              <h3>Connection</h3>
              <span>{selectedConnectEdge?.label ?? 'none'}</span>
            </div>
            {selectedConnectEdge ? (
              <div className="admin-v2-builder-form-stack">
                <label>
                  <span>Label</span>
                  <input value={selectedConnectEdge.label ?? ''} onChange={(event) => updateSelectedConnectEdge((edge) => ({ ...edge, label: event.target.value }))} />
                </label>
              </div>
            ) : (
              <p>Select an edge label in the flow graph.</p>
            )}
          </section>
        </aside>
      )
    }

    return (
      <aside className="admin-v2-builder-inspector">
        <section className="admin-v2-builder-panel-card">
          <div className="admin-v2-builder-panel-title-row">
            <h3>Question</h3>
            <span>ⓘ</span>
          </div>
          <div className="admin-v2-builder-segmented-control">
            <button type="button" className="is-active">Text</button>
            <button type="button">Video</button>
          </div>
        </section>

        <section className="admin-v2-builder-panel-card">
          <h3>Answer</h3>
          <div className="admin-v2-builder-answer-anchor" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="admin-v2-builder-answer-trigger" onClick={() => setBuilderAnswerMenuOpen((current) => !current)}>
              <span className="admin-v2-builder-answer-label">
                <ComposerElementIcon color={selectedAnswerType.color} elementKey={selectedAnswerType.key} label={selectedAnswerType.label} />
                <span>{selectedAnswerType.label}</span>
              </span>
              <span>⌄</span>
            </button>

            {builderAnswerMenuOpen ? (
              <div className="admin-v2-builder-answer-menu">
                <label className="admin-v2-builder-answer-search">
                  <span>⌕</span>
                  <input placeholder="Search" />
                </label>
                <div className="admin-v2-builder-answer-list">
                  {BUILDER_ANSWER_OPTIONS.map((item) => (
                    <button key={item.key} type="button" className={`admin-v2-builder-answer-option ${builderAnswerTypeKey === item.key ? 'is-active' : ''}`} onClick={() => handleSelectBuilderAnswerType(item.key)}>
                      <span className="admin-v2-builder-answer-label">
                        <ComposerElementIcon color={item.color} elementKey={item.key} label={item.label} />
                        <span>{item.label}</span>
                      </span>
                      {builderAnswerTypeKey === item.key ? <span>✓</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {selection?.kind === 'lead' ? renderLeadInspectorFields() : renderQuestionInspectorFields()}

          {(selection?.kind === 'lead' ? renderLeadInspectorFields() : renderQuestionInspectorFields()) ? <div className="admin-v2-builder-divider" /> : null}

          {selection?.kind === 'lead' ? renderLeadInspectorToggles() : renderQuestionInspectorToggles()}

          <div className="admin-v2-builder-divider" />

          <div className="admin-v2-builder-toggle-row is-compact"><span>{getBuilderToggleLabel('mapToContacts')}</span><button type="button" className={`admin-v2-builder-toggle ${currentBuilderToggles.mapToContacts ? 'is-on' : ''}`} onClick={() => handleToggleBuilderSetting('mapToContacts')}><span /></button></div>

          <div className="admin-v2-builder-divider" />

          <div className="admin-v2-builder-add-media-row">
            <span>Image or video</span>
            <button type="button" className="admin-v2-builder-plus-button">＋</button>
          </div>
        </section>

        <section className="admin-v2-builder-panel-card is-branching">
          <div className="admin-v2-builder-toggle-row is-compact">
            <span>Branching</span>
            <button type="button" className="admin-v2-builder-plus-button">＋</button>
          </div>
        </section>
      </aside>
    )
  }

  function renderBuilderDesignPanel() {
    if (!builderDesignOpen) {
      return null
    }

    const visibleThemes = builderThemeConfig.themes

    if (builderDesignView === 'editor' && builderThemeDraft) {
      return (
        <div className="admin-v2-builder-design-panel">
          <div className="admin-v2-builder-design-head">
            <div className="admin-v2-builder-design-headline">
              <span>⋮</span>
              <span>Design</span>
              <span>›</span>
              <span>{builderThemeDraft.name}</span>
            </div>
            <button type="button" className="admin-v2-builder-design-close" onClick={closeBuilderDesign}><BuilderPanelIcon kind="close" /></button>
          </div>

          <div className="admin-v2-builder-design-tabs">
            {(['logo', 'font', 'buttons', 'background'] as BuilderThemeEditorTab[]).map((tab) => (
              <button key={tab} type="button" className={builderThemeEditorTab === tab ? 'is-active' : ''} onClick={() => setBuilderThemeEditorTab(tab)}>
                {tab === 'logo' ? <><span>Logo</span><span className="admin-v2-builder-design-tab-mark"><BuilderPanelIcon kind="logo" /></span></> : tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="admin-v2-builder-design-body">
            {builderThemeEditorTab === 'logo' ? (
              <>
                {builderThemeDraft.logoImage ? (
                  <div className="admin-v2-builder-theme-logo-card">
                    <img src={builderThemeDraft.logoImage} alt={builderThemeDraft.logoAlt || builderThemeDraft.name} />
                    <div className="admin-v2-builder-theme-logo-actions">
                      <button type="button" onClick={() => builderLogoInputRef.current?.click()}><BuilderPanelIcon kind="image" /></button>
                      <button type="button" onClick={() => updateBuilderThemeDraft((theme) => ({ ...theme, logoImage: '' }))}><BuilderPanelIcon kind="trash" /></button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="admin-v2-builder-theme-add-button" onClick={() => builderLogoInputRef.current?.click()}>
                    <span>＋</span>
                    <span>Add logo</span>
                  </button>
                )}

                <div className="admin-v2-builder-design-fieldset">
                  <span>Size</span>
                  <label className="admin-v2-builder-design-range">
                    <div>
                      <input
                        type="range"
                        min={BUILDER_LOGO_SIZE_MIN}
                        max={BUILDER_LOGO_SIZE_MAX}
                        step={4}
                        value={builderThemeDraft.logoSize}
                        onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, logoSize: Number(event.target.value) }))}
                      />
                      <small>{builderThemeDraft.logoSize}px</small>
                    </div>
                  </label>
                </div>

                <div className="admin-v2-builder-design-fieldset">
                  <span>Alignment</span>
                  <div className="admin-v2-builder-choice-row">
                    {(['left', 'center', 'right'] as BuilderThemeAlign[]).map((align) => (
                      <button
                        key={align}
                        type="button"
                        className={builderThemeDraft.logoAlign === align ? 'is-active' : ''}
                        onClick={() => updateBuilderThemeDraft((theme) => ({ ...theme, logoAlign: align }))}
                      >
                        {BUILDER_ALIGN_LABEL[align]}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="admin-v2-builder-design-textarea">
                  <span>Logo alt text</span>
                  <textarea value={builderThemeDraft.logoAlt} maxLength={125} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, logoAlt: event.target.value }))} />
                  <small>{builderThemeDraft.logoAlt.length}/125</small>
                </label>
              </>
            ) : null}

            {builderThemeEditorTab === 'font' ? (
              <>
                <label className="admin-v2-builder-design-field">
                  <span>Font</span>
                  <select value={builderThemeDraft.fontFamily} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, fontFamily: event.target.value }))}>
                    {BUILDER_THEME_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="admin-v2-builder-design-field">
                  <span>Titles and questions</span>
                  <select value={builderThemeDraft.textColor} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, textColor: event.target.value }))}>
                    {BUILDER_THEME_COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <div className="admin-v2-builder-design-fieldset">
                  <span>Welcome screen and endings</span>
                  <div className="admin-v2-builder-theme-size-grid">
                    <div className="admin-v2-builder-choice-row">
                      {(['sm', 'md', 'lg'] as BuilderThemeFontSize[]).map((size) => (
                        <button key={size} type="button" className={builderThemeDraft.titleSize === size ? 'is-active' : ''} onClick={() => updateBuilderThemeDraft((theme) => ({ ...theme, titleSize: size }))}>{size[0].toUpperCase() + size.slice(1)}</button>
                      ))}
                    </div>
                    <div className="admin-v2-builder-choice-row is-icon-row">
                      {(['left', 'center', 'right'] as BuilderThemeAlign[]).map((align) => (
                        <button key={align} type="button" className={builderThemeDraft.titleAlign === align ? 'is-active' : ''} onClick={() => updateBuilderThemeDraft((theme) => ({ ...theme, titleAlign: align }))}>{align === 'left' ? '☰' : align === 'center' ? '≡' : '☷'}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="admin-v2-builder-design-fieldset">
                  <span>Questions</span>
                  <div className="admin-v2-builder-theme-size-grid">
                    <div className="admin-v2-builder-choice-row">
                      {(['sm', 'md', 'lg'] as BuilderThemeFontSize[]).map((size) => (
                        <button key={size} type="button" className={builderThemeDraft.questionSize === size ? 'is-active' : ''} onClick={() => updateBuilderThemeDraft((theme) => ({ ...theme, questionSize: size }))}>{size[0].toUpperCase() + size.slice(1)}</button>
                      ))}
                    </div>
                    <div className="admin-v2-builder-choice-row is-icon-row">
                      {(['left', 'center', 'right'] as BuilderThemeAlign[]).map((align) => (
                        <button key={align} type="button" className={builderThemeDraft.questionAlign === align ? 'is-active' : ''} onClick={() => updateBuilderThemeDraft((theme) => ({ ...theme, questionAlign: align }))}>{align === 'left' ? '☰' : align === 'center' ? '≡' : '☷'}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="admin-v2-builder-design-fieldset">
                  <span>Content position</span>
                  <label className="admin-v2-builder-design-range">
                    <div>
                      <input
                        type="range"
                        min={-160}
                        max={160}
                        step={4}
                        value={builderThemeDraft.contentOffsetX}
                        onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, contentOffsetX: Number(event.target.value) }))}
                      />
                      <small>{builderThemeDraft.contentOffsetX}px</small>
                    </div>
                  </label>
                </div>
              </>
            ) : null}

            {builderThemeEditorTab === 'buttons' ? (
              <>
                <label className="admin-v2-builder-design-field"><span>Buttons</span><select value={builderThemeDraft.buttonColor} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, buttonColor: event.target.value }))}>{BUILDER_THEME_COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="admin-v2-builder-design-field"><span>Button text</span><select value={builderThemeDraft.buttonTextColor} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, buttonTextColor: event.target.value }))}>{BUILDER_THEME_COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="admin-v2-builder-design-field"><span>Answers</span><select value={builderThemeDraft.answerColor} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, answerColor: event.target.value }))}><option value="rgba(255,255,255,0.14)">Soft white</option><option value="rgba(243,196,65,0.18)">Gold tint</option><option value="rgba(126,167,216,0.2)">Blue tint</option><option value="rgba(17,27,35,0.55)">Deep navy</option></select></label>
                <div className="admin-v2-builder-design-fieldset">
                  <span>Corner radius</span>
                  <label className="admin-v2-builder-design-range">
                    <div>
                      <input
                        type="range"
                        min={0}
                        max={BUILDER_CORNER_RADIUS_OPTIONS.length - 1}
                        step={1}
                        value={BUILDER_CORNER_RADIUS_INDEX[builderThemeDraft.cornerRadius]}
                        onChange={(event) => updateBuilderThemeDraft((theme) => ({
                          ...theme,
                          cornerRadius: BUILDER_CORNER_RADIUS_OPTIONS[Number(event.target.value)] ?? 'soft',
                        }))}
                      />
                      <small>{BUILDER_CORNER_RADIUS_LABEL[builderThemeDraft.cornerRadius]}</small>
                    </div>
                  </label>
                </div>
              </>
            ) : null}

            {builderThemeEditorTab === 'background' ? (
              <>
                <label className="admin-v2-builder-design-field"><span>Background</span><select value={builderThemeDraft.backgroundColor} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, backgroundColor: event.target.value }))}>{BUILDER_THEME_COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <div className="admin-v2-builder-design-fieldset">
                  <span>Background image</span>
                  {builderThemeDraft.backgroundImage ? (
                    <div className="admin-v2-builder-background-card">
                      <img src={builderThemeDraft.backgroundImageThumb || builderThemeDraft.backgroundImage} alt="Theme background" />
                      <div className="admin-v2-builder-background-actions">
                        <button type="button" onClick={() => builderBackgroundInputRef.current?.click()}><BuilderPanelIcon kind="image" /></button>
                        <button type="button" onClick={() => updateBuilderThemeDraft((theme) => ({ ...theme, backgroundImage: '', backgroundImageThumb: undefined }))}><BuilderPanelIcon kind="trash" /></button>
                      </div>
                      <label className="admin-v2-builder-design-range">
                        <span>Brightness</span>
                        <div>
                          <input type="range" min={-40} max={20} value={builderThemeDraft.backgroundBrightness} onChange={(event) => updateBuilderThemeDraft((theme) => ({ ...theme, backgroundBrightness: Number(event.target.value) }))} />
                          <small>{builderThemeDraft.backgroundBrightness}</small>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <button type="button" className="admin-v2-builder-theme-add-button" onClick={() => builderBackgroundInputRef.current?.click()}>
                      <span>＋</span>
                      <span>Add image</span>
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="admin-v2-builder-design-footer">
            <div className="admin-v2-builder-design-footer-status">
              {isBuilderThemeDirty ? <button type="button" className="admin-v2-builder-design-link" onClick={revertBuilderTheme}>Revert</button> : null}
              {builderThemeSaveState !== 'idle' ? <span className={`admin-v2-builder-design-status is-${builderThemeSaveState}`}>{builderThemeSaveState === 'saving' ? 'Saving theme...' : 'Theme saved'}</span> : null}
            </div>
            <Button tone="primary" onClick={() => void saveBuilderTheme()} disabled={!isBuilderThemeDirty || builderThemeSaveState === 'saving'}>{builderThemeSaveState === 'saving' ? 'Saving...' : builderThemeSaveState === 'saved' && !isBuilderThemeDirty ? 'Saved' : 'Save changes'}</Button>
          </div>
        </div>
      )
    }

    return (
      <div className="admin-v2-builder-design-panel admin-v2-builder-design-panel--library">
        <div className="admin-v2-builder-design-head">
          <div className="admin-v2-builder-design-headline">
            <span>⋮</span>
            <span>Design</span>
          </div>
          <button type="button" className="admin-v2-builder-design-close" onClick={closeBuilderDesign}><BuilderPanelIcon kind="close" /></button>
        </div>

        <div className="admin-v2-builder-design-body">
          <div className="admin-v2-builder-design-inline-row">
            <span>My themes</span>
            <button type="button" className="admin-v2-builder-theme-mini-button" onClick={handleCreateBuilderTheme}>＋</button>
          </div>

          <div className="admin-v2-builder-theme-grid">
            {visibleThemes.map((theme) => (
              <article
                key={theme.id}
                className={`admin-v2-builder-theme-card ${builderThemeConfig.activeThemeId === theme.id ? 'is-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  updateSelectedQuizActiveTheme(theme.id)
                  openBuilderThemeEditor(theme)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    updateSelectedQuizActiveTheme(theme.id)
                    openBuilderThemeEditor(theme)
                  }
                }}
              >
                <span className="admin-v2-builder-theme-preview" style={{ background: theme.preview, backgroundImage: theme.backgroundImage ? `url(${theme.backgroundImage})` : undefined }}>
                  <strong>Question</strong>
                  <small>Answer</small>
                  <i />
                </span>
                <span className="admin-v2-builder-theme-name-row">
                  <span>{theme.name}</span>
                  <span className="admin-v2-builder-theme-action-anchor" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="admin-v2-builder-theme-action-button" aria-label={`Open actions for ${theme.name}`} onClick={() => setBuilderThemeMenuId((current) => current === theme.id ? null : theme.id)}>⋯</button>
                    {builderThemeMenuId === theme.id ? (
                      <div className="admin-v2-popover-menu admin-v2-popover-menu--theme-actions">
                        <button type="button" onClick={() => void handleRenameBuilderTheme(theme)}>Rename</button>
                        <button type="button" onClick={() => {
                          updateSelectedQuizActiveTheme(theme.id)
                          openBuilderThemeEditor(theme)
                        }}>Edit</button>
                        <button type="button" onClick={() => void handleDuplicateBuilderTheme(theme)}>Duplicate</button>
                        <button type="button" className="is-danger" onClick={() => void handleDeleteBuilderTheme(theme)}>Delete</button>
                      </div>
                    ) : null}
                  </span>
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderBuilderThemeConfirmModal() {
    if (!builderThemeCloseConfirmOpen) {
      return null
    }

    return (
      <div className="admin-v2-builder-theme-confirm-backdrop" onClick={() => setBuilderThemeCloseConfirmOpen(false)}>
        <div className="admin-v2-builder-theme-confirm" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="admin-v2-builder-design-close" onClick={() => setBuilderThemeCloseConfirmOpen(false)}><BuilderPanelIcon kind="close" /></button>
          <h3>Save changes to theme?</h3>
          <p>You made changes to the {builderThemeDraft?.name ?? 'current'} theme, but you haven&apos;t saved them.</p>
          <div className="admin-v2-builder-theme-confirm-actions">
            <Button tone="secondary" onClick={discardBuilderThemeChanges}>Discard changes</Button>
            <Button tone="primary" onClick={() => void confirmBuilderThemeSaveAndClose()}>Save theme</Button>
          </div>
        </div>
      </div>
    )
  }

  function renderBuilder() {
    if (!selectedProject || !selectedQuiz) {
      return null
    }

    const isComposer = builderTab === 'content' && isBlankComposerQuiz(selectedQuiz) && newFormCanvasMode === 'ai'

    if (isComposer) {
      return (
        <div className="admin-v2-builder-page admin-v2-builder-page--composer">
          <header className="admin-v2-builder-topbar is-composer">
            <div className="admin-v2-builder-breadcrumbs">
              <button type="button" onClick={() => setOpenedQuizId(null)}>Forms</button>
              <span>›</span>
              <span>{selectedQuiz.name}</span>
            </div>
            <div className="admin-v2-builder-actions">
              <button type="button" className="admin-v2-icon-button">?</button>
            </div>
          </header>

          <div className="admin-v2-new-form-stage">
            <div className="admin-v2-new-form-center">
              <div className="admin-v2-new-form-kicker">Typeform AI</div>
              <h2>What would you like to create?</h2>
              <form
                className="admin-v2-ai-composer-card"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSubmitAiPrompt()
                }}
              >
                <textarea
                  value={newFormAiPrompt}
                  placeholder="Explain the goal of your form"
                  onChange={(event) => setNewFormAiPrompt(event.target.value)}
                />
                <div className="admin-v2-ai-composer-footer">
                  <div className="admin-v2-ai-composer-tools">
                    <button type="button" className="admin-v2-ai-tool-button">◔</button>
                    <button type="button" className="admin-v2-ai-tool-button">＋</button>
                    <button type="button" className="admin-v2-ai-tool-button">⋯</button>
                  </div>
                  <button type="submit" className="admin-v2-ai-send-button" disabled={!newFormAiPrompt.trim()}>▻</button>
                </div>
              </form>
              <div className="admin-v2-new-form-divider" />
              <div className="admin-v2-new-form-actions-row">
                <Button tone="secondary" onClick={() => void handleStartFromScratch()}>Start from scratch</Button>
                <button type="button" className="admin-v2-crm-button">
                  <span>Sync to CRM</span>
                  <span className="admin-v2-crm-icons">
                    {CRM_SYNC_APPS.map((app) => (
                      <span key={app.key} className={`admin-v2-crm-pill is-${app.color}`}>
                        <CrmIcon provider={app.key} />
                      </span>
                    ))}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {newFormLibraryOpen ? renderAddContentModal() : null}
        </div>
      )
    }

    if (!selection) {
      return null
    }

    const pageItems: BuilderPageItem[] = [
      ...(hasVisibleIntroScreen(selectedQuiz.variants[0]) ? [{
        key: `intro-${selectedQuiz.variants[0].id}`,
        label: getPageChipLabel(selectedQuiz.variants[0].intro.heading, 'welcome-screen'),
        onClick: () => setSelection({ kind: 'intro', variantId: selectedQuiz.variants[0].id }),
        active: selection.kind === 'intro' && selection.variantId === selectedQuiz.variants[0].id,
        kind: 'intro' as const,
        elementKey: 'welcome-screen',
        elementColor: getElementMeta('welcome-screen').color,
        variantId: selectedQuiz.variants[0].id,
      }] : []),
      ...selectedQuiz.variants.flatMap((variant) => variant.questions.map((question) => {
        const elementKey = getQuestionElementKey(question)
        const elementMeta = getElementMeta(elementKey)
        return {
          key: question.id,
          label: getPageChipLabel(question.prompt, elementKey),
          onClick: () => setSelection({ kind: 'question', variantId: variant.id, questionId: question.id }),
          active: selection.kind === 'question' && selection.questionId === question.id,
          kind: 'question' as const,
          elementKey,
          elementColor: elementMeta.color,
          variantId: variant.id,
          questionId: question.id,
        }
      })),
      ...selectedQuiz.leadSteps.map((step) => {
        const elementKey = getLeadElementKey(step)
        const elementMeta = getElementMeta(elementKey)
        return {
          key: step.id,
          label: getPageChipLabel(step.label, elementKey),
          onClick: () => setSelection({ kind: 'lead', stepId: step.id }),
          active: selection.kind === 'lead' && selection.stepId === step.id,
          kind: 'lead' as const,
          elementKey,
          elementColor: elementMeta.color,
          stepId: step.id,
        }
      }),
    ]

    const activeMode = BUILDER_MODE_OPTIONS.find((option) => option.key === builderMode) ?? BUILDER_MODE_OPTIONS[0]

    return (
      <div className="admin-v2-builder-page admin-v2-builder-page--full">
        <header className="admin-v2-builder-globalbar">
          <div className="admin-v2-builder-breadcrumbs">
            <button type="button" onClick={() => setOpenedQuizId(null)}>Forms</button>
            <span>›</span>
            <span>{selectedQuiz.name}</span>
          </div>
          <nav className="admin-v2-builder-tabs">
            {(['content', 'workflow', 'connect'] as BuilderTab[]).map((tab) => (
              <button key={tab} type="button" className={builderTab === tab ? 'is-active' : ''} onClick={() => setBuilderTab(tab)}>
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
          <div className="admin-v2-builder-actions is-light">
            <button type="button" className="admin-v2-builder-share-button">Share</button>
            <button type="button" className="admin-v2-builder-avatar">JL</button>
          </div>
        </header>

        <div className="admin-v2-builder-layout">
          <aside className="admin-v2-builder-rail">
            <div className="admin-v2-builder-mode-anchor" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="admin-v2-builder-mode-button" onClick={() => setBuilderModeMenuOpen((current) => !current)}>
                <span>☰</span>
                <span>{activeMode.label}</span>
                <span>⌄</span>
              </button>
              {builderModeMenuOpen ? (
                <div className="admin-v2-builder-mode-menu">
                  {BUILDER_MODE_OPTIONS.map((option) => (
                    <button key={option.key} type="button" className={`admin-v2-builder-mode-option ${builderMode === option.key ? 'is-active' : ''}`} onClick={() => { setBuilderMode(option.key); setBuilderModeMenuOpen(false) }}>
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div ref={builderRailSplitRef} className={`admin-v2-builder-rail-split ${builderRailResizeActive ? 'is-resizing' : ''}`}>
              <section className="admin-v2-builder-rail-card admin-v2-builder-rail-card--pages" style={{ flex: `${builderRailSplit} 1 0` }}>
                <div className="admin-v2-builder-rail-header">Pages</div>
                <div className="admin-v2-builder-page-list">
                  {pageItems.slice(0, 4).map((item, index) => (
                    <div key={item.key} className={`admin-v2-builder-page-chip ${item.active ? 'is-active' : ''}`}>
                      <button type="button" className="admin-v2-builder-page-chip-main" onClick={item.onClick}>
                        <span className="admin-v2-builder-page-chip-icon"><ComposerElementIcon color={item.elementColor} elementKey={item.elementKey} label={item.label} /></span>
                        <span>{item.label.slice(0, 18) || '...'}</span>
                      </button>
                      <div className="admin-v2-builder-page-menu-anchor" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="admin-v2-builder-page-chip-actions" onClick={() => setBuilderPageMenuOpen((current) => current === item.key ? null : item.key)}>⋮</button>
                        {builderPageMenuOpen === item.key ? (
                          <div className="admin-v2-builder-page-menu">
                            <button type="button" onClick={() => void handleDuplicateCurrentPage(item)}>Duplicate</button>
                            <button
                              type="button"
                              className="is-danger"
                              disabled={pageItems.length <= 1}
                              onClick={() => void handleDeleteCurrentPage(item, pageItems.length)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <button type="button" className="admin-v2-builder-add-page" onClick={() => void handleAddPage()}>＋ Add to page</button>
                </div>
              </section>

              <button
                type="button"
                className="admin-v2-builder-rail-divider"
                aria-label="Resize page and ending panels"
                onPointerDown={(event) => {
                  event.preventDefault()
                  setBuilderRailResizeActive(true)
                }}
              >
                <span className="admin-v2-builder-rail-divider-line" />
              </button>

              <section className="admin-v2-builder-rail-card is-endings" style={{ flex: `${1 - builderRailSplit} 1 0` }}>
                <div className="admin-v2-builder-rail-header">
                  <span>Endings</span>
                  <div className="admin-v2-builder-endings-anchor" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="admin-v2-builder-plus-button" onClick={() => setBuilderEndingsMenuOpen((current) => !current)}>＋</button>
                    {builderEndingsMenuOpen ? (
                      <div className="admin-v2-builder-endings-menu">
                        <div className="admin-v2-builder-endings-title">Choose an ending type</div>
                        <button type="button" onClick={() => handleAddEnding('end-screen')}>End Screen</button>
                        <button type="button" onClick={() => handleAddEnding('redirect')}>Redirect to URL</button>
                        <div className="admin-v2-builder-endings-subtitle">Post-submit actions</div>
                        <button type="button">Connect to apps</button>
                        <button type="button">Send message</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </aside>

          <main className="admin-v2-builder-stage">
            <div className="admin-v2-builder-toolbar admin-v2-builder-toolbar--light">
              <Button tone="primary" onClick={() => setNewFormLibraryOpen(true)}>+ Add content</Button>
              <button type="button" className={`admin-v2-builder-design-trigger ${builderDesignOpen ? 'is-active' : ''}`} onClick={() => builderDesignOpen ? closeBuilderDesign() : openBuilderDesignLibrary()}>
                <BuilderDesignIcon />
                <span>Design</span>
              </button>
              <div className="admin-v2-builder-toolbar-icons">
                <button type="button" className={`admin-v2-builder-toolbar-icon ${builderDevice === 'desktop' ? 'is-active' : ''}`} title="Desktop view" onClick={() => setBuilderDevice('desktop')}><BuilderPanelIcon kind="desktop" /></button>
                <button type="button" className={`admin-v2-builder-toolbar-icon ${builderDevice === 'mobile' ? 'is-active' : ''}`} title="Mobile view" onClick={() => setBuilderDevice('mobile')}><BuilderPanelIcon kind="mobile" /></button>
                {BUILDER_TOOL_OPTIONS.map((tool) => (
                  <button key={tool.key} type="button" className={`admin-v2-builder-toolbar-icon ${builderToolPanel === tool.key ? 'is-active' : ''}`} title={tool.title} onClick={() => toggleBuilderToolPanel(tool.key)}><BuilderPanelIcon kind={tool.icon} /></button>
                ))}
              </div>
            </div>

            {renderBuilderDesignPanel()}
            {renderBuilderToolPanel()}

            {builderTab === 'content' ? (
              <div className={`admin-v2-builder-canvas admin-v2-builder-canvas--light ${builderDevice === 'mobile' ? 'is-mobile' : 'is-desktop'}`}>
                {renderPreviewCanvas()}
              </div>
            ) : null}

            {builderTab === 'workflow' ? (
              renderWorkflowCanvas()
            ) : null}

            {builderTab === 'connect' ? (
              renderConnectCanvas()
            ) : null}
          </main>

          {renderBuilderInspector()}

          <input ref={builderLogoInputRef} type="file" accept="image/*" className="admin-v2-hidden-file-input" onChange={(event) => void handleBuilderThemeFileChange(event, 'logo')} />
          <input ref={builderBackgroundInputRef} type="file" accept="image/*" className="admin-v2-hidden-file-input" onChange={(event) => void handleBuilderThemeFileChange(event, 'background')} />
        </div>

        {renderBuilderThemeConfirmModal()}
      </div>
    )
  }

  function renderAddContentModal() {
    return (
      <div className="admin-v2-composer-backdrop" onClick={() => setNewFormLibraryOpen(false)}>
        <div className="admin-v2-composer-modal admin-v2-composer-modal--library" onClick={(event) => event.stopPropagation()}>
          <div className="admin-v2-composer-modal-tabs">
            <button type="button" className={newFormComposerTab === 'elements' ? 'is-active' : ''} onClick={() => setNewFormComposerTab('elements')}>Add form elements</button>
            <button type="button" className={newFormComposerTab === 'ai' ? 'is-active' : ''} onClick={() => setNewFormComposerTab('ai')}>Create with AI</button>
          </div>
          <button type="button" className="admin-v2-composer-close" onClick={() => setNewFormLibraryOpen(false)}>×</button>

          {newFormComposerTab === 'elements' ? (
            <div className="admin-v2-composer-modal-body admin-v2-composer-modal-body--library">
              <aside className="admin-v2-composer-rail">
                <label className="admin-v2-composer-search">
                  <span>⌕</span>
                  <input value={newFormLibraryQuery} placeholder="Search form elements" onChange={(event) => setNewFormLibraryQuery(event.target.value)} />
                </label>

                <div className="admin-v2-composer-rail-section">
                  <span className="admin-v2-composer-rail-title">Recommended</span>
                  {recommendedNewFormElements.map((item) => (
                    <button key={item.key} type="button" className="admin-v2-composer-rail-item" onClick={() => void handleInsertComposerElement(item.key)}>
                      <ComposerElementIcon color={item.color} elementKey={item.key} label={item.label} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="admin-v2-composer-rail-section">
                  <span className="admin-v2-composer-rail-title">Connect to apps</span>
                  {CRM_SYNC_APPS.map((app) => (
                    <button key={app.key} type="button" className="admin-v2-composer-app-button">
                      <span className={`admin-v2-crm-pill is-${app.color}`}>
                        <CrmIcon provider={app.key} />
                      </span>
                      <span>{app.label}</span>
                    </button>
                  ))}
                  <button type="button" className="admin-v2-composer-app-button is-ghost">
                    <span className="admin-v2-composer-app-grid">⊞</span>
                    <span>Browse all apps</span>
                  </button>
                </div>
              </aside>

              <div className="admin-v2-composer-element-grid admin-v2-composer-element-grid--library">
                {(newFormLibraryQuery.trim() ? filteredNewFormSections : addContentLibrarySections).map((section, index) => (
                  <section key={`${section.title || 'special'}-${index}`} className={`admin-v2-composer-element-section ${section.title ? '' : 'is-special'}`}>
                    <h3>{section.title}</h3>
                    <div className="admin-v2-composer-element-list">
                      {section.items.map((item) => (
                        <button key={item.key} type="button" className="admin-v2-composer-element-button" onClick={() => void handleInsertComposerElement(item.key)}>
                          <ComposerElementIcon color={item.color} elementKey={item.key} label={item.label} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {newFormComposerTab === 'ai' ? (
            <div className="admin-v2-composer-ai-panel">
              <div className="admin-v2-new-form-kicker">Typeform AI</div>
              <h3>Describe the form you want to build</h3>
              <p>Start with a short brief, then refine it inside the builder once the first draft is in place.</p>
              <form
                className="admin-v2-composer-ai-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleSubmitAiPrompt()
                }}
              >
                <textarea value={newFormAiPrompt} placeholder="Explain the goal of your form" onChange={(event) => setNewFormAiPrompt(event.target.value)} />
                <div className="admin-v2-composer-ai-actions">
                  <Button tone="secondary" onClick={() => void handleStartFromScratch()}>Start from scratch</Button>
                  <Button tone="primary" disabled={!newFormAiPrompt.trim()}>Create draft</Button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  function renderContacts() {
    const totalContacts = selectedMetrics?.leadCount ?? 0

    return (
      <div className="admin-v2-page admin-v2-contacts-page">
        <main className="admin-v2-empty-page">
          <header className="admin-v2-page-header">
            <div><h1>All contacts</h1></div>
            <div className="admin-v2-page-actions">
              <button type="button" className="admin-v2-ghost-button">Filter</button>
            </div>
          </header>

          <div className="admin-v2-empty-state admin-v2-contacts-empty-state">
            <div>
              <h2>Add contacts to your funnel</h2>
              <p>Create contacts and streamline your forms, emails, and follow-up in one place.</p>
              <div className="admin-v2-empty-actions">
                <Button tone="primary" onClick={() => setContactAddMenuOpen((current) => !current)}>Add contact</Button>
                <Button tone="secondary" onClick={openContactImportModal}>Import CSV</Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  function renderAutomations() {
    const categoryAutomations = selectedAutomations.filter((automation) => {
      if (automationCategory === 'contact-updates') {
        return automation.trigger !== 'lead_submitted'
      }

      if (automationCategory === 'form-submissions') {
        return automation.trigger === 'lead_submitted'
      }

      return false
    })

    const automationWorkspace = projects.find((project) => project.id === automationWorkspaceId) ?? null
    const automationForms = automationWorkspace?.quizzes ?? []
    const automationQuiz = automationForms.find((quiz) => quiz.id === automationQuizId) ?? null

    if (automationComposerStep === 'editor' && automationEditor) {
      return (
        <div className="admin-v2-page admin-v2-automation-editor-page">
          <header className="admin-v2-automation-editor-topbar">
            <div className="admin-v2-builder-breadcrumbs">
              <span>Automations</span>
              <span>›</span>
              <span>{automationEditor.name}</span>
            </div>
            <div className="admin-v2-page-actions">
              <button type="button" className="admin-v2-ghost-button">Edit form</button>
              <Button tone="primary">Publish</Button>
            </div>
          </header>

          <div className="admin-v2-automation-editor-layout">
            <aside className="admin-v2-automation-flow-rail">
              <div className="admin-v2-automation-rail-head">
                <span>Add new trigger</span>
                <button type="button" className="admin-v2-square-button">+</button>
              </div>
              {automationEditor.nodes.map((node) => (
                <div key={node.id} className={`admin-v2-automation-rail-item is-${node.type}`}>
                  <div>
                    <strong>{node.title}</strong>
                    <span>{node.type === 'trigger' ? 'Active' : node.type === 'action' ? 'Missing action' : 'Condition'}</span>
                  </div>
                  <button type="button" className="admin-v2-icon-button">⋮</button>
                </div>
              ))}
            </aside>

            <main className="admin-v2-automation-canvas">
              <div className="admin-v2-automation-node-card is-trigger">
                <span className="admin-v2-automation-node-label">Trigger</span>
                <strong>Trigger set</strong>
                <span>Any response</span>
              </div>
              <button type="button" className="admin-v2-automation-add-action">Add action</button>
            </main>

            <aside className="admin-v2-automation-actions-panel">
              <div className="admin-v2-side-title">Action</div>
              <h2>What action would you like to trigger?</h2>
              <div className="admin-v2-automation-action-list">
                {AUTOMATION_ACTION_OPTIONS.map((option) => (
                  <button key={option.title} type="button" className="admin-v2-automation-action-card">
                    <strong>{option.title}</strong>
                    <span>{option.body}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )
    }

    return (
      <div className="admin-v2-page admin-v2-automations-page">
        <main className="admin-v2-empty-page">
          {automationComposerStep === 'trigger-picker' ? (
            <div className="admin-v2-automation-create">
              <div className="admin-v2-builder-breadcrumbs"><span>Automations</span><span>›</span><span>New automation</span></div>
              <div className="admin-v2-trigger-grid">
                <h2>What will trigger this automation?</h2>
                <div className="admin-v2-trigger-options">
                  <button type="button" className="admin-v2-trigger-card is-active" onClick={openFormSubmissionModal}><strong>Form submission</strong><span>Activate automations when someone completes a form.</span></button>
                  <button type="button" className="admin-v2-trigger-card"><strong>Contact activity or updates</strong><span>Activate automations based on contact properties or updates.</span></button>
                </div>
                <button type="button" className="admin-v2-coming-soon">Scheduled date or event</button>
              </div>
            </div>
          ) : automationCategory === 'form-submissions' ? (
            <div className="admin-v2-automation-list-screen">
              <header className="admin-v2-page-header">
                <div><h1>Always on: Form submissions</h1></div>
                <div className="admin-v2-page-actions">
                  <button type="button" className="admin-v2-ghost-button">Date created</button>
                </div>
              </header>

              <div className="admin-v2-automation-filter-row">
                <button type="button" className="admin-v2-ghost-button is-active">{selectedProject?.name ?? 'Select workspace'}</button>
                <button type="button" className="admin-v2-ghost-button">Status</button>
              </div>

              {categoryAutomations.length ? (
                <div className="admin-v2-automation-list-cards">
                  {categoryAutomations.map((automation) => (
                    <button key={automation.id} type="button" className="admin-v2-automation-list-card" onClick={() => { setAutomationEditor(automation); setAutomationComposerStep('editor') }}>
                      <strong>{automation.name}</strong>
                      <span>{automation.description}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="admin-v2-automation-empty-inline">
                  <h2>There’s not an automation in sight</h2>
                  <Button tone="primary" onClick={openAutomationTriggerPicker}>+ Create automation</Button>
                  <button type="button" className="admin-v2-inline-link">Learn about automations</button>
                </div>
              )}
            </div>
          ) : (
            <div className="admin-v2-empty-state admin-v2-automations-overview">
              <div>
                <h2>Automate customer journeys</h2>
                <p>Trigger messages, notifications, and more based on contact updates, form submissions, or scheduled dates.</p>
                <div className="admin-v2-empty-actions">
                  <Button tone="primary" onClick={openAutomationTriggerPicker}>Create automation</Button>
                  <Button tone="secondary">View sample automations</Button>
                </div>
              </div>
            </div>
          )}
        </main>

        {automationComposerStep === 'form-submission' ? (
          <div className="admin-v2-modal-backdrop" onClick={closeAutomationComposer}>
            <div className="admin-v2-modal admin-v2-automation-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-v2-modal-head">
                <div>
                  <h3>Form submissions</h3>
                  <p>First choose a workspace, then pick the form you'd like to add automations to.</p>
                </div>
                <button type="button" className="admin-v2-modal-close" onClick={closeAutomationComposer}>×</button>
              </div>

              <div className="admin-v2-select-stack">
                <label className="admin-v2-modal-field">
                  <span>Workspace</span>
                  <button type="button" className="admin-v2-select-button" onClick={() => setAutomationWorkspaceSelectOpen((current) => !current)}>
                    <span>{automationWorkspace?.name || 'Select a workspace'}</span>
                    <span>⌄</span>
                  </button>
                  {automationWorkspaceSelectOpen ? (
                    <div className="admin-v2-select-panel">
                      <div className="admin-v2-select-search">Search workspaces</div>
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          className={`admin-v2-select-option ${automationWorkspaceId === project.id ? 'is-active' : ''}`}
                          onClick={() => {
                            setAutomationWorkspaceId(project.id)
                            setAutomationQuizId('')
                            setAutomationWorkspaceSelectOpen(false)
                          }}
                        >
                          {project.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>

                <label className="admin-v2-modal-field">
                  <span>Form</span>
                  <button type="button" className="admin-v2-select-button" onClick={() => setAutomationFormSelectOpen((current) => !current)}>
                    <span>{automationQuiz?.name || 'Select a form'}</span>
                    <span>⌄</span>
                  </button>
                  {automationFormSelectOpen ? (
                    <div className="admin-v2-select-panel">
                      <div className="admin-v2-select-search">Search forms</div>
                      {automationForms.length ? (
                        automationForms.map((quiz) => (
                          <button
                            key={quiz.id}
                            type="button"
                            className={`admin-v2-select-option ${automationQuizId === quiz.id ? 'is-active' : ''}`}
                            onClick={() => {
                              setAutomationQuizId(quiz.id)
                              setAutomationFormSelectOpen(false)
                            }}
                          >
                            {quiz.name}
                          </button>
                        ))
                      ) : (
                        <div className="admin-v2-select-empty">No forms found</div>
                      )}
                    </div>
                  ) : null}
                </label>
              </div>

              <div className="admin-v2-modal-actions">
                <button type="button" className="admin-v2-ghost-button" onClick={closeAutomationComposer}>Cancel</button>
                <Button tone="primary" disabled={!automationWorkspaceId || !automationQuizId} onClick={() => void handleCreateFormSubmissionAutomation()}>Continue</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (isBooting) {
    return <div className="admin-v2-loading">Checking session...</div>
  }

  if (!isUnlocked) {
    return renderLogin()
  }

  if (section === 'forms' && openedQuizId) {
    return (
      <div
        className="admin-v2-builder-shell"
        onClick={() => {
          setBuilderModeMenuOpen(false)
          setBuilderEndingsMenuOpen(false)
          setBuilderAnswerMenuOpen(false)
          setBuilderPageMenuOpen(null)
        }}
      >
        {renderBuilder()}

        {selectedQuiz && !isBlankComposerQuiz(selectedQuiz) && newFormLibraryOpen ? renderAddContentModal() : null}
      </div>
    )
  }

  return (
    <div className="admin-v2-shell" onClick={() => { setWorkspaceMenuOpen(false); setContactAddMenuOpen(false); setAutomationWorkspaceSelectOpen(false); setAutomationFormSelectOpen(false); setFormsSortMenuOpen(false); setFormActionMenuQuizId(null) }}>
      <header className="admin-v2-topbar">
        <div className="admin-v2-topbar-left">
          <div className="admin-v2-logo">N</div>
          <button type="button" className="admin-v2-workspace-toggle">Neptunys Form</button>
        </div>
        <div className="admin-v2-topbar-right">
          <button type="button" className="admin-v2-text-link">Integrations</button>
          <button type="button" className="admin-v2-avatar" onClick={() => void signOutAdmin().then(() => { setAdminSession(false); setIsUnlocked(false) })}>JL</button>
        </div>
      </header>

      <div className="admin-v2-frame">
        <aside className="admin-v2-sidebar">
          <nav className="admin-v2-primary-nav">
            <button type="button" className={section === 'forms' ? 'is-active' : ''} onClick={() => { setSection('forms'); setOpenedQuizId(null); closeContactSurfaces(); closeAutomationComposer() }}>Forms</button>
            <button type="button" className={section === 'contacts' ? 'is-active' : ''} onClick={() => { setSection('contacts'); setOpenedQuizId(null); setAutomationEditor(null); setAutomationComposerStep('idle') }}>Contacts</button>
            <button type="button" className={section === 'automations' ? 'is-active' : ''} onClick={() => { setSection('automations'); setOpenedQuizId(null); closeContactSurfaces() }}>Automations</button>
          </nav>

          {section === 'forms' ? (
            <>
              <Button tone="primary" onClick={() => void handleCreateForm()}>+ Create a new form</Button>

              <label className="admin-v2-search"><span>Search</span><input value={formsSearchQuery} placeholder="Search" onFocus={() => setFormsSearchOpen(true)} onChange={(event) => setFormsSearchQuery(event.target.value)} /></label>

              <div className="admin-v2-sidebar-group">
                <div className="admin-v2-sidebar-heading">
                  <span>Workspaces</span>
                  <button type="button" onClick={openWorkspaceModal}>+</button>
                </div>
                <div className="admin-v2-sidebar-label">Private</div>
                <div className="admin-v2-workspace-list">
                  {projects.map((project) => (
                    <button key={project.id} type="button" className={`admin-v2-workspace-item ${selectedProject?.id === project.id ? 'is-active' : ''}`} onClick={() => selectWorkspace(project.id)}>
                      <span className="admin-v2-workspace-name">{project.name}</span>
                      <span className="admin-v2-workspace-count">{project.quizzes.length}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-v2-sidebar-footer">
                <div className="admin-v2-sidebar-stats-grid">
                  <div>
                    <span>Live quiz</span>
                    <strong>{liveQuizCount}</strong>
                  </div>
                  <div>
                    <span>Quiz total</span>
                    <strong>{totalQuizCount}</strong>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {section === 'contacts' ? (
            <>
              <div className="admin-v2-sidebar-stack">
                <div className="admin-v2-floating-menu-anchor" onClick={(event) => event.stopPropagation()}>
                  <Button tone="secondary" className="admin-v2-sidebar-wide-button" onClick={() => setContactAddMenuOpen((current) => !current)}>Add contact</Button>
                  {contactAddMenuOpen ? (
                    <div className="admin-v2-sidebar-popover admin-v2-contact-add-menu">
                      <button type="button" className="admin-v2-popover-option" onClick={() => setContactAddMenuOpen(false)}>
                        <strong>Add through forms</strong>
                        <span>Create contacts through form responses.</span>
                      </button>
                      <button type="button" className="admin-v2-popover-option" onClick={openContactImportModal}>
                        <strong>Add in bulk</strong>
                        <span>Import your contacts through CSV.</span>
                      </button>
                      <button type="button" className="admin-v2-popover-option" onClick={() => setContactAddMenuOpen(false)}>
                        <strong>Add individually</strong>
                        <span>Add contacts one by one.</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="admin-v2-sidebar-group">
                  <div className="admin-v2-sidebar-label">Early access</div>
                  <div className="admin-v2-sidebar-heading">
                    <span>Contact lists</span>
                    <button type="button" onClick={openContactListModal}>+</button>
                  </div>
                  <div className="admin-v2-workspace-list">
                    <button type="button" className="admin-v2-workspace-item is-active">
                      <span className="admin-v2-workspace-name">All contacts</span>
                      <span className="admin-v2-workspace-count">{selectedMetrics?.leadCount ?? 0}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-v2-sidebar-footer">
                <button type="button" className="admin-v2-footer-link">Contact permissions</button>
              </div>
            </>
          ) : null}

          {section === 'automations' ? (
            <>
              <Button tone="primary" className="admin-v2-sidebar-wide-button" onClick={openAutomationTriggerPicker}>+ Create automation</Button>

              <div className="admin-v2-sidebar-group">
                <div className="admin-v2-side-title">Always on</div>
                <button type="button" className={`admin-v2-subsidebar-option ${automationCategory === 'contact-updates' ? 'is-active' : ''}`} onClick={() => { setAutomationCategory('contact-updates'); setAutomationComposerStep('idle'); setAutomationEditor(null) }}>
                  <span>Contact activity/updates</span>
                  <span className="admin-v2-workspace-count">{selectedAutomations.filter((item) => item.trigger !== 'lead_submitted').length}</span>
                </button>
                <button type="button" className={`admin-v2-subsidebar-option ${automationCategory === 'form-submissions' ? 'is-active' : ''}`} onClick={() => { setAutomationCategory('form-submissions'); setAutomationComposerStep('idle'); setAutomationEditor(null) }}>
                  <span>Form submissions</span>
                  <span className="admin-v2-workspace-count">{selectedAutomations.filter((item) => item.trigger === 'lead_submitted').length}</span>
                </button>
              </div>

              <div className="admin-v2-sidebar-group">
                <div className="admin-v2-sidebar-heading">
                  <span>Scheduled</span>
                </div>
                <button type="button" className={`admin-v2-subsidebar-option ${automationCategory === 'specific-date' ? 'is-active' : ''}`} onClick={() => { setAutomationCategory('specific-date'); setAutomationComposerStep('idle'); setAutomationEditor(null) }}>
                  <span>Specific date/time</span>
                  <span className="admin-v2-workspace-count">0</span>
                </button>
                <button type="button" className={`admin-v2-subsidebar-option ${automationCategory === 'recurring' ? 'is-active' : ''}`} onClick={() => { setAutomationCategory('recurring'); setAutomationComposerStep('idle'); setAutomationEditor(null) }}>
                  <span>Recurring event</span>
                  <span className="admin-v2-workspace-count">0</span>
                </button>
              </div>
            </>
          ) : null}
        </aside>

        <main className="admin-v2-main">
          {section === 'forms' && openedQuizId ? renderBuilder() : null}
          {section === 'forms' && !openedQuizId ? renderFormsHome() : null}
          {section === 'contacts' ? renderContacts() : null}
          {section === 'automations' ? renderAutomations() : null}
        </main>
      </div>

      {formsSearchOpen ? (
        <div className="admin-v2-modal-backdrop" onClick={() => setFormsSearchOpen(false)}>
          <div className="admin-v2-search-overlay" onClick={(event) => event.stopPropagation()}>
            <input autoFocus value={formsSearchQuery} placeholder="Search in contact organization" onChange={(event) => setFormsSearchQuery(event.target.value)} />
            <div className="admin-v2-search-results">
              {visibleForms.length ? (
                visibleForms.map((quiz) => (
                  <button key={quiz.id} type="button" className="admin-v2-search-result" onClick={() => { setFormsSearchOpen(false); openQuizInBuilder(quiz.id, 'content') }}>
                    <strong>{quiz.name}</strong>
                    <span>{selectedProject?.name}</span>
                  </button>
                ))
              ) : (
                <div className="admin-v2-search-empty">No matching forms</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {quizActionModal ? (
        <div className="admin-v2-modal-backdrop" onClick={closeQuizActionModal}>
          <div className="admin-v2-modal admin-v2-quiz-action-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-v2-modal-head">
              <div>
                <h3>{quizActionModal === 'rename' ? 'Rename form' : quizActionModal === 'copy' ? 'Copy form to workspace' : 'Move form to workspace'}</h3>
                <p>{quizActionModal === 'rename' ? 'Update the form name shown on the forms home and builder.' : 'Choose the target workspace for this form action.'}</p>
              </div>
              <button type="button" className="admin-v2-modal-close" onClick={closeQuizActionModal}>×</button>
            </div>

            <label className="admin-v2-modal-field">
              <span>Form name</span>
              <input value={quizActionName} onChange={(event) => setQuizActionName(event.target.value)} />
            </label>

            {quizActionModal !== 'rename' ? (
              <label className="admin-v2-modal-field">
                <span>Workspace</span>
                <select className="admin-v2-native-select" value={quizActionTargetProjectId} onChange={(event) => setQuizActionTargetProjectId(event.target.value)}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="admin-v2-modal-actions">
              <button type="button" className="admin-v2-ghost-button" onClick={closeQuizActionModal}>Cancel</button>
              <Button tone="primary" onClick={() => void handleSubmitQuizAction()}>{quizActionModal === 'rename' ? 'Save' : quizActionModal === 'copy' ? 'Copy form' : 'Move form'}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {workspaceModalOpen ? (
        <div className="admin-v2-modal-backdrop" onClick={() => setWorkspaceModalOpen(false)}>
          <div className="admin-v2-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-v2-modal-head">
              <div>
                <h3>{workspaceModalMode === 'rename' ? 'Rename workspace' : 'Create workspace'}</h3>
                <p>{workspaceModalMode === 'rename' ? 'Update the workspace name shown in the sidebar and home header.' : 'Share it with your team or keep it private.'}</p>
              </div>
              <button type="button" className="admin-v2-modal-close" onClick={() => setWorkspaceModalOpen(false)}>×</button>
            </div>
            <label className="admin-v2-modal-field">
              <span>Workspace name</span>
              <input
                value={workspaceName}
                placeholder="For example: My new workspace"
                onChange={(event) => setWorkspaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleSubmitWorkspace()
                  }
                }}
              />
            </label>
            <div className="admin-v2-modal-actions">
              <button type="button" className="admin-v2-ghost-button" onClick={() => setWorkspaceModalOpen(false)}>Cancel</button>
              <Button tone="primary" onClick={() => void handleSubmitWorkspace()}>{workspaceModalMode === 'rename' ? 'Save changes' : 'Create workspace'}</Button>
            </div>
          </div>
        </div>
      ) : null}

      {section === 'forms' && openedQuizId && selectedQuiz && !isBlankComposerQuiz(selectedQuiz) && newFormLibraryOpen ? renderAddContentModal() : null}

      {contactModal === 'create-list' ? (
        <div className="admin-v2-modal-backdrop" onClick={closeContactSurfaces}>
          <div className="admin-v2-modal admin-v2-contact-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-v2-modal-head">
              <div>
                <h3>Create list</h3>
                <p>Lists will update automatically. Contacts will be included based on chosen filters.</p>
              </div>
              <button type="button" className="admin-v2-modal-close" onClick={closeContactSurfaces}>×</button>
            </div>

            <label className="admin-v2-modal-field">
              <span>List name</span>
              <input value={contactListName} placeholder="Enter list name" onChange={(event) => setContactListName(event.target.value)} />
            </label>

            <div className="admin-v2-contact-filter-box">
              <span>Filters</span>
              <div className="admin-v2-contact-filter-panel">
                <strong>Add filter</strong>
                <div className="admin-v2-floating-menu-anchor" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="admin-v2-select-button" onClick={() => setContactListFieldMenuOpen((current) => !current)}>
                    <span>{selectedContactFilterField || 'Choose a question or data'}</span>
                    <span>⌄</span>
                  </button>
                  {contactListFieldMenuOpen ? (
                    <div className="admin-v2-select-panel">
                      <div className="admin-v2-select-search">Type something</div>
                      {CONTACT_FILTER_FIELDS.map((field) => (
                        <button
                          key={field}
                          type="button"
                          className={`admin-v2-select-option ${selectedContactFilterField === field ? 'is-active' : ''}`}
                          onClick={() => {
                            setSelectedContactFilterField(field)
                            setContactListFieldMenuOpen(false)
                          }}
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="button" className="admin-v2-ghost-button">+ Add filter</button>
              </div>
            </div>

            <div className="admin-v2-modal-actions">
              <button type="button" className="admin-v2-ghost-button" onClick={closeContactSurfaces}>Cancel</button>
              <Button tone="primary" disabled={!contactListName.trim()}>Create list</Button>
            </div>
          </div>
        </div>
      ) : null}

      {contactModal === 'import' ? (
        <div className="admin-v2-modal-backdrop" onClick={closeContactSurfaces}>
          <div className="admin-v2-modal admin-v2-import-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-v2-modal-head">
              <div>
                <h3>Import contacts from CSV</h3>
                <p>Upload a CSV file to import contacts. CSV column headers must match your contact properties.</p>
              </div>
              <button type="button" className="admin-v2-modal-close" onClick={closeContactSurfaces}>×</button>
            </div>
            <div className="admin-v2-import-copy">
              <p>Before importing sensitive information, be aware that everyone in your organization can view contact details.</p>
              <p>Existing contact information will be replaced.</p>
            </div>
            <div className="admin-v2-import-upload-row">
              <button type="button" className="admin-v2-upload-button">Upload CSV file</button>
            </div>
            <div className="admin-v2-modal-actions">
              <button type="button" className="admin-v2-ghost-button" onClick={closeContactSurfaces}>Cancel</button>
              <Button tone="primary">Import contacts</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getLeadElementKey(step: LeadStep | null) {
  if (!step) {
    return 'short-text'
  }

  return step.builderElementKey ?? (step.kind === 'email' ? 'email' : step.kind === 'phone' ? 'phone-number' : step.kind === 'single' ? 'multiple-choice' : 'short-text')
}