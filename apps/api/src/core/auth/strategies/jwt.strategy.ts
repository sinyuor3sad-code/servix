import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../shared/types';
import { CacheService } from '../../../shared/cache/cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') || '',
    });
  }

  // V-14a: revocation gate. Mirrors the WS guard exactly — if the
  // user's password (or any equivalent "force-logout" event) changed
  // after the token was issued, reject the request.
  //
  // Compare units carefully: `iat` is unix seconds (JWT spec),
  // `getPasswordChangedAt` returns unix milliseconds (what we wrote
  // in setPasswordChangedAt). iat * 1000 < pwChangedAt → token
  // pre-dates the invalidation event.
  async validate(payload: JwtPayload & { iat?: number }): Promise<JwtPayload> {
    if (payload.iat) {
      const pwChangedAt = await this.cacheService.getPasswordChangedAt(payload.sub);
      if (pwChangedAt && payload.iat * 1000 < pwChangedAt) {
        throw new UnauthorizedException('Token revoked');
      }
    }
    return payload;
  }
}
