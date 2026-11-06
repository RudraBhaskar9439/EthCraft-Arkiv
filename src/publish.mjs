import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createWalletClient,u64,bytes,ExpirationTime,ENTITY_EVENTS_ABI} from '@arkiv-network/sdk'
import {http,custom,stringToHex,parseTransaction,recoverTransactionAddress,keccak256,decodeEventLog} from 'viem'
import {TaskProgress,validateProgress,chainId,engineAddress} from './read.mjs'
import {writeCheckpoint} from './journal.mjs'
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const maxCost = 1000000000000000000n, maxTransactionCost = 100000000000000000n
export class TaskPublisher {
  constructor({ reader, account, file, state, transport }) {
    Object.assign(this,{ reader, account, file, state, transport })
    this.tail = Promise.resolve()
  }
  async save() { await writeCheckpoint(this.file,this.state) }
  publish(record) {
    validateProgress(record,this.reader.server)
    const work = this.tail.then(() => this.perform(record))
    this.tail = work.catch(() => {})
    return work
  }
  async perform(record) {
    const fingerprint = digest(record)
    let entry = this.state.entries.find(e => e.fingerprint === fingerprint)
    const earlier = this.state.entries.find(e => e.rawTransaction && !['confirmed','reverted'].includes(e.status))
    if (earlier && earlier !== entry) await this.reconcile(earlier)
    if (!entry) {
      if (this.state.entries.length >= 200) throw Error('ARKIV_PUBLICATION_LIMIT_REACHED')
      entry = { fingerprint, record, revision: this.state.entries.length + 1, status: 'prepared', createdAt: new Date().toISOString() }
      this.state.entries.push(entry); await this.save()
    }
    if (entry.status === 'reverted') throw Error('ARKIV_PUBLICATION_REVERTED')
    if (entry.entityKey) {
      try { return { ...await this.reader.get(entry.entityKey), transactionHash: entry.transactionHash } }
      catch (error) { if (error.name === 'NoEntityFoundError') throw Error('ARKIV_SHARED_RECORD_EXPIRED'); throw error }
    }
    if (entry.rawTransaction) return this.reconcile(entry)
    if (await this.reader.client.getChainId() !== chainId) throw Error('ARKIV_RABDI_REQUIRED')
    if (await this.reader.client.getBalance({ address: this.account.address }) === 0n) throw Error('ARKIV_TEST_GAS_REQUIRED')
    const ordinary = this.transport({ chain: this.reader.client.chain, retryCount: 0 })
    const transport = custom({ request: async request => {
      if (request.method !== 'eth_sendRawTransaction') return ordinary.request(request)
      const raw = request.params[0], tx = parseTransaction(raw)
      const signer = await recoverTransactionAddress({ serializedTransaction: raw })
      if (tx.chainId !== chainId || tx.to?.toLowerCase() !== engineAddress.toLowerCase() || (tx.value || 0n) !== 0n || signer.toLowerCase() !== this.account.address.toLowerCase() || entry.rawTransaction && entry.rawTransaction !== raw) throw Error('ARKIV_SIGNING_SCOPE_CHANGED')
      const reserved = tx.gas * (tx.maxFeePerGas ?? tx.gasPrice)
      const previous = this.state.entries.filter(e => e !== entry).reduce((sum,e) => sum + BigInt(e.reservedCost || 0),0n)
      if (reserved > maxTransactionCost || previous + reserved > maxCost) throw Error('ARKIV_TEST_GAS_CAP_REACHED')
      entry.rawTransaction = raw; entry.transactionHash = keccak256(raw); entry.reservedCost = String(reserved); entry.status = 'submitted'
      await this.save()
      return ordinary.request(request)
    } },{ retryCount: 0 })
    const wallet = createWalletClient({ account: this.account, chain: this.reader.client.chain, transport })
    const result = await wallet.createEntity(TaskProgress,{
      server: record.server, task: record.task, job: record.job, provider: record.provider, status: record.status,
      revision: u64(BigInt(entry.revision)), facts: bytes(stringToHex(JSON.stringify(record.facts)))
    },{ expiration: ExpirationTime.fromDays(7), flags: { readonly: true } })
    if (result.txHash !== entry.transactionHash) throw Error('ARKIV_RECEIPT_MISMATCH')
    return this.reconcile(entry)
  }
  async reconcile(entry) {
    let receipt
    try { receipt = await this.reader.client.getTransactionReceipt({ hash: entry.transactionHash }) }
    catch (error) {
      if (!['TransactionReceiptNotFoundError','TransactionNotFoundError'].includes(error.name)) throw error
      try { await this.reader.client.request({ method: 'eth_sendRawTransaction', params: [entry.rawTransaction] }) }
      catch (sendError) { if (!/already known|known transaction|nonce too low/i.test(sendError.shortMessage || sendError.message)) throw Error('ARKIV_PUBLICATION_PENDING') }
      try { receipt = await this.reader.client.waitForTransactionReceipt({ hash: entry.transactionHash, timeout: 20000 }) }
      catch { throw Error('ARKIV_PUBLICATION_PENDING') }
    }
    if (receipt.status !== 'success') { entry.status = 'reverted'; await this.save(); throw Error('ARKIV_PUBLICATION_REVERTED') }
    const keys = []
    for (const log of receipt.logs) if (log.address.toLowerCase() === engineAddress.toLowerCase()) {
      try { const event = decodeEventLog({ abi: ENTITY_EVENTS_ABI, data: log.data, topics: log.topics }); if (event.eventName === 'EntityCreated') keys.push(event.args.entityKey) } catch {}
    }
    if (keys.length !== 1) throw Error('ARKIV_RECEIPT_ENTITY_REQUIRED')
    const found = await this.reader.get(keys[0])
    const {server,task,job,provider,status,facts} = found
    if (digest({server,task,job,provider,status,facts}) !== entry.fingerprint || found.revision !== entry.revision) throw Error('ARKIV_RECEIPT_CONTENT_MISMATCH')
    entry.entityKey = keys[0]; entry.status = 'confirmed'; entry.confirmedAt = new Date().toISOString(); await this.save()
    return { ...found, transactionHash: entry.transactionHash }
  }
}

export async function loadPublisherState(file, server, publisher) {
  let state
  try { state = JSON.parse(await readFile(file,'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  state ||= { version: 1, server, publisher, entries: [] }
  if (state.version !== 1 || state.server !== server || state.publisher.toLowerCase() !== publisher.toLowerCase() || !Array.isArray(state.entries)) throw Error('ARKIV_PUBLISHER_STATE_BINDING_CHANGED')
  return state
}
