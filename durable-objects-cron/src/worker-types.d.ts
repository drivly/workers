declare global {
  interface Env {
    // Example: Replace with your actual bindings
    MY_KV_NAMESPACE: KVNamespace;
    // Add other bindings here as needed, e.g.:
    // MY_DO_BINDING: DurableObjectNamespace;
    // MY_SECRET_VAR: string;
  }
}

export {}
