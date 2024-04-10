import * as iris from '@iris-events/iris'
import { Injectable, Logger } from '@nestjs/common'
import type { InjectionToken } from '@nestjs/common/interfaces'
import { DiscoveryService } from '@nestjs/core'
import type * as ifaces from './interfaces'
import { describeHandler } from './util'

@Injectable()
export class IrisDiscovery {
  protected readonly TAG = 'IrisDiscovery'
  protected readonly logger = new Logger()

  constructor(private readonly discover: DiscoveryService) {}

  findIrisHandlers(): ifaces.DiscoveredProcessMessageHandlerMetadataI[] {
    return this.discover
      .getControllers()
      .filter(
        ({ token }) =>
          token instanceof Function &&
          iris.hasMessageHandlerDecoratedMethods(token),
      )
      .reduce(
        (acc, instanceWrapper) => {
          const { token, name } = instanceWrapper
          if (!acc.registeredWrappers.includes(token)) {
            const handlers =
              iris.getProcessedMessageHandlerDecoratedMethods(token)
            this.logger.debug(
              this.TAG,
              `registering handlers: ${name}( ${handlers.map(
                describeHandler,
              )} )`,
            )
            acc.registeredWrappers.push(token)
            acc.handlers.push(
              ...handlers.map((meta) => ({ meta, instanceWrapper })),
            )
          }

          return acc
        },
        <
          {
            handlers: ifaces.DiscoveredProcessMessageHandlerMetadataI[]
            registeredWrappers: InjectionToken[]
          }
        >{
          handlers: [],
          registeredWrappers: [],
        },
      ).handlers
  }
}
