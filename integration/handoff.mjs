// Native integration adapter: requires the host's actual approved owner and objective services.
import {projectProgress} from '../src/project.mjs'
export async function handoffTask({provider, objectives, event, jobId, publisher, reader, server, onProgress}) {
        const existing = objectives[provider].state.jobs.find(j => j.operationId === event.operationId && j.ownerId === event.playerId)
        if (existing?.sharedProgress) return objectives[provider].status(event.playerId)
        const source = Object.entries(objectives).find(([p,o]) => p !== provider && o.state.jobs.some(j => j.id === jobId && j.ownerId === event.playerId))
        if (!source) throw Error('ARKIV_OWNED_SOURCE_TASK_REQUIRED')
        const [sourceProvider, survival] = source, job = survival.latest(event.playerId)
        if (job?.id !== jobId || !job.arkivShared) throw Error('ARKIV_CURRENT_SHARED_TASK_REQUIRED')
        const target = objectives[provider]
        if (job.handoffIntent) {
          const prior = target.state.jobs.find(j => j.operationId === job.handoffIntent.operationId && j.ownerId === event.playerId)
          if (prior?.sharedProgress) { job.status = 'handed_off'; await survival.save(); return target.status(event.playerId) }
          delete job.handoffIntent; await survival.save()
        }
        if (job.status === 'handed_off') throw Error('ARKIV_TASK_ALREADY_HANDED_OFF')
        const previous = target.latest(event.playerId)
        if (target.running.has(event.playerId) || previous?.status === 'running' || previous?.pendingEffect) throw Error('ARKIV_TARGET_TASK_MUST_BE_IDLE')
        if (job.pendingEffect || survival.manager?.tools?.unfinished(event.playerId)) throw Error('ARKIV_PENDING_EFFECT_BLOCKS_HANDOFF')
        job.handoffIntent = { operationId:event.operationId, provider }; await survival.save()
        await survival.stop(event.playerId); await survival.running.get(event.playerId)
        if (job.pendingEffect || job.activeLock || survival.manager?.tools?.unfinished(event.playerId)) { delete job.handoffIntent; await survival.save(); throw Error('ARKIV_PENDING_EFFECT_BLOCKS_HANDOFF') }
        if (job.status !== 'paused') { job.status = 'paused'; await survival.save() }
        try {
        const published = await publisher.publish(projectProgress(job,sourceProvider,server))
        // Read through Arkiv again: local journals authorize work; shared data supplies only observed context.
        const observed = await reader.get(published.entityKey)
        if (observed.job !== job.id || observed.facts.pendingEffect || observed.status !== 'paused') throw Error('ARKIV_SAFE_HANDOFF_REQUIRED')
        const context = { entityKey: observed.entityKey, rootTask: observed.task, provider: sourceProvider, facts: observed.facts }
        const result = await target.start(event,job.goal,context)
        if (target.latest(event.playerId)?.sharedProgress?.entityKey !== observed.entityKey) { delete job.handoffIntent; await survival.save(); return result }
        job.status = 'handed_off'; job.message = 'Owner requested continuation by the other agent; Arkiv progress is advisory.'
        await survival.save(); onProgress(sourceProvider,job)
        return result+' Arkiv handoff read: '+observed.entityKey+'. Supplies and world state are rechecked; permissions are not transferred.'
        } catch (error) {
          if (!target.state.jobs.some(j => j.operationId === event.operationId && j.ownerId === event.playerId)) { delete job.handoffIntent; await survival.save() }
          throw error
        }
}

