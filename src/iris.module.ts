import * as iris from '@iris-events/iris'
import { Global, Logger, Module } from '@nestjs/common'
import type {
  DynamicModule,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common/interfaces'
import { DiscoveryModule } from '@nestjs/core'
import type { IrisOptionsI } from './interfaces'
import { IrisDiscovery } from './iris.discovery'
import { IrisServer } from './iris.server'

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [IrisDiscovery],
  exports: [IrisDiscovery],
})
export class IrisModule
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  protected readonly TAG = IrisModule.name

  constructor(
    protected readonly server: IrisServer,
    protected readonly logger: Logger,
  ) {}

  static forRoot(config: IrisOptionsI): DynamicModule {
    return IrisModule._forRoot(config)
  }

  protected static _forRoot(
    config: IrisOptionsI,
    server: typeof IrisServer = IrisServer,
    mod: typeof IrisModule = IrisModule,
  ): DynamicModule {
    IrisModule.registerOptions(config)

    return {
      module: mod,
      providers: [
        config.logger || Logger,
        {
          provide: server,
          inject: [IrisDiscovery, Logger],
          useFactory: (discovery: IrisDiscovery, logger: Logger) =>
            new server(discovery, logger, config),
        },
      ],
    }
  }

  async onApplicationBootstrap() {
    this.logger.log(this.TAG, 'Connecting to amqp')
    return new Promise<void>((resolve, reject) => {
      this.server.listen((err) => (err !== undefined ? reject(err) : resolve()))
    })
  }

  async onApplicationShutdown() {
    this.logger.log(this.TAG, 'Disconnecting from amqp')
    await this.server.close()
  }

  static registerOptions(options: IrisOptionsI) {
    iris.helper.setServiceName(
      options.serviceName ?? process.env.npm_package_name ?? 'unknown-service',
    )

    iris.validation.validationClass.setDefaultValidationOptions(
      options.defaultValidationOptions,
    )
  }
}
