import { Global, Module } from '@nestjs/common'
import type { DynamicModule } from '@nestjs/common/interfaces'
import type { IrisOptionsI } from '../interfaces'

import { IrisModule } from '../iris.module'
import { IrisTestServer } from './iris.test-server'

@Global()
@Module({})
// @ts-expect-error this forRoot method has extra arg..
export class IrisTestModule extends IrisModule {
  protected readonly TAG = IrisTestModule.name

  constructor(protected readonly server: IrisTestServer<unknown>) {
    super(server)
  }

  /**
   * Same as IrisModule.forRoot, but using IrisTestServer instead of IrisServer
   *
   * @param mockFn a spy factory like `vi.fn`, `jest.fn`
   *
   * @example usage:
   * ```js
   *  @Module({
   *    imports: [
   *      IrisTestModule.forRoot(
   *        {
   *         ...
   *        },
   *        vi.fn
   *      )
   *    ]
   *  })
   *  class MyModlue {}
   *
   *  await publish.getPublisher(MyMessage)({ msg: 'hello' })
   *
   *  expect(
   *    app.get(IrisTestServer).getSpyForMessage(MyMessage)
   *  ).toHaveBeenCalledTimes(1)
   *
   * ```
   */
  static forRoot(
    options: IrisOptionsI,
    mockFn: () => (...args: unknown[]) => unknown,
  ): DynamicModule {
    IrisTestServer.setMockFn(mockFn)

    // @ts-expect-error this forRoot method has extra arg..
    return IrisTestModule._forRoot(options, IrisTestServer, IrisTestModule)
  }
}
