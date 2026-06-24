import path from 'path';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger.utils';
import { env } from './configs/env.config';
import authRouter from './routes/auth.route';
import tableRouter from './routes/table.route';
import reportRouter from './routes/report.route';
import sectionRouter from './routes/section.route';
import documentRouter from './routes/document.route';

const app = express();

// ===================
// CORS Configuration
// ===================
// Allow all origins (for development)
app.use(cors());

// Restrictive CORS (uncomment for production)
// const allowedOrigins = [
//   'http://localhost:5173',        // Frontend dev
//   'http://localhost:3000',
//   'https://vnrvjiet-monthly-reports.web.app',
//   'https://vnrvjiet-monthly-reports.firebaseapp.com',
// ];
//
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       }
//       return callback(new Error('Not allowed by CORS'));
//     },
//     credentials: true,
//   })
// );

// ===================
// Middleware
// ===================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const userId = (req as any).user?.id || '-';
    const logLine = `${method} ${originalUrl} ${statusCode} ${duration}ms user=${userId}`;

    if (statusCode >= 500) {
      logger.error(logLine);
    } else if (statusCode >= 400) {
      logger.warn(logLine);
    } else {
      logger.info(logLine);
    }
  });

  next();
});

app.use((req, res, next) => {
  if (env.MAINTENANCE_MODE) {
    logger.warn(`Blocked request during maintenance: ${req.method} ${req.path}`);

    const now = new Date();
    const end = env.MAINTENANCE_END_TIME;
    const diffMs = end.getTime() - now.getTime();

    let timeStr = '';
    if (diffMs > 0) {
      const totalMins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      if (hrs > 0 && mins > 0) timeStr = `${hrs}h ${mins}m`;
      else if (hrs > 0) timeStr = `${hrs}h`;
      else if (totalMins > 0) timeStr = `${totalMins}m`;
      else timeStr = 'a moment';
    }

    const message = timeStr
      ? `Scheduled maintenance in progress. Retry in ${timeStr}.`
      : `Scheduled maintenance in progress.`;

    return res.status(503).json({ error: message });
  }
  next();
});

// ===================
// Routes
// ===================
app.use(express.static(path.join(process.cwd(), 'public')))
app.use('/auth', authRouter);
app.use('/tables', tableRouter);
app.use('/reports', reportRouter);
app.use('/sections', sectionRouter);
app.use('/documents', documentRouter);

// Root endpoint
app.get('/', (req, res) => {
  logger.info('Root endpoint accessed');
  res.json({ message: 'vnrreports' });
});

// Environment info endpoint
app.get('/env', (req, res) => {
  res.json({ isDevDb: env.IS_DEV_DB });
});

// ===================
// Error Handler
// ===================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, {
    method: req.method,
    path: req.originalUrl,
    stack: err.stack,
  });
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});
// Export the app (DO NOT call app.listen() here)
export default app;
