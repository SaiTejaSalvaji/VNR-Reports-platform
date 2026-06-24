import { Pool } from 'pg';
import { env } from './env.config';
import { logger } from '../utils/logger.utils';

const dbMode = env.IS_DEV_DB ? 'DEV' : 'PROD';
logger.info(`Database connection: ${dbMode}`);

export const pool = new Pool({
    connectionString: env.IS_DEV_DB ? env.PG_CONN_STRING_DEV : env.PG_CONN_STRING_PROD,
});

pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { message: err.message });
});

