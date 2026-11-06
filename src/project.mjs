import {createHash} from 'node:crypto'
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const hexKey = /^0x[0-9a-f]{64}$/i
const item = /^(?:minecraft:)?[a-z][a-z0-9_]{0,63}$/
const tools = new Set(['move','gather','craft','build','place','activate','equip','eat','smelt','hunt','deposit','withdraw','purchase','blueprint','observe'])
const statuses = new Set(['running','paused','blocked','ready_for_review','handed_off'])
export const serverNamespace = server => createHash('sha256').update(server).digest('hex')
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const position = p => Array.isArray(p) && p.length === 3 && p.every(n => Number.isSafeInteger(n) && Math.abs(n) <= 30000000)

// Publish only typed action facts. Prompts, model messages, identities and raw receipts never leave the host.
export function projectProgress(job, provider, server) {
  if (!uuid.test(job.id) || !uuid.test(job.rootTask || job.id) || !['claude','0g'].includes(provider) || !statuses.has(job.status)) throw Error('ARKIV_PROGRESS_BINDING_REQUIRED')
  const completed = job.history.filter(h => h.step && h.result && tools.has(h.step.tool))
  const facts = completed.slice(-12).map(h => {
    const fact = { tool: h.step.tool }
    if (item.test(h.step.item || '')) fact.item = h.step.item
    if (position(h.step.position)) fact.position = h.step.position
    for (const key of ['count','produced','collected','moved','verifiedBlocks','consumed']) {
      const n = key === 'count' ? h.step.count : h.result[key]
      if (Number.isSafeInteger(n) && n >= 0 && n <= 100000) fact[key] = n
    }
    if (h.step.tool === 'purchase') fact.delivered = h.result.delivered === true
    return fact
  })
  return {
    server, task: job.rootTask || job.id, job: job.id, provider, status: job.status,
    facts: { version: 1, fixture: job.qualificationFixture === true, completedSteps: completed.length, failedSteps: job.history.filter(h => h.error).length,
      receipts: (job.effects || []).length, receiptDigest: digest(job.effects || []),
      pendingEffect: !!job.pendingEffect, actions: facts, predecessor: job.sharedProgress?.entityKey || null }
  }
}

