import { logger } from '@iris-events/iris'
import { ConsoleLogger, LogLevel } from '@nestjs/common'

export class Logger extends ConsoleLogger implements logger.LoggerI {
  debug(ctx: string, message: string, additional?: any): void {
    this.doLog('debug', ctx, message, additional)
  }
  log(ctx: string, message: string, additional?: any): void {
    this.doLog('log', ctx, message, additional)
  }
  warn(ctx: string, message: string, additional?: any): void {
    this.doLog('warn', ctx, message, additional)
  }
  error(ctx: string, message: string, additional?: any): void {
    this.doLog('error', ctx, message, additional)
  }

  doLog(level: LogLevel, ctx: string, message: string, additional?: any): void {
    if (additional) {
      super[level](message, additional, ctx)
    } else {
      super[level](message, ctx)
    }
  }
}

export default new Logger()
