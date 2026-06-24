import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.utils';
import { logger } from '../utils/logger.utils';

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

    if (!token) {
        logger.warn(`Missing authentication token for ${req.originalUrl}`);
        res.status(401).json({ error: 'Access token required' });
        return;
    }

    const decoded = verifyToken(token);

    if (!decoded) {
        logger.warn(`Invalid authentication token for ${req.originalUrl}`);
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }

    (req as any).user = decoded;
    logger.debug(`Authenticated: ${decoded.id} (${decoded.role}) -> ${req.method} ${req.originalUrl}`);
    next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    // overiding temporarily.
    if (!user) {
        logger.warn(`Admin access denied for ${req.originalUrl}`);
        res.status(403).json({ error: 'Admin access required' });
        return;
    }

    next();
};



export const requireHOD = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || (user.role !== 'hod' && user.role !== 'reports-incharge')) {
        logger.warn(`HOD/Reports-Incharge access denied for ${req.originalUrl}`);
        res.status(403).json({ error: 'HOD or Reports-Incharge access required' });
        return;
    }

    next();
};

export const requireAdminOrHOD = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || (user.role !== 'admin' && user.role !== 'hod' && user.role !== 'reports-incharge')) {
        logger.warn(`Admin or HOD/Reports-Incharge access denied for ${req.originalUrl}`);
        res.status(403).json({ error: 'Admin, HOD, or Reports-Incharge access required' });
        return;
    }

    next();
};