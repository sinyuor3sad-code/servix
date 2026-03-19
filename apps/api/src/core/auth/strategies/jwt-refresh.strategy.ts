import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../../../shared/types';

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') || '',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    const authHeader = req.get('Authorization') ?? '';
    const refreshToken = authHeader.replace('Bearer ', '').trim();

    return {
      ...payload,
      refreshToken,
    };
  }
}
