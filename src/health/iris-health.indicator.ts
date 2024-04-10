import { Injectable } from '@nestjs/common'
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus'
import { connection } from '..'

@Injectable()
export class IrisHealthIndicator extends HealthIndicator {
  isHealthy(key = 'iris'): HealthIndicatorResult {
    const isReconnecting = connection.isReconnecting()

    if (isReconnecting || connection.isDisconnected()) {
      const message = isReconnecting ? 'Reconnecting' : 'Disconnected'

      throw new HealthCheckError(
        'Iris check failed',
        this.getStatus(key, false, { message }),
      )
    }
    return this.getStatus(key, true)
  }
}
