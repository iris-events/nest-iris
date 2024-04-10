import type * as iris from '@iris-events/iris'

export function describeHandler(
  handler: iris.ProcessedMessageHandlerMetadataI,
): string {
  const msg = (<{ name?: string }>handler.messageClass)?.name ?? 'n/a'
  return `${handler.methodName}(${msg})`
}
