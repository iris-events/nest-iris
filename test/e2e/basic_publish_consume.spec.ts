import { randomUUID } from 'node:crypto'
import { Controller, INestApplication } from '@nestjs/common'
import { IsString } from 'class-validator'
import type { MockInstance } from 'vitest'
import {
  AmqpMessage,
  ExchangeType,
  MDC,
  Message,
  MessageHandler,
  getProcessedMessageDecoratedClass,
  publish,
} from '../../src'
import { IrisTestServer } from '../../src/testing'
import { getTestApp } from '../test.app'

@Message({ name: 'foo' })
class Foo {
  @IsString() name!: string
}

@Message({ name: 'bar', exchangeType: ExchangeType.direct })
class Bar {
  @IsString() msg!: string
}

@Controller()
class Handler {
  @MessageHandler()
  async handleFoo(_evt: Foo, _amqp: AmqpMessage, _mdc: MDC): Promise<void> {}

  @MessageHandler({ bindingKeys: 'bar' })
  async handleBar(evt: Bar, amqpMsg: AmqpMessage): Promise<void> {
    await publish.publishReply(
      amqpMsg,
      Bar,
      { msg: `${evt.msg}_foo` },
      { routingKey: 'bar-foo' },
    )
  }

  @MessageHandler({ bindingKeys: 'bar-foo' })
  async handleBarFoo(_evt: Bar): Promise<void> {}
}

describe('Publish and Consume events', () => {
  let testServer: IrisTestServer<MockInstance>
  let app: INestApplication

  beforeAll(async () => {
    app = await getTestApp({
      controllers: [Handler],
    })

    testServer = app.get(IrisTestServer<MockInstance>)
  })

  afterEach(async () => {
    await testServer.clearQueues(false)
  })

  afterAll(async () => {
    await testServer.clearQueues(true)
    await app.close()
  })

  test('Each handler should receive its own events', async () => {
    const barMsg = randomUUID()
    const mdc: MDC = {
      sessionId: randomUUID(),
      userId: randomUUID(),
      clientTraceId: randomUUID(),
      correlationId: randomUUID(),
      eventType: randomUUID(),
      clientVersion: randomUUID(),
    }

    await publish.getPublisher(Foo)(
      { name: 'foo_evt' },
      {
        amqpPublishOpts: {
          correlationId: mdc.correlationId,
          headers: {
            'x-session-id': mdc.sessionId,
            'x-user-id': mdc.userId,
            'x-client-trace-id': mdc.clientTraceId,
            'x-correlation-id': mdc.correlationId,
            'x-event-type': mdc.eventType,
            'x-client-version': mdc.clientVersion,
          },
        },
      },
    )
    await publish.getPublisher(Foo)({ name: 'foo_evt2' })

    await publish.getPublisher(Bar)({ msg: 'bar' }, { routingKey: 'bar' })

    await new Promise((resolve) => setTimeout(resolve, 100))
    await publish.getPublisher(Bar)({ msg: barMsg }, { routingKey: 'bar-foo' })

    await vi.waitFor(() => {
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenCalledTimes(2)
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenNthCalledWith(
        1,
        {
          name: 'foo_evt',
        },
        expect.anything(),
        mdc,
      )
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenNthCalledWith(
        2,
        {
          name: 'foo_evt2',
        },
        expect.anything(),
        expect.objectContaining({
          eventType:
            getProcessedMessageDecoratedClass(Foo).processedConfig.exchangeName,
        }),
      )

      expect(
        testServer.getSpyForHandler(Handler, 'handleBar'),
      ).toHaveBeenCalledTimes(1)
      expect(
        testServer.getSpyForHandler(Handler, 'handleBar'),
      ).toHaveBeenNthCalledWith(
        1,
        {
          msg: 'bar',
        },
        expect.anything(),
      )

      expect(
        testServer.getSpyForHandler(Handler, 'handleBarFoo'),
      ).toHaveBeenCalledTimes(2)
      // this was published as a replpy to initial `bar` evt
      expect(
        testServer.getSpyForHandler(Handler, 'handleBarFoo'),
      ).toHaveBeenNthCalledWith(1, {
        msg: 'bar_foo',
      })
      // this was published in test above
      expect(
        testServer.getSpyForHandler(Handler, 'handleBarFoo'),
      ).toHaveBeenNthCalledWith(2, {
        msg: barMsg,
      })
    })
  })
})
