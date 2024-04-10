import { HealthCheckError } from '@nestjs/terminus'
import { IrisHealthIndicator, connection } from '../../src'
import { getTestApp } from '../test.app'

describe('Health indicator', () => {
  let healthIndicator: IrisHealthIndicator

  beforeAll(async () => {
    const app = await getTestApp({
      providers: [IrisHealthIndicator],
    })

    healthIndicator = app.get(IrisHealthIndicator)
  })

  test('Health indicator should indicate whether iris is connected, reconnecting or disconnected', async () => {
    expect(healthIndicator.isHealthy()).toEqual({ iris: { status: 'up' } })

    await connection.disconnect()

    expect(() => healthIndicator.isHealthy()).toThrowError(HealthCheckError)
  })
})
