import dotenv from 'dotenv';
// Load environment variables from .env file (for local development)
dotenv.config();

import app from './app';
import { logger } from './utils/logger.utils';

const PORT = process.env.PORT || 3033;

app.listen(PORT, () => {
  logger.info(`Server started successfully on port ${PORT}`);
  logger.info(`http://localhost:${PORT}`);
});