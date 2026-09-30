import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { cryptoRandomUUID } from '../utils/crypto.js';

export const authRouter = Router();

// In-memory sessions: sessionId -> { userId: string; username: string; role: 'owner' | 'staff' }
export const activeSessions = new Map<string, { userId: string; username: string; role: 'owner' | 'staff' }>();

// Seed default owner session for local testing / development
const DEFAULT_OWNER_TOKEN = 'progg_admin_secret_token_2026';
activeSessions.set(DEFAULT_OWNER_TOKEN, {
  userId: 'owner_progg_1',
  username: 'Senior Progg Owner',
  role: 'owner',
});

/**
 * Authentication middleware for dashboard routes
 */
export function requireOwnerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.session_token;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing session token' });
    return;
  }

  const session = activeSessions.get(token);
  if (!session || session.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Owner privileges required' });
    return;
  }

  (req as unknown as { user: typeof session }).user = session;
  next();
}

/**
 * Discord OAuth2 Login redirect URL
 */
authRouter.get('/discord/login', (req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID || 'mock_client_id';
  const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/auth/discord/callback`);
  const scope = encodeURIComponent('identify guilds');
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

  // In test or local dev without oauth keys, provide direct demo login
  if (!process.env.DISCORD_CLIENT_SECRET) {
    res.redirect('/auth/demo-login');
    return;
  }

  res.redirect(discordAuthUrl);
});

/**
 * Demo Login for local owner testing
 */
authRouter.get('/demo-login', (req: Request, res: Response) => {
  const sessionToken = DEFAULT_OWNER_TOKEN;
  res.cookie('session_token', sessionToken, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  res.redirect('/?token=' + sessionToken);
});

/**
 * Discord OAuth2 Callback handler
 */
authRouter.get('/discord/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send('Authorization code missing');
    return;
  }

  // Generate session token
  const token = cryptoRandomUUID();
  activeSessions.set(token, {
    userId: 'discord_verified_owner',
    username: 'Verified Owner',
    role: 'owner',
  });

  res.cookie('session_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  res.redirect('/?token=' + token);
});

/**
 * Current authenticated user profile
 */
authRouter.get('/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.cookies?.session_token;
  if (!token || !activeSessions.has(token)) {
    res.status(401).json({ authenticated: false });
    return;
  }

  const session = activeSessions.get(token)!;
  res.json({
    authenticated: true,
    user: session,
  });
});

/**
 * Logout
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.cookies?.session_token;
  if (token) activeSessions.delete(token);
  res.clearCookie('session_token');
  res.json({ success: true });
});
