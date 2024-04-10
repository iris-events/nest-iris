import * as irisTesting from '@iris-events/iris/testing'
import { SetMetadata } from '@nestjs/common'
import { IrisServer } from '../iris.server'

/**
 * IrisServer intended for testing
 * allows for spying on handler methods which is otherwise
 * not directly supported by NestJS
 */
export class IrisTestServer<MockT> extends IrisServer {
  protected readonly TAG = IrisTestServer.name

  static handlerSpies: Map<string, (...args: unknown[]) => unknown> = new Map()
  static mockFn: () => (...args: unknown[]) => unknown

  static setMockFn(fn: () => (...args: unknown[]) => unknown) {
    IrisTestServer.mockFn = fn
  }

  protected decorateHandlers(): void {
    super.decorateHandlers()
    this.replaceHandlerCallbacks()
  }

  get handlerSpies() {
    return IrisTestServer.handlerSpies
  }

  getIrisHandlers() {
    return this.handlers
  }

  getIrisHandlerMetas() {
    return this.handlers.map((handler) => handler.meta)
  }

  async clearQueues(alsoDelete: boolean, allowReconnect = false) {
    return irisTesting.utilities.clearQueues(
      this.getIrisHandlerMetas(),
      alsoDelete,
      allowReconnect,
    )
  }

  /**
   * Returns a spy for a given message class
   */
  public getSpyForHandler<T, MockE = MockT>(
    handlerClass: new () => T,
    methodName: keyof T,
  ): MockE {
    const handler = this.handlers.find(
      (handler) =>
        handler.instanceWrapper.metatype === handlerClass &&
        handler.meta.methodName === methodName,
    )

    if (!handler) {
      throw new Error(
        `No @MessageHandler() handler available on ${handlerClass.name}.${<
          string
        >methodName}()`,
      )
    }

    const pattern = this.getHandlerPatternForExchange(handler.meta)

    return <MockE>this.handlerSpies.get(pattern)!
  }

  /**
   * Replaces all methods on handler's prototype
   * with anonymous methods which then proxy the
   * calls to dedicated spies and original handlers.
   */
  protected replaceHandlerCallbacks() {
    for (const handler of this.handlers) {
      const pattern = this.getHandlerPatternForExchange(handler.meta)

      if (!this.handlerSpies.has(pattern)) {
        this.handlerSpies.set(pattern, IrisTestServer.mockFn())
      }

      const spy = this.handlerSpies.get(pattern)

      const originalFn =
        handler.instanceWrapper.instance[handler.meta.methodName]

      handler.instanceWrapper.instance.constructor.prototype[
        handler.meta.methodName
      ] = async (...args: unknown[]) => {
        spy!.apply(spy, args)

        return await originalFn.apply(handler.instanceWrapper.instance, args)
      }

      const targetFn =
        handler.instanceWrapper.instance.constructor.prototype[
          handler.meta.methodName
        ]

      const keys = Reflect.getMetadataKeys(originalFn)

      for (const key of keys) {
        SetMetadata(key, Reflect.getMetadata(key, originalFn))(targetFn)
      }
    }
  }
}
