import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { authRouter } from './authRoutes.js';
import { statsRouter } from './statsRoutes.js';
import { membersRouter } from './membersRoutes.js';
import { escrowRouter } from './escrowRoutes.js';
import { aiRouter } from './aiRoutes.js';
import { eventsRouter } from './eventsRoutes.js';
import { outreachRouter } from './outreachRoutes.js';
import { leadRouter } from './leadRoutes.js';
import { logger } from '../utils/logger.js';

const defaultPublicDir = typeof __dirname !== 'undefined'
  ? path.join(__dirname, 'public')
  : path.resolve(process.cwd(), 'src/dashboard/public');

export function createDashboardApp(): Express {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Mount API routers
  app.use('/auth', authRouter);
  app.use('/api', statsRouter);
  app.use('/api', membersRouter);
  app.use('/api', escrowRouter);
  app.use('/api', aiRouter);
  app.use('/api', eventsRouter);
  app.use('/api', outreachRouter);
  app.use('/api', leadRouter);

  // Serve static public folder for the web dashboard SPA
  const publicDir = defaultPublicDir;
  app.use(express.static(publicDir));

  // Fallback to index.html for SPA client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

export function startDashboardServer(port = 3000): { app: Express; server: ReturnType<Express['listen']> } {
  const app = createDashboardApp();
  const server = app.listen(port, () => {
    logger.info(`[Dashboard] Owner Web Dashboard running on http://localhost:${port}`);
  });

  return { app, server };
}
