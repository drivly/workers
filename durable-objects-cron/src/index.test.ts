import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createCronDurableObject, CronDurableObject } from './index'
import type { TaskHandler, ScheduledTask } from './types'
import type {
  DurableObjectState,
  DurableObjectStorage,
  DurableObjectId,
  DurableObjectTransaction,
  DurableObjectListOptions,
  DurableObjectPutOptions,
  DurableObjectGetOptions,
} from '@cloudflare/workers-types'

interface TestData {
  test?: string;
  foo?: string;
  baz?: string;
  initial?: string;
  shouldFail?: boolean;
  _errors?: number;
  _lastError?: string;
  _lastErrorAt?: number;
}

let mockTask: ScheduledTask<TestData>;
let mockTasks: Array<ScheduledTask<TestData>>;

const mockStorage: Partial<DurableObjectStorage> = {
  setAlarm: vi.fn().mockResolvedValue(undefined),
  getAlarm: vi.fn().mockResolvedValue(null),
  deleteAlarm: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockImplementation(async <T>(keyOrEntries: string | Record<string, T>, value?: T | DurableObjectPutOptions, options?: DurableObjectPutOptions) => {
    // This mock needs to handle both (key, value) and (entries) signatures
    // For simplicity in these tests, we'll assume key-value for tasks and errors
    if (typeof keyOrEntries === 'string') {
      // console.log('mockStorage.put called with key:', keyOrEntries, 'value:', value);
    } else {
      // console.log('mockStorage.put called with entries:', keyOrEntries);
    }
    return undefined
  }),
  get: vi.fn().mockImplementation(async (key: string | readonly string[], _options?: DurableObjectGetOptions) => {
    if (typeof key === 'string') {
      if (key.startsWith('task:')) {
        return mockTask // Will be assigned later
      }
    }
    return null // Default or handle array of keys if needed
  }),
  delete: vi.fn().mockResolvedValue(true),
  list: vi.fn().mockImplementation(async (_options?: DurableObjectListOptions) => {
    // Return mockTasks, will be assigned later
    return new Map(mockTasks ? mockTasks.map((task) => [`task:${task.id}`, task]) : [])
  }),
  transaction: vi.fn().mockImplementation(async (closure) => {
    const mockTxn: Partial<DurableObjectTransaction> = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined), // Simplified
      delete: vi.fn().mockResolvedValue(true),
      setAlarm: vi.fn().mockResolvedValue(undefined),
      getAlarm: vi.fn().mockResolvedValue(null),
      deleteAlarm: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn(),
    }
    return await closure(mockTxn as DurableObjectTransaction)
  }),
  deleteAll: vi.fn().mockResolvedValue(undefined),
  sync: vi.fn().mockResolvedValue(undefined),
}

const mockState: Partial<DurableObjectState> = {
  id: { name: 'test-do', toString: () => 'test-do-id' } as DurableObjectId,
  storage: mockStorage as DurableObjectStorage,
  waitUntil: vi.fn(),
  blockConcurrencyWhile: vi.fn().mockImplementation(async (fn) => await fn()),
}

