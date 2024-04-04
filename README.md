# IRIS NestJS module


NestJS package for IRIS framework.

Install: `npm i @iris-events/nestjs-iris`


## NestJS module setup

```ts
  import { IrisModule } from '@iris-events/nestjs-iris'

  @Module({
    imports: [
      IrisModule.forConfig({
        urlOrOpts: 'amqp://guest:guest@localhost:5672'
        ...
      }),
      ...
    ],
    ...
  })
  class AppModule {}
```

<details>
  <summary><b>Options interface</b></summary>

  ```ts
    // configuration interface for IrisModule:
    interface IrisOptionsI {
      // default is `npm_package_name`
      serviceName?: string

      // AMQP Connection options
      urlOrOpts: string | {
        protocol?: string
        hostname?: string
        port?: number | string
        username?: string
        password?: string
        locale?: string
        frameMax?: number
        heartbeat?: number
        vhost?: string
      }

      /**
       * Passed to amqplib, see amqplib doc for more info
       */
      socketOptions?: any

      /**
       * How many times should iris try to reconnect when connection drops
       * setting to 0 or less means do not try to reconnect
       */
      reconnectTries: number

      /**
       * Reconnect interval
       */

      reconnectInterval: number

      /**
       * Multiply factor for reconnectInterval for each next time if reconnecting fails
       */
      reconnectFactor: number

      /**
       * When error occures during event processing, event is re-enqueued.
       * This setting specifies how many times should a single event be re-enqueued
       * before marked as failed.
       */
      maxMessageRetryCount: number


      // Global setting for message validation. Can be set per message via @Message decorator
      defaultValidationOptions?: {
        // Objects (messages) are transformed to corresponding classes before publishing
        // and when received using class transformer module.
        // See https://github.com/typestack/class-transformer for more info
        classTransform?: classTransformer.ClassTransformOptions

        // If false, object will not be validated against the decorated @Message class
        // structure, neither when publishing nor when received
        validate?: boolean | classValidator.ValidatorOptions
      }
    }

  ```
</details>
<br>
<br>

## Decorators

### @Message(config: MessageI, validationOptions?: ValidationOptions)

<details>
  <summary><b>Message config interface</b></summary>

  ```ts
  interface MessageI {
    /**
     * Name of exchange
     */
    name: string
    /**
     * Defaults to `fanout`
     */
    exchangeType?: ExchangeType
    routingKey?: string
    scope?: Scope
    ttl?: number
    deadLetter?: string
    /**
     * Max times this message should be sent to retry queue
     * before considered unhandled. Overrides default from
     * connection configuration.
     */
    maxRetry?: number
  }

  ```
</details>

