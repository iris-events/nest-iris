import * as iris from '@iris-events/iris'
import { Logger, Provider } from '@nestjs/common'
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'

export type Fn = () => any

export interface DiscoveredProcessMessageHandlerMetadataI {
  meta: iris.ProcessedMessageHandlerMetadataI
  instanceWrapper: InstanceWrapper<Fn>
}

export type IrisOptionsI = iris.ConnectionConfigI & {
  // default is `npm_package_name`
  serviceName?: string

  // Default transformation and validation options.
  // Can be overwritten per @Message() class.
  defaultValidationOptions?: iris.validation.ValidationOptions

  // replace logger provider if needed
  logger?: typeof Logger | Provider
}
