import { randomUUID } from 'node:crypto'
import { Controller } from '@nestjs/common'
import { IsString } from 'class-validator'
import type { MockInstance } from 'vitest'
import { Message, MessageHandler, publish } from '../../src'
import { IrisTestServer } from '../../src/testing'
import { MsgHeaderExtractorParam } from '../decorators'
import { getTestApp } from '../test.app'

@Message({ name: 'parm-decorators-foo' })
class Foo {
  @IsString() name!: string
}

@Controller()
class Handler {
  @MessageHandler()
  async handleFoo(
    @MsgHeaderExtractorParam('x-y') _xyHeader: string,
    _evt: Foo,
  ): Promise<void> {}
}

describe('Custom param decorators', () => {
  let testServer: IrisTestServer<MockInstance>

  beforeAll(async () => {
    const app = await getTestApp({
      controllers: [Handler],
    })

    testServer = app.get(IrisTestServer<MockInstance>)
  })

  afterEach(async () => {
    await testServer.clearQueues(false)
  })

  afterAll(async () => {
    await testServer.clearQueues(true)
  })

  test('Custom param decorators should work', async () => {
    const xyHeaderVal = randomUUID()

    await publish.getPublisher(Foo)(
      { name: 'foo_evt' },
      {
        amqpPublishOpts: {
          headers: {
            'x-y': xyHeaderVal,
          },
        },
      },
    )

    await vi.waitFor(() => {
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenCalledTimes(1)
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenNthCalledWith(1, xyHeaderVal, {
        name: 'foo_evt',
      })
    })
  })
})
