# Authentication Patterns Reference

## Password Hashing

### Argon2id (Recommended)
```typescript
import argon2 from 'argon2';

// Hash
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // iterations
  parallelism: 4,
});

// Verify
const isValid = await argon2.verify(hash, password);
```

### bcrypt (Also acceptable)
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;  // Minimum 10, more is slower but more secure

// Hash
const hash = await bcrypt.hash(password, SALT_ROUNDS);

// Verify
const isValid = await bcrypt.compare(password, hash);
```

## JWT Implementation

### Token Structure
```typescript
// Access Token Payload
interface AccessTokenPayload {
  sub: string;      // User ID
  email: string;
  roles: string[];
  iat: number;      // Issued at
  exp: number;      // Expiry
  iss: string;      // Issuer
  aud: string[];    // Audience
}

// Refresh Token (stored server-side)
interface RefreshToken {
  id: string;
  userId: string;
  token: string;      // Hashed
  expiresAt: Date;
  createdAt: Date;
  userAgent: string;
  ipAddress: string;
}
```

### Token Generation
```typescript
import jwt from 'jsonwebtoken';

function generateTokens(user: User) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',
      issuer: 'my-app',
      audience: ['my-app-api'],
    }
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshTokenHash = await hash(refreshToken);
  
  await db.refreshTokens.create({
    userId: user.id,
    token: refreshTokenHash,
    expiresAt: addDays(new Date(), 7),
  });

  return { accessToken, refreshToken };
}
```

### Token Refresh Flow
```typescript
async function refreshAccessToken(refreshToken: string) {
  // 1. Find token in database
  const storedToken = await db.refreshTokens.findByToken(hash(refreshToken));
  
  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // 2. Get user
  const user = await db.users.findById(storedToken.userId);
  
  // 3. Rotate refresh token (one-time use)
  await db.refreshTokens.delete(storedToken.id);
  
  // 4. Generate new tokens
  return generateTokens(user);
}
```

## OAuth 2.0 / Social Login

### Authorization Code Flow
```typescript
// 1. Redirect to provider
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
authUrl.searchParams.set('redirect_uri', CALLBACK_URL);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'openid email profile');
authUrl.searchParams.set('state', generateCSRFToken());

// 2. Handle callback
async function handleOAuthCallback(code: string, state: string) {
  // Verify CSRF state
  if (!verifyCSRFToken(state)) {
    throw new Error('Invalid state');
  }

  // Exchange code for tokens
  const { access_token, id_token } = await exchangeCode(code);
  
  // Get user info
  const profile = await getGoogleProfile(access_token);
  
  // Find or create user
  let user = await db.users.findByEmail(profile.email);
  if (!user) {
    user = await db.users.create({
      email: profile.email,
      name: profile.name,
      provider: 'google',
      providerId: profile.sub,
    });
  }
  
  return generateTokens(user);
}
```

## Session Management

### Stateless (JWT) vs Stateful (Sessions)

| Aspect | JWT | Sessions |
|--------|-----|----------|
| Scalability | Excellent (no server state) | Requires shared store |
| Revocation | Hard (need blocklist) | Easy (delete session) |
| Size | Larger (payload in token) | Smaller (just session ID) |
| Use case | Microservices, APIs | Traditional web apps |

### Session Store (Redis)
```typescript
const session = require('express-session');
const RedisStore = require('connect-redis').default;

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // HTTPS only
    httpOnly: true,    // No JS access
    sameSite: 'lax',   // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  },
}));
```

## Multi-Factor Authentication (MFA)

### TOTP Implementation
```typescript
import { authenticator } from 'otplib';

// Setup
function setupMFA(userId: string) {
  const secret = authenticator.generateSecret();
  
  // Store secret (encrypted)
  await db.users.update(userId, { mfaSecret: encrypt(secret) });
  
  // Generate QR code
  const otpauth = authenticator.keyuri(user.email, 'MyApp', secret);
  const qrCode = await QRCode.toDataURL(otpauth);
  
  return { secret, qrCode };
}

// Verify
function verifyMFA(userId: string, code: string) {
  const user = await db.users.findById(userId);
  const secret = decrypt(user.mfaSecret);
  
  return authenticator.verify({ token: code, secret });
}
```

## API Key Authentication

```typescript
// Generate API key
function generateApiKey() {
  const key = `pk_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = await hash(key);
  
  await db.apiKeys.create({
    keyHash,
    prefix: key.slice(0, 10),  // For identification
    userId,
    scopes: ['read:orders', 'write:orders'],
  });
  
  return key;  // Show once, never stored in plain text
}

// Validate API key
async function validateApiKey(key: string) {
  const keyHash = await hash(key);
  const apiKey = await db.apiKeys.findByHash(keyHash);
  
  if (!apiKey || apiKey.revokedAt) {
    throw new UnauthorizedError('Invalid API key');
  }
  
  return apiKey;
}
```

## Security Hardening

### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

// General API
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
}));

// Auth endpoints (stricter)
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts',
}));
```

### Account Lockout
```typescript
async function handleFailedLogin(userId: string) {
  await db.users.increment(userId, 'failedLoginAttempts');
  
  const user = await db.users.findById(userId);
  
  if (user.failedLoginAttempts >= 5) {
    await db.users.update(userId, {
      lockedUntil: addMinutes(new Date(), 15),
    });
  }
}

async function handleSuccessfulLogin(userId: string) {
  await db.users.update(userId, {
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
}
```