Class decorator, representing a specific message.
[Class transformer](https://github.com/typestack/class-transformer) and
[class validator](https://github.com/typestack/class-validator) are used to
transform objects to decorated classes.

Validation of messages and transformer options can be set globally via config or
per message as a second argument with `@Message` decorator.

```ts

@Message({ name: 'foo' })
class Foo {
  @IsString() foo!: string
}
```

<br>
<br>

### @MessageHandler(config?: MessageHandlerI, returnMessageType?: @Message())

<details>
  <summary><b>Handler config interface</b></summary>

  ```ts
  interface MessageHandlerI {
    bindingKeys?: string[] | string
    /**
     * If true, the queue will survive broker restarts (defaults to true)
     */
    durable?: boolean
    /**
     * If true, the queue will be deleted when the number of consumers drops to zero
     * (defaults to false)
     */
    autoDelete?: boolean
    /**
     * Amount of messages that can be received on queue at same time.
     * Set it to some low number (like 1) for events causing a long/resource heavy
     * tasks.
     */
    prefetch?: number
    messageDeliveryMode?: MessageDeliveryMode
  }
  ```

</details>

Method decorator handling specific `@Message` events. *Method must accept exactly one argument of class decorated with `@Message`.*

Special argument classes:
- any class decorated with @Message() can be used within the handler without any extra argument decorators.
- a `AmqpMessage` class can be used to retrieve original Amqp message within the Handler
- a `MDC` class can be used to retrieve an object with common "mdc" properties (usefull for logging compatible with Java IRIS counterparts)


If handler returns a result, it is treated as a produced message and is published if `returnMessageType` is specified for handler.

- Minimal handler requirement
```ts

class Handler {

  @MessageHandler()
  handleFoo(foo: Foo): void {}

}
```

- Special arguments and custom decorators
```ts

// custom param decorator
const MsgHeaderExtractorParam = createParamDecorator<
  string,
  ExecutionContext,
  string | undefined
>((header, ctx): string => {
  const msg = ctx.switchToRpc().getData<AmqpMessage>()

  return <string>msg.properties.headers![header]
})

class Handler {

  @MessageHandler()
  handleFoo(
    // original Amqp message
    // holds
    // {
    //   content: Buffer
    //   fields: amqplib.ConsumeMessageFields
    //   properties: amqplib.MessageProperties
    // }
    amqpMessage: AmqpMessage,
    // holds 
    // {
    //   sessionId?: string
    //   userId?: string
    //   clientTraceId?: string
    //   correlationId?: string
    //   eventType?: string
    //   clientVersion?: string
    // }
    mdc: MDC,
    // event we're handling
    foo: Foo,

    // custom arguments
    @MsgHeaderExtractorParam('x-y') xyHeader: string,
  ): void {}

}
```

- Handler produces another message
```ts
@Message({ name: 'bar' })
class Bar {
  @IsString() bar!: string
}

class Handler {

  // Type of returned message needs to be specified as a second argument
  // of decorator
  @MessageHandler({}, Bar)
  handleFoo(foo: Foo): Bar {
    return { bar: 'bar bar' }
  }

}
```
<br>
<br>

### @SnapshotMessageHandler(config?: SnapshotMessageHandlerI)

<details>
  <summary><b>Snapshot handler config interface</b></summary>

  ```ts
  interface SnapshotMessageHandlerI {
    resourceType: string
    prefetch?: number
  }
  ```
</details>



Method decorator handling `SnapshotRequested` messages. Each resourceType should
have its own handler.

```ts

class Handler {

  @SnapshotMessageHandler({ resourceType: 'foo' }, ResourceMessage)
  handleFooSnapshotRequest(evt: SnapshotRequested): ResourceMessage {
    return {
      ...evt,
      payload: { foo model for evt.resourceId }
    }
  }

  @SnapshotMessageHandler({ resourceType: 'bar' }, ResourceMessage)
  handleFooSnapshotRequest(evt: SnapshotRequested): ResourceMessage {
    return {
      ...evt,
      payload: { bar model for evt.resourceId }
    }
  }
}
```

## Health Indicator

IRIS module provides `IrisHealthModule` and `IrisHealthIndicator` which can be used with `@nestjs/terminus` module.

## Testing

`IrisTestModule` can be used to register IRIS module for testing. This will replace the default [IrisServer](src/iris.server.ts) with [IrisTesstServer](src/testing/iris.test-server.ts), which provides testing utilities:
- clearQueues()
- getSpyForHandlder(<handler class>, <handler method>)
- getIrisHandlers()
- getIrisHandlerMetas()

`testing` submodule also exports whole testing submodule from `@iris-events/iris/testing` submodule as `irisTesting`.

```ts
  import { IrisTestModule, irisTesting } from '@iris-events/nestjs-iris/testing'

  // configure within NestJS test module
  IrisTestModule.forConfig(
    {
      urlOrOpts: 'amqp://guest:guest@localhost:5672'
      ...
    },
    // mock function
    vi.fn() // or jest.fn etc
  )


  // get IrisTestServer instance
  const testServer = app.get(IrisTestServer).getSpyForMessage(MyMessage)

  const spy = testServer.getSpyForHandlder(MyHandler, 'handleFoo')

  // access @iris-events/testing utilities
  irisTesting.utilities.deleteExchange(...)
  irisTesting.utilities.requestSnapshot(...)
  irisTesting.utilities.subscribe(...)
  irisTesting.utilities.publishToFrontend(...)

```

## Examples
See [examples](examples) and [tests](test/e2e) folders for additional info. Example application can be run using `npm run example`

<details>
  <summary>Example</summary>

  ```ts
  import { Controller, Logger, Module } from '@nestjs/common'
  import { NestFactory } from '@nestjs/core'
  import { IsNumber, IsString } from 'class-validator'
  import {
    IrisModule,
    IrisServer,
    Message,
    MessageHandler,
    publish,
  } from '@iris-events/nestjs-iris'

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

  ```


</details>

