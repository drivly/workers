declare global {
  interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
  }

  interface DurableObjectId {}

  interface DurableObjectStub {
    fetch(request: RequestInfo, init?: RequestInit): Promise<Response>;
  }

  interface DurableObjectState {
    storage: DurableObjectStorage;
  }

  interface DurableObjectStorage {
    sql: {
      exec(query: string, ...params: any[]): {
        next(): { done: boolean; value?: any };
      };
    };
  }
}

export {};
