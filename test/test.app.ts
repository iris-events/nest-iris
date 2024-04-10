import {
  type DynamicModule,
  type ForwardReference,
  type INestApplication,
  Module,
  Logger as NestLogger,
  type Provider,
  type Type,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { type IrisOptionsI, flags, logging } from '../src'
import { IrisTestModule, IrisTestServer } from '../src/testing'

flags.ALLOW_USING_RESERVED_NAMES = true

export type TestAppModuleOptsI = {
  irisOpts?: Partial<IrisOptionsI>
  providers?: Provider[]
  controllers?: Type<any>[]
  envOpts?: Record<string, string | number>
  imports?: (
    | Type<unknown>
    | DynamicModule
    | Promise<DynamicModule>
    | ForwardReference
  )[]
}

export async function getTestApp(
  opts: TestAppModuleOptsI,
): Promise<INestApplication> {
  NestLogger.overrideLogger([])
  logging.default.setLogLevels([])

  const moduleRef = await Test.createTestingModule({
    imports: [getModule(opts)],
  }).compile()

  const app = moduleRef.createNestApplication()

  app.connectMicroservice({
    strategy: app.get(IrisTestServer),
  })

  return await app.init()
}

export function getModule(opts: TestAppModuleOptsI): Type<unknown> {
  @Module({
    imports: [
      ...(opts.imports ?? []),
      IrisTestModule.forRoot(
        {
          urlOrOpts: <string>process.env.AMQP_URL,
          serviceName: process.env.SERVICE_NAME,
          ...opts.irisOpts,
        },
        vi.fn,
      ),
    ],
    controllers: opts.controllers ?? [],
    providers: opts.providers ?? [],
  })
  class AppModule {}

  return AppModule
}
