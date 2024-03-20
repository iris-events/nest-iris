import * as iris from '@iris-events/iris'
import { type ExecutionContext, createParamDecorator } from '@nestjs/common'
import type * as amqplib from 'amqplib'

/**
 * Use to get a @Message() decorated class representing the event msg
 */
export const MessageParam = createParamDecorator<
  iris.MessageMetadataI,
  ExecutionContext,
  any
>(async (msgMeta, ctx) => {
  const event =
    await iris.validation.validationClass.convertBufferToTargetClass(
      getAmqpMessageFromContext(ctx),
      msgMeta,
      iris.flags.DISABLE_MESSAGE_CONSUME_VALIDATION,
    )

  return event
})

/**
 * Use to get a full amqplib.Message object
 */
export const AmqpMessageParam = createParamDecorator<
  void,
  ExecutionContext,
  amqplib.ConsumeMessage
>((_data, ctx) => {
  return getAmqpMessageFromContext(ctx)
})

/**
 * Use to get a MDC context
 */
export const MDCParam = createParamDecorator<
  void,
  ExecutionContext,
  iris.mdc.MdcI
>((_data, ctx) => {
  return iris.mdc.amqpToMDC(getAmqpMessageFromContext(ctx))
})

const getAmqpMessageFromContext = (
  ctx: ExecutionContext,
): amqplib.ConsumeMessage =>
  ctx.switchToHttp().getRequest<amqplib.ConsumeMessage>()
