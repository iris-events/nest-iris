import { randomUUID } from 'node:crypto'
import { Controller, UseGuards } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { IsEnum, IsString } from 'class-validator'
import type { MockInstance } from 'vitest'
import { constants, Message, MessageHandler, errors, publish } from '../../src'
import { IrisTestServer } from '../../src/testing'
import { getTestApp } from '../test.app'

import { AuthGuard, JwtSubject, Public } from '../decorators'

@Message({ name: 'decorators-foo' })
class Foo {
  @IsString() name!: string
}

@Message({ name: 'decorators-bar' })
class Bar {
  @IsString() name!: string
}

@Controller()
@UseGuards(AuthGuard)
class Handler {
  @MessageHandler()
  async handleFoo(_evt: Foo, @JwtSubject() _sub: string): Promise<void> {}

  @Public()
  @MessageHandler()
  async handleBar(_evt: Bar): Promise<void> {}
}

/**
 * Event to subscribe to `error` exchange in order to get reported errors
 */
@Message({
  name: constants.MANAGED_EXCHANGES.ERROR.EXCHANGE,
  exchangeType: constants.MANAGED_EXCHANGES.ERROR.EXCHANGE_TYPE,
})
class ErrorEvt implements errors.ErrorMessageI {
  @IsEnum(errors.ErrorTypeE) errorType!: errors.ErrorTypeE
  @IsString() code!: string
  @IsString() message!: string
}

@Controller()
class ErrHandler {
  @MessageHandler({ bindingKeys: '#' })
  handleError(_evt: ErrorEvt): void {}
}

describe('Custom param decorators', () => {
  let testServer: IrisTestServer<MockInstance>
  let jwtService: JwtService

  beforeAll(async () => {
    const app = await getTestApp({
      imports: [JwtModule.register({ secret: 'secret' })],
      controllers: [Handler, ErrHandler],
    })

    testServer = app.get(IrisTestServer<MockInstance>)
    jwtService = app.get(JwtService)
  })

  afterEach(async () => {
    await testServer.clearQueues(false)
  })

  afterAll(async () => {
    await testServer.clearQueues(true)
  })

  test('Custom guard for handler class should be applied to all handler methods', async () => {
    const sub = randomUUID()
    const fooEvt = `foo_evt_${randomUUID()}`
    const barEvt = `bar_evt_${randomUUID()}`

    await publish.getPublisher(Foo)(
      { name: fooEvt },
      {
        amqpPublishOpts: {
          headers: {
            [constants.MESSAGE_HEADERS.MESSAGE.JWT]: jwtService.sign({ sub }),
          },
        },
      },
    )
    await publish.getPublisher(Bar)({ name: barEvt })

    await vi.waitFor(() => {
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenCalledTimes(1)
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenCalledWith(
        {
          name: fooEvt,
        },
        sub,
      )
      expect(
        testServer.getSpyForHandler(Handler, 'handleBar'),
      ).toHaveBeenCalledTimes(1)
      expect(
        testServer.getSpyForHandler(Handler, 'handleBar'),
      ).toHaveBeenCalledWith({
        name: barEvt,
      })
    })
  })

  test('Guard error should be sent to retry queue and handler should not be called', async () => {
    const sub = randomUUID()
    const fooEvt = `foo_evt_${randomUUID()}`

    await publish.getPublisher(Foo)(
      { name: fooEvt },
      {
        amqpPublishOpts: {
          headers: {
            [constants.MESSAGE_HEADERS.MESSAGE.JWT]: jwtService.sign(
              { sub },
              { secret: randomUUID() },
            ),
          },
        },
      },
    )

    await vi.waitFor(() => {
      expect(
        testServer.getSpyForHandler(Handler, 'handleFoo'),
      ).toHaveBeenCalledTimes(0)
      expect(
        testServer.getSpyForHandler(ErrHandler, 'handleError'),
      ).toHaveBeenCalledTimes(1)
      expect(
        testServer.getSpyForHandler(ErrHandler, 'handleError'),
      ).toHaveBeenCalledWith({
        errorType: 'UNAUTHORIZED',
        code: 'UnauthorizedException',
        message: 'Unauthorized',
      })
    })
  })
})
