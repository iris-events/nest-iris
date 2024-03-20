import { errors, integration } from '@iris-events/iris'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import logger from './logger'

integration.update({
  customLoggerInstance: logger,
  rejectableErrors: [
    {
      errorClass: UnauthorizedException,
      errorType: errors.ErrorTypeE.UNAUTHORIZED,
      alwaysNotifyClient: true,
    },
    {
      errorClass: ForbiddenException,
      errorType: errors.ErrorTypeE.FORBIDDEN,
      alwaysNotifyClient: true,
    },
    {
      errorClass: RpcException,
      errorType: errors.ErrorTypeE.INTERNAL_SERVER_ERROR,
      alwaysNotifyClient: true,
    },
  ],
})
