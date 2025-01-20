import * as iris from '@iris-events/iris'
import { Logger, UseFilters } from '@nestjs/common'
import {
  BaseRpcContext,
  type CustomTransportStrategy,
  MessagePattern,
  Server,
} from '@nestjs/microservices'
import type { ConsumeMessage } from 'amqplib'
import type {
  DiscoveredProcessMessageHandlerMetadataI,
  Fn,
  IrisOptionsI,
} from './interfaces'
import { AmqpMessageParam, MDCParam, MessageParam } from './iris.decorators'
import { IrisDiscovery } from './iris.discovery'
import { PropagadeRpcExceptionFilterInstance } from './nest-rpc.error'
import { describeHandler } from './util'

export class IrisContext extends BaseRpcContext<Record<string, any>> {}

export class IrisServer extends Server implements CustomTransportStrategy {
  protected handlers: DiscoveredProcessMessageHandlerMetadataI[]
  protected readonly TAG = IrisServer.name

  constructor(
    protected readonly discovery: IrisDiscovery,
    protected readonly logger: Logger,
    protected readonly options?: IrisOptionsI,
  ) {
    super()

    this.handlers = this.discovery.findIrisHandlers()
    this.decorateHandlers()
  }

  async listen(
    callback: (err?: unknown, ...optionalParams: unknown[]) => void,
  ): Promise<void> {
    this.logger.debug(this.TAG, 'listen()')
    this.start()
      .then(() => callback())
      .catch((err) => callback(err))
  }

  async close(): Promise<void> {
    if (!iris.connection.isDisconnected()) {
      this.logger.log(this.TAG, 'Closing AMQP connection.')
      await iris.connection.disconnect()
    }
  }

  async start(): Promise<void> {
    await iris.connection.connect(
      this.options ?? {
        urlOrOpts: 'amqp://localhost',
      },
    )

    await iris.registerProcessed.register(
      iris.collectProcessedMessages(),
      this.handlers.map(({ meta }) => meta),
    )
  }

  protected decorateHandlers(): void {
    this.autoDecorateKnownHandlerArguments(this.handlers)
    this.decorateMessageHandlers(this.handlers)
  }

  /**
   * Decorate all arguments found in the handlers that relate
   * to classes Message/AmqpMessage classes with
   * @Message/@AmqpMessage param decoratros
   */
  private autoDecorateKnownHandlerArguments(
    messageHandlers: DiscoveredProcessMessageHandlerMetadataI[],
  ): void {
    for (const handler of messageHandlers) {
      const { meta } = handler
      const handlerClass = <Fn>handler.instanceWrapper.token
      const target = handlerClass.prototype
      const propertyKey = meta.methodName
      const methodArgs = <Fn[]>(
        Reflect.getMetadata('design:paramtypes', target, propertyKey)
      )

      for (let pos = 0; pos < methodArgs.length; pos++) {
        const arg = methodArgs[pos]

        if (iris.isMessageDecoratedClass(arg)) {
          const msgMeta = iris.getMessageDecoratedClass(arg)
          MessageParam(msgMeta)(target, propertyKey, pos)
        } else if (iris.paramDecorators.isAmqpMessageClass(arg)) {
          AmqpMessageParam()(target, propertyKey, pos)
        } else if (iris.mdc.isMDCClass(arg)) {
          MDCParam()(target, propertyKey, pos)
        }
      }
    }
  }

  /**
   * Decorate all message handlers with
   *  - `MessagePattern`
   *     so that they are registered and available via `this.getHandlers()`
   *  - `UseFilters(PropagatedExceptionFilter)`
   *     so that errors thrown by handlers are propagated to the iris module
   *     and not handled by Nest's exception filter
   */
  private decorateMessageHandlers(
    messageHandlers: DiscoveredProcessMessageHandlerMetadataI[],
  ): void {
    for (const handler of messageHandlers) {
      const { meta } = handler
      const instance = handler.instanceWrapper.instance

      if (meta.isStaticMethod) {
        this.logger.error(
          this.TAG,
          `Static method can not be a message handler: ${describeHandler(
            meta,
          )}`,
        )
        throw new Error('IRIS_STATIC_METHOD_MESSAGE_HANDLER_FOUND')
      }

      const pattern = this.getHandlerPatternForExchange(meta)

      this.logger.debug(
        this.TAG,
        `Decorating ${describeHandler(meta)} handler (pattern = ${pattern})`,
      )

      MessagePattern(pattern)(instance, meta.methodName, meta.descriptor)
      UseFilters(PropagadeRpcExceptionFilterInstance)(
        instance,
        meta.methodName,
        meta.descriptor,
      )

      // intercept messages and consume them via decorated handlers
      // in order to support Nest's pipeline
      meta.callback = async (ctx: unknown) =>
        await this.handleIrisEvent(<ConsumeMessage>ctx)
    }
  }

  private async handleIrisEvent(ctx: ConsumeMessage): Promise<unknown> {
    const pattern = ctx.fields.consumerTag
    const handler = this.getHandlerByPattern(pattern)

    if (handler == null) {
      this.logger.error(this.TAG, `No handler found for ${pattern}`)
      throw new Error('IRIS_NO_HANDLER_FOUND')
    }

    this.logger.debug(this.TAG, `Handling event for ${pattern}`)
    return new Promise((resolve, reject) => {
      this.transformToObservable(handler(ctx, new IrisContext(ctx))).subscribe({
        next: (resp) => resolve(resp),
        error: (err) => reject(err),
      })
    })
  }

  protected getHandlerPatternForExchange(
    handlerMeta: iris.ProcessedMessageHandlerMetadataI,
  ): string {
    return iris.consume.getConsumerTag(
      iris.getProcessedMessageDecoratedClass(handlerMeta.messageClass),
      handlerMeta,
    )
  }
}
