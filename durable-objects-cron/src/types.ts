/**
 * Types for durable-objects-cron package
 */

/**
 * Type of schedule for recurring execution based on cron expression
 */
export type ScheduleType = 'cron'

/**
 * Schedule definition for recurring execution based on cron expression
 */
export interface CronSchedule {
  /** Type of schedule for recurring execution based on cron expression */
  type: 'cron'
  /** Timestamp for the next execution */
  time: number
  /** Cron expression defining the schedule */
  cron: string
}

/**
 * Options for scheduling a task
 */
export interface ScheduleOptions<T = unknown> {
  /**
   * Unique identifier for the scheduled task
   * If not provided, a random UUID will be generated
   */
  id?: string

  /**
   * Data to be passed to the task when it executes
   */
  data?: T
}

/**
 * Result of scheduling a task
 */
export interface ScheduleResult {
  /**
   * Unique identifier for the scheduled task
   */
  id: string

  /**
   * Timestamp when the task will next execute
   */
  nextExecutionTime: number
}

/**
 * Information about a scheduled task
 */
export interface ScheduledTask<T = unknown> {
  /**
   * Unique identifier for the scheduled task
   */
  id: string

  /**
   * Schedule definition
   */
  schedule: CronSchedule

  /**
   * Data to be passed to the task when it executes
   */
  data: T

  /**
   * Timestamp when the task was created
   */
  createdAt: number

  /**
   * Timestamp when the task was last updated
   */
  updatedAt: number

  /**
   * Timestamp when the task was last executed
   */
  lastExecutedAt?: number
}

/**
 * Handler function for scheduled tasks
 */
export type TaskHandler<T = unknown> = (task: ScheduledTask<T>) => void | Promise<void>

/**
 * Options for the CronDurableObject
 */
export interface CronDurableObjectOptions<T = unknown> {
  /**
   * Default handler function for tasks that don't have a specific handler
   */
  defaultHandler?: TaskHandler<T>

  /**
   * Record of named handlers for specific tasks
   */
  handlers?: Record<string, TaskHandler<T>>
}
