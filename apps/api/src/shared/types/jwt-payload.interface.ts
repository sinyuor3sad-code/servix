export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  roleId?: string;
}

export interface JwtTokens {
  accessToken: string;
  refreshToken: string;
}
