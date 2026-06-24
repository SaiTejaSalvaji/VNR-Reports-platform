const getTimestamp = (): string => {
    return new Date().toISOString();
};

const formatMessage = (level: string, message: string, meta?: Record<string, unknown>): string => {
    const ts = getTimestamp();
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
    return `${ts} [${level}] ${message}${metaStr}`;
};

export const logger = {
    error(message: string, meta?: Record<string, unknown>) {
        console.error(formatMessage('ERROR', message, meta));
    },
    warn(message: string, meta?: Record<string, unknown>) {
        console.warn(formatMessage('WARN', message, meta));
    },
    info(message: string, meta?: Record<string, unknown>) {
        console.info(formatMessage('INFO', message, meta));
    },
    debug(message: string, meta?: Record<string, unknown>) {
        console.debug(formatMessage('DEBUG', message, meta));
    },
};
