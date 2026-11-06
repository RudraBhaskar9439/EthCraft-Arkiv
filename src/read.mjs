// Extracted from EthCraft's MIT-licensed Arkiv integration; see NOTICE.
import {createPublicClient,defineSchema,str,u64,bytes} from '@arkiv-network/sdk'
import {rabdi} from '@arkiv-network/sdk/chains'
import {and,eq,desc} from '@arkiv-network/sdk/query'
import {http,hexToString} from 'viem'
export const chainId = 7794095
export const publisherAddress = '0x5a262B9621eD0F00Fe776bb85084E9561cF18608'
export const engineAddress = '0x4400000000000000000000000000000000000044'
export const TaskProgress = defineSchema('ethcraft.task-progress.v1', {
  server: str().indexed(), task: str().indexed(), job: str().indexed(), provider: str().indexed(),
  status: str().indexed(), revision: u64().indexed(), facts: bytes()
})
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const hexKey = /^0x[0-9a-f]{64}$/i
const item = /^(?:minecraft:)?[a-z][a-z0-9_]{0,63}$/
const tools = new Set(['move','gather','craft','build','place','activate','equip','eat','smelt','hunt','deposit','withdraw','purchase','blueprint','observe'])
const statuses = new Set(['running','paused','blocked','ready_for_review','handed_off'])
const position = p => Array.isArray(p) && p.length === 3 && p.every(n => Number.isSafeInteger(n) && Math.abs(n) <= 30000000)

export function validateProgress(record, server) {
  const f = record?.facts
  if (!record || Object.keys(record).some(k => !['server','task','job','provider','status','facts'].includes(k)) || record.server !== server || !uuid.test(record.task) || !uuid.test(record.job) || !['claude','0g'].includes(record.provider) || !statuses.has(record.status) ||
      !f || f.version !== 1 || typeof f.fixture !== 'boolean' || Object.keys(f).some(k => !['version','fixture','completedSteps','failedSteps','receipts','receiptDigest','pendingEffect','actions','predecessor'].includes(k)) ||
      !Number.isSafeInteger(f.receipts) || f.receipts < 0 || !/^[0-9a-f]{64}$/.test(f.receiptDigest || '') ||
      !Number.isSafeInteger(f.completedSteps) || f.completedSteps < 0 || !Number.isSafeInteger(f.failedSteps) || f.failedSteps < 0 || typeof f.pendingEffect !== 'boolean' || !Array.isArray(f.actions) || f.actions.length > 12 ||
      !(f.predecessor === null || hexKey.test(f.predecessor))) throw Error('ARKIV_PROGRESS_INVALID')
  for (const a of f.actions) {
    if (!a || !tools.has(a.tool) || Object.keys(a).some(k => !['tool','item','position','count','produced','collected','moved','verifiedBlocks','consumed','delivered'].includes(k)) ||
        a.item !== undefined && !item.test(a.item) || a.position !== undefined && !position(a.position) || a.delivered !== undefined && typeof a.delivered !== 'boolean') throw Error('ARKIV_PROGRESS_INVALID')
    for (const k of ['count','produced','collected','moved','verifiedBlocks','consumed']) if (a[k] !== undefined && (!Number.isSafeInteger(a[k]) || a[k] < 0 || a[k] > 100000)) throw Error('ARKIV_PROGRESS_INVALID')
  }
  if (new TextEncoder().encode(JSON.stringify(record)).length > 12000) throw Error('ARKIV_PROGRESS_TOO_LARGE')
  return record
}

export function createTaskReader({ server, publisher = publisherAddress, accessKey = '', client } = {}) {
  client ||= createPublicClient({ chain: rabdi({ accessKey }), transport: http(undefined, { retryCount: 0, timeout: 15000 }) })
  const decode = row => {
    if (row.$owner?.toLowerCase() !== publisher.toLowerCase()) throw Error('ARKIV_PUBLISHER_MISMATCH')
    const record = validateProgress({
      ...Object.fromEntries(['server','task','job','provider','status'].map(k => [k,row[k].value])), facts: JSON.parse(hexToString(row.facts.value))
    }, server)
    if (!hexKey.test(row.$key) || row.revision.value < 1n || row.revision.value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('ARKIV_ENTITY_INVALID')
    return { ...record, entityKey: row.$key, revision: Number(row.revision.value), expiresAtBlock: String(row.$expiresAt),
      owner: row.$owner, attestation: 'Host-observed progress; not independent inspection or payment authority.' }
  }
  return {
    client, server, publisher,
    async get(key) {
      if (!hexKey.test(key)) throw Error('ARKIV_ENTITY_KEY_REQUIRED')
      return decode(await client.getEntity(key, TaskProgress))
    },
    async list({ provider, status, offset = 0 } = {}) {
      if (provider !== undefined && !['claude','0g'].includes(provider) || status !== undefined && !statuses.has(status) || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw Error('ARKIV_QUERY_INVALID')
      const filters = [eq('server',server)]
      if (provider) filters.push(eq('provider',provider))
      // Filter lifecycle state after choosing the latest revision, so old paused snapshots cannot look current.
      const page = await client.select('*').from(TaskProgress).ownedBy(publisher).where(and(...filters)).orderBy(desc('revision')).limit(100).offset(offset).fetch()
      const latest = new Map()
      let rejected = 0
      for (const row of page.entities) {
        try { const r = decode(row); if (!latest.has(r.job)) latest.set(r.job,r) } catch { rejected++ }
      }
      return { chainId, server, publisher, blockNumber: String(page.blockNumber), records: [...latest.values()].filter(r => !status || r.status === status), rejected,
        nextOffset: page.entities.length + page.skipped === 100 ? offset + 100 : null, source: 'live-arkiv', scope: 'Latest revision per job within this result page; older pages contain history.' }
    }
  }
}

