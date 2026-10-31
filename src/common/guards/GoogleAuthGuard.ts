import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

export interface AuthenticatedUser {
  email: string | null;
  sub: string | null;
}

interface CacheEntry {
  user: AuthenticatedUser;
  expiresAt: number;
}

/**
 * Verifies the Google OAuth access token sent by the Meet extension as
 * `Authorization: Bearer <token>` (from chrome.identity.getAuthToken).
 *
 * Results are cached per token for up to 5 minutes so the ~1 request per
 * 30 s from each extension doesn't hit Google's tokeninfo endpoint every time.
 */
@Injectable()
export class GoogleAuthGuard implements CanActivate {
  private static readonly CACHE_TTL_MS = 5 * 60_000;
  private readonly logger = new Logger(GoogleAuthGuard.name);
  private readonly cache = new Map<string, CacheEntry>();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!token) {
      return true;
    }

    const user = await this.verify(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired Google bearer token');
    }

    req.user = user;
    return true;
  }

  private async verify(token: string): Promise<AuthenticatedUser | null> {
    const now = Date.now();
    const cached = this.cache.get(token);
    if (cached && cached.expiresAt > now) {
      return cached.user;
    }

    try {
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) {
        this.logger.warn(`Google rejected token: HTTP ${res.status}`);
        return null;
      }

      const info = (await res.json()) as Record<string, string>;
      const user: AuthenticatedUser = {
        email: info.email ?? null,
        sub: info.sub ?? null,
      };
      const ttlMs = Math.min(
        GoogleAuthGuard.CACHE_TTL_MS,
        Math.max(0, Number(info.expires_in ?? 0) * 1000),
      );
      this.cache.set(token, { user, expiresAt: now + ttlMs });

      if (this.cache.size > 1000) {
        for (const [k, v] of this.cache) {
          if (v.expiresAt <= now) this.cache.delete(k);
        }
      }
      return user;
    } catch (err) {
      this.logger.error(`Token verification failed: ${(err as Error).message}`);
      return null;
    }
  }
}
