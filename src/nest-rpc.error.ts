import { Catch } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common/interfaces'

import {
  BaseRpcExceptionFilter,
  type RpcException,
} from '@nestjs/microservices'
import { throwError } from 'rxjs'

@Catch()
export class PropagadeRpcExceptionFilter extends BaseRpcExceptionFilter {
  catch(exception: RpcException, _host: ArgumentsHost) {
    return throwError(() => exception)
  }
}

export const PropagadeRpcExceptionFilterInstance =
  new PropagadeRpcExceptionFilter()
