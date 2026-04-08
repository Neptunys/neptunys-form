import type { AutomationEdge, AutomationNode, ProjectAutomation, QuizDefinition } from '../lib/types'
import { createId } from '../lib/utils'

type AutomationTemplateKind = 'lead-intake' | 'priority-review' | 'nurture-recovery'

function createAutomationNode(
  type: AutomationNode['type'],
  title: string,
  body: string,
  x: number,
  y: number,
  tone: AutomationNode['tone'] = 'default',
): AutomationNode {
  return {
    id: createId('automation-node'),
    type,
    title,
    body,
    position: { x, y },
    tone,
  }
}

function createAutomationEdge(source: string, target: string, label?: string): AutomationEdge {
  return {
    id: createId('automation-edge'),
    source,
    target,
    label,
  }
}

export function createAutomationTemplate(
  kind: AutomationTemplateKind,
  projectId: string,
  quiz: QuizDefinition,
  overrides: Partial<ProjectAutomation> = {},
): ProjectAutomation {
  const updatedAt = new Date().toISOString()

  if (kind === 'priority-review') {
    const trigger = createAutomationNode('trigger', 'Qualified lead', `Starts when ${quiz.name} resolves to likely.`, 40, 132, 'success')
    const condition = createAutomationNode('condition', 'Apply priority lane', 'Push high-intent leads into the priority review queue.', 318, 58, 'success')
    const notify = createAutomationNode('action', 'Notify review team', 'Send an internal alert with lead context and answers.', 608, 58)
    const webhook = createAutomationNode('action', 'Push to CRM webhook', 'Forward the lead payload to the configured webhook endpoint.', 608, 206)

    return {
      id: createId('automation'),
      projectId,
      quizId: quiz.id,
      name: `${quiz.name} priority review`,
      description: 'Escalates likely outcomes into a faster internal review lane.',
      status: 'live',
      trigger: 'result_likely',
      nodes: [trigger, condition, notify, webhook],
      edges: [
        createAutomationEdge(trigger.id, condition.id, 'Likely'),
        createAutomationEdge(condition.id, notify.id, 'Internal alert'),
        createAutomationEdge(condition.id, webhook.id, 'External sync'),
      ],
      updatedAt,
      ...overrides,
    }
  }

  if (kind === 'nurture-recovery') {
    const trigger = createAutomationNode('trigger', 'Recovery path', `Starts when ${quiz.name} resolves to soft fail or hard fail.`, 40, 132, 'warning')
    const wait = createAutomationNode('action', 'Wait 24 hours', 'Hold the lead before sending a follow-up message or webhook.', 318, 132)
    const webhook = createAutomationNode('action', 'Send nurture webhook', 'Route the lead to a lower-intent follow-up workflow.', 598, 58)
    const tag = createAutomationNode('action', 'Tag as nurture', 'Apply a nurture tag so operators can filter this group later.', 598, 206, 'warning')

    return {
      id: createId('automation'),
      projectId,
      quizId: quiz.id,
      name: `${quiz.name} nurture recovery`,
      description: 'Catches lower-intent outcomes and passes them into a slower follow-up lane.',
      status: 'draft',
      trigger: 'result_soft_fail',
      nodes: [trigger, wait, webhook, tag],
      edges: [
        createAutomationEdge(trigger.id, wait.id, 'Soft fail'),
        createAutomationEdge(wait.id, webhook.id, 'Webhook'),
        createAutomationEdge(wait.id, tag.id, 'Tag contact'),
      ],
      updatedAt,
      ...overrides,
    }
  }

  const trigger = createAutomationNode('trigger', 'Lead submitted', `Starts when ${quiz.name} captures a lead.`, 40, 132)
  const notify = createAutomationNode('action', 'Notify operations', 'Alert the internal team with the latest lead details.', 318, 58)
  const webhook = createAutomationNode('action', 'Post to webhook', 'Forward lead payload to the configured downstream system.', 318, 206)
  const audit = createAutomationNode('action', 'Log submission', 'Keep a local execution trail for operator visibility.', 598, 132)

  return {
    id: createId('automation'),
    projectId,
    quizId: quiz.id,
    name: `${quiz.name} lead intake`,
    description: 'Routes each submitted lead into the team and webhook channels.',
    status: 'live',
    trigger: 'lead_submitted',
    nodes: [trigger, notify, webhook, audit],
    edges: [
      createAutomationEdge(trigger.id, notify.id, 'Notify'),
      createAutomationEdge(trigger.id, webhook.id, 'Sync'),
      createAutomationEdge(notify.id, audit.id, 'Recorded'),
      createAutomationEdge(webhook.id, audit.id, 'Recorded'),
    ],
    updatedAt,
    ...overrides,
  }
}

export function buildDefaultProjectAutomations(projectId: string, quiz: QuizDefinition): ProjectAutomation[] {
  return [
    createAutomationTemplate('lead-intake', projectId, quiz),
    createAutomationTemplate('priority-review', projectId, quiz),
    createAutomationTemplate('nurture-recovery', projectId, quiz),
  ]
}