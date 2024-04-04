import { INestApplication } from '@nestjs/common'
import { HealthCheckError } from '@nestjs/terminus'
import { IrisHealthIndicator, connection } from '../../src'
import { getTestApp } from '../test.app'

describe('Health indicator', () => {
  let healthIndicator: IrisHealthIndicator
  let app: INestApplication

  beforeAll(async () => {
    app = await getTestApp({
      providers: [IrisHealthIndicator],
    })

    healthIndicator = app.get(IrisHealthIndicator)
  })

  afterAll(async () => {
    await app.close()
  })

  test('Health indicator should indicate whether iris is connected, reconnecting or disconnected', async () => {
    expect(healthIndicator.isHealthy()).toEqual({ iris: { status: 'up' } })

    await connection.disconnect()

    expect(() => healthIndicator.isHealthy()).toThrowError(HealthCheckError)
  })
})
