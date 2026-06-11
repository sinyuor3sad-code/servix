import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../types';
import { CacheService } from '../cache/cache.service';
import { PlatformPrismaClient } from '../database/platform.client';
import { assertActiveTenantUser } from '../auth/tenant-user.helper';

// Socket.IO ships transitively via @nestjs/platform-socket.io but is
// not a direct dependency here. We model the small surface we touch
// to avoid pulling 'socket.io' into the import graph just for types.
export interface WsSocket {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  handshake: {
    auth?: Record<string, unknown>;
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
  };
  disconnect?(close?: boolean): void;
}

interface ValidatedConnection {
  userId: string;
  tenantId: string;
  roleId?: string;
  email: string;
}

/**
 * V-01 — gates Socket.IO handshakes.
 *
 * Used in two ways:
 *   1. EventsGateway.handleConnection calls `validateConnection(client)`
 *      directly because the gateway has no @SubscribeMessage handlers
 *      and NestJS guards on canActivate are only invoked for those.
 *      The gateway disconnects the socket if this throws.
 *   2. Future per-event guards may use `canActivate(ctx)` once
 *      @SubscribeMessage handlers are introduced.
 *
 * Behaviour:
 *   - Reads the access token from `handshake.auth.token` (Socket.IO v3+
 *     standard). Falls back to the `Authorization: Bearer …` header.
 *   - Verifies the JWT signature/expiry with the same secret as HTTP.
 *   - Rejects if `cache.getPasswordChangedAt(sub)` is newer than the
 *     token's `iat` (mirrors V-14a HTTP revocation).
 *   - Rejects if the JWT has no `tenantId`.
 *   - If the handshake carries `query.tenantId`, it must match
 *     `payload.tenantId` exactly (defence against client confusion;
 *     the JWT is the source of truth either way).
 *   - Looks up TenantUser(tenantId=payload.tenantId, userId=payload.sub)
 *     via the shared helper — must exist + status='active'.
 *   - Feature-flag `WS_AUTH_ENFORCE` (env, default true): when false,
 *     a failed validation is downgraded to a warn log and the
 *     connection is accepted with whatever query fields it sent. Used
 *     for staged rollout (soak window).
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);
  private readonly enforce: boolean;

  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
    private readonly platformPrisma: PlatformPrismaClient,
    private readonly configService: ConfigService,
  ) {
    // Joi validation guarantees a boolean; this is defence in depth.
    this.enforce = this.configService.get<boolean>('WS_AUTH_ENFORCE', true);
  }

  /**
   * Manual entry point used by EventsGateway.handleConnection.
   *
   * On success, attaches `client.data.user` and `client.data.tenantId`
   * derived strictly from the verified JWT — never from query.
   *
   * When the feature flag is OFF and validation fails, this returns
   * `null` (caller can still join rooms from `client.handshake.query`).
   * Returns the validated identity object on success.
   */
  async validateConnection(client: WsSocket): Promise<ValidatedConnection | null> {
    try {
      const validated = await this.validateOrThrow(client);
      client.data = client.data || {};
      client.data.user = {
        sub: validated.userId,
        email: validated.email,
        tenantId: validated.tenantId,
        roleId: validated.roleId,
      };
      client.data.tenantId = validated.tenantId;
      return validated;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown';
      if (this.enforce) {
        this.logger.warn(
          `WS handshake rejected | socket=${client.id} reason="${reason}"`,
        );
        throw err;
      }
      this.logger.warn(
        `WS handshake would be rejected but WS_AUTH_ENFORCE=false | socket=${client.id} reason="${reason}"`,
      );
      return null;
    }
  }

  /**
   * Standard NestJS guard entry point (covers any future
   * @SubscribeMessage handlers). The handshake is normally validated
   * by handleConnection, so this is a defense-in-depth check on every
   * message — re-reads `client.data` rather than re-verifying the JWT
   * to avoid double DB hits.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<WsSocket>();
    if (client.data?.user && client.data?.tenantId) {
      return true;
    }
    if (!this.enforce) {
      this.logger.warn(
        `WS message accepted without prior handshake validation (flag off) | socket=${client.id}`,
      );
      return true;
    }
    throw new UnauthorizedException('WS connection not authenticated');
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal: strict validation, throws on any failure.
  // ─────────────────────────────────────────────────────────────────
  private async validateOrThrow(client: WsSocket): Promise<ValidatedConnection> {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: JwtPayload & { iat?: number };
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload & { iat?: number }>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token missing subject');
    }
    if (!payload.tenantId) {
      throw new UnauthorizedException('Token missing tenant binding');
    }

    // Revocation gate (V-14a primitive): if password was changed after
    // this token was issued, reject. iat is unix seconds, the cache
    // value is unix milliseconds.
    if (payload.iat) {
      const pwChangedAt = await this.cacheService.getPasswordChangedAt(payload.sub);
      if (pwChangedAt && payload.iat * 1000 < pwChangedAt) {
        throw new UnauthorizedException('Token revoked');
      }
    }

    // Reject contradicting query.tenantId — the JWT is the source of
    // truth, but a mismatch signals a confused client and we'd rather
    // surface it than silently override.
    const queryTenantId = this.extractQueryString(client, 'tenantId');
    if (queryTenantId && queryTenantId !== payload.tenantId) {
      throw new ForbiddenException(
        'tenantId in handshake query does not match access token',
      );
    }

    await assertActiveTenantUser(
      this.platformPrisma,
      payload.tenantId,
      payload.sub,
    );

    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      roleId: payload.roleId,
      email: payload.email,
    };
  }

  private extractToken(client: WsSocket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token && typeof auth.token === 'string') {
      return auth.token.startsWith('Bearer ')
        ? auth.token.slice('Bearer '.length)
        : auth.token;
    }
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }

  private extractQueryString(client: WsSocket, key: string): string | null {
    const value = client.handshake.query?.[key];
    if (typeof value === 'string') return value;
    return null;
  }
}
