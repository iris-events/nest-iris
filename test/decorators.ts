import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import _ from 'lodash'
import { constants, type AmqpMessage, type IrisContext } from '../src'

const JWT_SECRET = 'secret'
const IS_PUBLIC_KEY = 'is-public'
const JWT_PAYLOAD_KEY = 'jwtPayload'

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const ctx = context.switchToRpc().getContext()

    const amqpMsg = context.switchToRpc().getData<AmqpMessage>()
    const jwt = _.get(
      amqpMsg,
      `properties.headers[${constants.MESSAGE_HEADERS.MESSAGE.JWT}]`,
    )

    if (typeof jwt !== 'string') {
      throw new UnauthorizedException()
    }

    try {
      const payload = await this.jwtService.verifyAsync(jwt, {
        secret: JWT_SECRET,
      })

      ctx[JWT_PAYLOAD_KEY] = payload
    } catch {
      throw new UnauthorizedException()
    }

    return true
  }
}

export const JwtSubject = createParamDecorator<
  undefined,
  ExecutionContext,
  string | undefined
>((__, ctx) =>
  _.get(ctx.switchToRpc().getContext<IrisContext>(), `${JWT_PAYLOAD_KEY}.sub`),
)

export const MsgHeaderExtractorParam = createParamDecorator<
  string,
  ExecutionContext,
  string | undefined
>((header, ctx): string => {
  const msg = ctx.switchToRpc().getData<AmqpMessage>()

  return <string>msg.properties.headers![header]
})
