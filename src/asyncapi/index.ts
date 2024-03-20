import { AsyncapiSchema, DocumentBuilder } from '@iris-events/iris/asyncapi'
import { NestApplicationOptions } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { IrisDiscovery, collectProcessedMessages } from '..'

export * from '@iris-events/iris/asyncapi'

export const SCHEMA_POINTER_PREFIX = '#/components/schemas/'

export interface GenerateAsyncapiOptsI {
  id?: string
  name?: string
  description?: string
  version?: string
}

export async function generateAsyncapiDocument(
  nestModuleClass: any,
  docOrOpts?: GenerateAsyncapiOptsI | DocumentBuilder,
  opts?: NestApplicationOptions,
) {
  const asyncapiSchema = await getAsyncapiSchema(nestModuleClass, opts)

  const document =
    docOrOpts instanceof DocumentBuilder
      ? docOrOpts.build()
      : getDocumentBuilder(docOrOpts).build()

  return {
    ...document,
    components: {
      schemas: asyncapiSchema.getSchemas(),
    },
    channels: asyncapiSchema.getChannels(),
  }
}

export async function getAsyncapiSchema(
  nestModuleClass: any,
  opts?: NestApplicationOptions,
): Promise<AsyncapiSchema> {
  const moduleRef = await NestFactory.createApplicationContext(
    nestModuleClass,
    {
      bufferLogs: true,
      ...opts,
    },
  )

  const handlers = moduleRef
    .get(IrisDiscovery)
    .findIrisHandlers()
    .map(({ meta }) => meta)

  return new AsyncapiSchema({
    SCHEMA_POINTER_PREFIX,
    messages: collectProcessedMessages(),
    messageHandlers: handlers,
  })
}

function getDocumentBuilder(opts?: GenerateAsyncapiOptsI) {
  const name = opts?.name ?? process.env.npm_package_name ?? 'n/a'

  return new DocumentBuilder()
    .setId(opts?.id ?? `urn:id:${name}`)
    .setTitle(name)
    .setDescription(
      opts?.description ?? process.env.npm_package_description ?? 'n/a',
    )
    .setVersion(opts?.version ?? process.env.npm_package_version ?? 'n/a')
}
