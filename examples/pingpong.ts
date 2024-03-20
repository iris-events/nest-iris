import { Controller, Logger, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { IsNumber, IsString } from 'class-validator'
import {
  IrisModule,
  IrisServer,
  Message,
  MessageHandler,
  publish,
} from '../src'

@Message({ name: 'ping' })
class Ping {
  @IsString() ping!: string
  @IsNumber() count!: number
}

@Message({ name: 'pong' })
class Pong {
  @IsString() pong!: string
  @IsNumber() count!: number
}

@Controller()
class PingController {
  private readonly logger = new Logger('PingController')

  @MessageHandler()
  async handlePing(msg: Ping) {
    this.logger.log('Received ping', msg.ping, msg.count)
    await this.sleep()
    publish.getPublisher(Pong)({ pong: 'pong', count: msg.count + 1 })
  }

  @MessageHandler(undefined, Ping)
  async handlePong(msg: Pong): Promise<Ping> {
    this.logger.log('Received pong', msg.pong, msg.count)
    await this.sleep()
    return { ping: 'ping', count: msg.count + 1 }
  }

  async sleep() {
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
}

@Module({
  imports: [
    IrisModule.forRoot({
      urlOrOpts: 'amqp://localhost',
    }),
  ],
  controllers: [PingController],
})
class App {}

async function start() {
  const app = await NestFactory.create(App)

  app.connectMicroservice({
    strategy: app.get(IrisServer),
  })

  await app.init()

  await publish.getPublisher(Ping)({ ping: 'ping', count: 0 })
}

start()