describe('CronDurableObject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Initialize/Reset mockTask and mockTasks before each test
    const now = Date.now()
    mockTask = {
      id: 'test-task',
      schedule: { type: 'cron' as const, time: now + 60000, cron: '*/5 * * * *' },
      data: { test: 'data' },
      createdAt: now,
      updatedAt: now,
    }
    mockTasks = [
      { id: 'task-1', schedule: { type: 'cron' as const, time: now - 1000, cron: '*/5 * * * *' }, data: { foo: 'bar' }, createdAt: now - 60000, updatedAt: now - 60000 },
      { id: 'task-2', schedule: { type: 'cron' as const, time: now - 500, cron: '*/10 * * * *' }, data: { baz: 'qux' }, createdAt: now - 30000, updatedAt: now - 30000 },
    ];

    // Setup mock implementations that depend on mockTask and mockTasks
    (mockStorage.get as Mock).mockImplementation(async (key: string | readonly string[], _options?: DurableObjectGetOptions) => {
      if (typeof key === 'string') {
        if (key === `task:${mockTask.id}`) return mockTask;
        const foundTask = mockTasks.find(t => `task:${t.id}` === key);
        if (foundTask) return foundTask;
        // Specific get for error handling test
        if (key === 'task:error-task') {
            return { 
                id: 'error-task',
                schedule: { type: 'cron' as const, time: Date.now() - 1000, cron: '* * * * *' },
                data: { initial: 'data' },
                createdAt: Date.now() - 60000,
                updatedAt: Date.now() - 60000,
             } as ScheduledTask<TestData>;
        }
      }
      return null
    });
    (mockStorage.list as Mock).mockImplementation(async (_options?: DurableObjectListOptions) => {
      return new Map(mockTasks.map((task) => [`task:${task.id}`, task]))
    })
  })

  it('creates a CronDurableObject instance', () => {
    const cronDO = new CronDurableObject(mockState as DurableObjectState, {})
    expect(cronDO).toBeDefined()
    expect(cronDO).toBeInstanceOf(CronDurableObject)
  })

  it('sets an alarm on initialization', async () => {
    const setAlarmSpy = vi.spyOn(mockStorage, 'setAlarm')
    new CronDurableObject(mockState as DurableObjectState, {})
    await new Promise(process.nextTick)
    expect(mockState.blockConcurrencyWhile).toHaveBeenCalled()
    expect(setAlarmSpy).toHaveBeenCalled()
  })

  it('schedules a task with a cron expression', async () => {
    const taskId = 'test-task' // Use the id from the global mockTask for consistency in this test
    const mockTaskData: TestData = { test: 'data' } // This can be specific to the test if needed
    
    // Re-assign mockTask for this specific test case if its default setup isn't suitable
    // or ensure the global mockTask set in beforeEach is what's expected.
    // For this test, we assume the beforeEach setup of mockTask is fine, or we'd override it here.

    const cronDO = new CronDurableObject(
        mockState as DurableObjectState, 
        {}
    )
    // Use mockTask.id and mockTaskData for scheduling
    const result = await cronDO.schedule(mockTask.schedule.cron, { id: mockTask.id, data: mockTaskData })

    expect(result).toBeDefined()
    expect(result.id).toBe(mockTask.id)
    expect(result.nextExecutionTime).toBeDefined()
    expect(mockStorage.put).toHaveBeenCalled()

    const putCalls = (mockStorage.put as Mock).mock.calls as Array<[string, ScheduledTask<TestData>] | [Record<string, ScheduledTask<TestData>>]>
    const taskPutCall = putCalls.find((call) => typeof call[0] === 'string' && call[0] === `task:${mockTask.id}`) as [string, ScheduledTask<TestData>] | undefined
    
    expect(taskPutCall).toBeDefined()
    if (taskPutCall) {
      const storedTask = taskPutCall[1]
      expect(storedTask.id).toBe(mockTask.id)
      expect(storedTask.schedule.cron).toBe(mockTask.schedule.cron)
      expect(storedTask.data).toEqual(mockTaskData)
    }
  })

  it('executes tasks when alarm fires', async () => {
    // mockTasks is already set up in beforeEach
    const mockHandler = vi.fn<(task: ScheduledTask<TestData>, storage: DurableObjectStorage, env: any) => void>();
    
    const cronDO = new CronDurableObject(
        mockState as DurableObjectState, 
        { defaultHandler: mockHandler as unknown as TaskHandler<TestData> }
    )
    await cronDO.alarm()

    expect(mockHandler).toHaveBeenCalledTimes(mockTasks.length) // Expect once for each task in mockTasks
    expect(mockHandler.mock.calls[0][0]).toEqual(mockTasks[0])
    expect(mockHandler.mock.calls[1][0]).toEqual(mockTasks[1])

    const putCalls = (mockStorage.put as Mock).mock.calls as Array<[string, ScheduledTask<TestData>]>
    // Check that put was called for each task in mockTasks
    for (const task of mockTasks) {
      expect(putCalls.some((call) => call[0] === `task:${task.id}`)).toBe(true)
    }
    expect(mockStorage.setAlarm).toHaveBeenCalled()
  })

  it('handles errors during task execution', async () => {
    const now = Date.now()
    // Specific mockTask for this error test
    const errorTask = {
      id: 'error-task',
      schedule: { type: 'cron' as const, time: now - 1000, cron: '* * * * *' },
      data: { initial: 'data', shouldFail: true }, // Add shouldFail to trigger error
      createdAt: now - 60000,
      updatedAt: now - 60000,
    } as ScheduledTask<TestData>
    // Ensure this specific task is returned by `get` and `list` for this test
    (mockStorage.get as Mock).mockImplementation(async (key: string) => (key === `task:${errorTask.id}` ? errorTask : null));
    (mockStorage.list as Mock).mockResolvedValue(new Map([[`task:${errorTask.id}`, errorTask]]));

    const errorHandler = vi.fn<(task: ScheduledTask<TestData>, storage: DurableObjectStorage, env: any) => void>(
      (taskToProcess: ScheduledTask<TestData>, storage: DurableObjectStorage, env: any) => { 
        if (taskToProcess.data && (taskToProcess.data as TestData).shouldFail) {
          throw new Error('Test error');
        }
      }
    )
    const cronDO = new CronDurableObject(
      mockState as DurableObjectState, 
      { defaultHandler: errorHandler as unknown as TaskHandler<TestData> }
    )
    await cronDO.alarm()

    expect(errorHandler.mock.calls[0][0]).toEqual(errorTask)
    const putCalls = (mockStorage.put as Mock).mock.calls as Array<[string, ScheduledTask<TestData> | { error: string; task: ScheduledTask<TestData>; timestamp: number; stack?: string }]>
    
    const errorStorageCalls = putCalls.filter(
        (call): call is [string, { error: string; task: ScheduledTask<TestData>; timestamp: number; stack?: string }] => 
        typeof call[0] === 'string' && call[0].startsWith(`error:${errorTask.id}:`)
    )
    expect(errorStorageCalls.length).toBeGreaterThan(0)
    expect(errorStorageCalls[0][1].error).toBe('Error: Test error')

    const taskUpdateCall = putCalls.find(
        (call): call is [string, ScheduledTask<TestData>] => call[0] === `task:${errorTask.id}`
    )
    expect(taskUpdateCall).toBeDefined()
    if (taskUpdateCall) {
      const updatedData = taskUpdateCall[1].data as TestData;
      expect(updatedData._errors).toBe(1)
      expect(updatedData._lastError).toBe('Error: Test error')
    }
    expect(mockStorage.setAlarm).toHaveBeenCalled()
  })

  it('cancels a scheduled task', async () => {
    (mockStorage.delete as Mock).mockResolvedValueOnce(true)
    const cronDO = new CronDurableObject(
        mockState as DurableObjectState, 
        {}
    )
    const result = await cronDO.cancel('task-to-cancel')
    expect(result).toBe(true)
    expect(mockStorage.delete).toHaveBeenCalledWith('task:task-to-cancel')
    expect(mockStorage.setAlarm).toHaveBeenCalled()
  })
})
