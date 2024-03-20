import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { IrisHealthIndicator } from './iris-health.indicator'

@Module({
  imports: [TerminusModule],
  providers: [IrisHealthIndicator],
  exports: [IrisHealthIndicator],
})
export class IrisHealthModule {}
