import { parseCronExpression } from 'cron-schedule'
import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types'
import { ScheduleOptions, ScheduleResult, ScheduledTask, TaskHandler, CronDurableObjectOptions } from './types'

export * from './types'

/**
 * Get the next execution time for a cron expression
 */
function getNextCronTime(cron: string): number {
  const interval = parseCronExpression(cron)
  return interval.getNextDate().getTime()
}

/**
 * CronDurableObject class for scheduling and executing tasks using Durable Objects alarms
 */
export class CronDurableObject<T = unknown> {
  private storage: DurableObjectStorage
  private defaultHandler?: TaskHandler<T>
  private handlers: Record<string, TaskHandler<T>> = {}

  constructor(state: DurableObjectState, options: CronDurableObjectOptions<T> = {}) {
    this.storage = state.storage
    this.defaultHandler = options.defaultHandler
    this.handlers = options.handlers || {}

    state.blockConcurrencyWhile(async () => {
      await state.storage.setAlarm(await this.getNextAlarmTime())
    })
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.split('/').filter(Boolean)

    if (request.method === 'POST') {
      if (path[0] === 'schedule') {
        const body = (await request.json()) as { cron: string; options?: ScheduleOptions<T> }
        const result = await this.schedule(body.cron, body.options || {})
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        })
      } else if (path[0] === 'cancel') {
        const body = (await request.json()) as { id: string }
        await this.cancel(body.id)
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else if (request.method === 'GET') {
      if (path[0] === 'tasks') {
        if (path.length > 1) {
          const task = await this.getTask(path[1])
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          return new Response(JSON.stringify(task), {
            headers: { 'Content-Type': 'application/json' },
          })
        } else {
          const tasks = await this.listTasks()
          return new Response(JSON.stringify(tasks), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
    }

    return new Response('Not found', { status: 404 })
  }

  /**
   * Handle alarms
   */
  async alarm(): Promise<void> {
    const now = Date.now()
    const tasksToExecute = await this.getTasksDueBy(now)

    if (tasksToExecute.length === 0) {
      await this.storage.setAlarm(await this.getNextAlarmTime())
      return
    }

    await Promise.all(
      tasksToExecute.map(async (task) => {
        try {
          let handler = this.defaultHandler
          for (const [prefix, prefixHandler] of Object.entries(this.handlers)) {
            if (task.id.startsWith(prefix)) {
              handler = prefixHandler
              break
            }
          }

          if (handler) {
            await handler(task)
          }

          task.lastExecutedAt = now

          const nextTime = getNextCronTime(task.schedule.cron)
          task.schedule.time = nextTime

          await this.storage.put(`task:${task.id}`, task)
        } catch (error) {
          console.error(`Error executing task ${task.id}:`, error)

          const errorInfo = {
            error: String(error),
            task,
            timestamp: Date.now(),
            stack: error instanceof Error ? error.stack : undefined,
          }

          await this.storage.put(`error:${task.id}:${Date.now()}`, errorInfo)

          try {
            const currentTask = (await this.storage.get(`task:${task.id}`)) as ScheduledTask<T> | null
            if (currentTask) {
              let dataPayload: Record<string, unknown>;
              if (typeof currentTask.data === 'object' && currentTask.data !== null) {
                dataPayload = { ...(currentTask.data as Record<string, unknown>) };
              } else {
                dataPayload = {};
              }

              const currentErrorCount = typeof dataPayload._errors === 'number' ? dataPayload._errors : 0;
              dataPayload._errors = currentErrorCount + 1;
              dataPayload._lastErrorAt = Date.now();
              dataPayload._lastError = String(error);

              currentTask.data = dataPayload as T;

              const nextTime = getNextCronTime(currentTask.schedule.cron)
              currentTask.schedule.time = nextTime

              await this.storage.put(`task:${task.id}`, currentTask)
            }
          } catch (updateError) {
            console.error(`Error updating task ${task.id} after failure:`, updateError)
          }
        }
      }),
    )

    await this.storage.setAlarm(await this.getNextAlarmTime())
  }

  /**
   * Schedule a task to be executed according to a cron expression
   */
  async schedule(cron: string, options: ScheduleOptions<T> = {}): Promise<ScheduleResult> {
    const id = options.id || crypto.randomUUID()
    const nextExecutionTime = getNextCronTime(cron)

    const task: ScheduledTask<T> = {
      id,
      schedule: {
        type: 'cron',
        time: nextExecutionTime,
        cron,
      },
      data: options.data as T,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.storage.put(`task:${id}`, task)
    await this.storage.setAlarm(await this.getNextAlarmTime())

    return {
      id,
      nextExecutionTime,
    }
  }

  /**
   * Cancel a scheduled task
   */
  async cancel(id: string): Promise<boolean> {
    const result = await this.storage.delete(`task:${id}`)
    await this.storage.setAlarm(await this.getNextAlarmTime())
    return result
  }

  /**
   * Get a scheduled task by ID
   */
  async getTask(id: string): Promise<ScheduledTask<T> | null> {
    return (await this.storage.get(`task:${id}`)) as ScheduledTask<T> | null
  }

  /**
   * List all scheduled tasks
   */
  async listTasks(): Promise<ScheduledTask<T>[]> {
    const tasksMap = await this.storage.list<ScheduledTask<T>>({ prefix: 'task:' })
    return Array.from(tasksMap.values())
  }

  /**
   * Get tasks that are due by a specific time
   */
  async getTasksDueBy(time: number): Promise<ScheduledTask<T>[]> {
    const allTasks = await this.listTasks()
    return allTasks.filter((task) => task.schedule.time <= time)
  }

  /**
   * Get the next alarm time based on scheduled tasks
   */
  async getNextAlarmTime(): Promise<number> {
    const tasks = await this.listTasks()

    if (tasks.length === 0) {
      return Date.now() + 24 * 60 * 60 * 1000
    }

    return Math.min(...tasks.map((task) => task.schedule.time))
  }
}

/**
 * Create a new CronDurableObject class with the provided options
 */
export function createCronDurableObject<T = unknown>(options: CronDurableObjectOptions<T> = {}): typeof CronDurableObject<T> {
  return class extends CronDurableObject<T> {
    constructor(state: DurableObjectState) {
      super(state, options)
    }
  }
}

export default createCronDurableObject
