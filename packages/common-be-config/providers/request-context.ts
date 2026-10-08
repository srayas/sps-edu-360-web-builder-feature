// request-context.ts
import { AsyncLocalStorage } from 'async_hooks'

interface RequestContextData {
  rid?: string
  email?: string
  apiPath?: string
  ipAddress?: string
  userAgent?: string
}

export class RequestContext {
  private static storage = new AsyncLocalStorage<RequestContextData>()

  static run(data: RequestContextData, callback: () => void) {
    this.storage.run(data, callback)
  }

  static get(): RequestContextData | undefined {
    return this.storage.getStore()
  }

  static set(key: keyof RequestContextData, value: string) {
    const store = this.storage.getStore()
    if (store) {
      store[key] = value
    }
  }
}
