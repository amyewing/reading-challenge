import { createRemoteJWKSet, jwtVerify, errors } from 'jose';
import { config } from './config';
import { HttpError } from './http';

// Kinde's public signing keys, fetched once and cached (jose refreshes them on key rotation).
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  jwks ??= createRemoteJWKSet(new URL(`${config.kindeDomain}/.well-known/jwks`));
  return jwks;
}

const unauthorized = () => new HttpError(401, 'Please sign in again.');

/**
 * Verify the Kinde access token from the Authorization header and return the user's Kinde id.
 * The token must be signed by our Kinde domain, issued for our API (audience), and unexpired.
 */
export async function verifyRequest(authorization: string | undefined): Promise<string> {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw unauthorized();
  try {
    const { payload } = await jwtVerify(match[1], getJwks(), {
      issuer: config.kindeDomain,
      audience: config.kindeAudience,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub) throw unauthorized();
    return payload.sub;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof errors.JOSEError) {
      // Log why (never the token itself) so sign-in problems can be diagnosed
      const detail = e instanceof errors.JWTClaimValidationFailed ? ` (${e.claim}: ${e.reason})` : '';
      console.warn(`Token rejected: ${e.code}${detail}`);
      throw unauthorized();
    }
    throw new HttpError(503, 'Could not reach the sign-in service. Try again shortly.');
  }
}
