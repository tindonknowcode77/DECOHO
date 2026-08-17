import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type Payload = { sub: string; email: string; role: string };

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(request: { headers?: { authorization?: string } }, payload: Payload) {
    const refreshToken = request.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!refreshToken) throw new UnauthorizedException('Refresh token is missing');
    return { ...payload, refreshToken };
  }
}
