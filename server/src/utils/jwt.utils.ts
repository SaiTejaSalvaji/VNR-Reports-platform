import jwt from 'jsonwebtoken';
import { env } from '../configs/env.config';

const JWT_SECRET = env.JWT_SECRET;

export interface TokenPayload {
    id: string;
    name: string;
    role: string;
    department_id: number | null;
    department_name: string | null;
    created_at: string;
    iat?: number;
    exp?: number;
}

export const generateToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '24h'
    });
};

export const verifyToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
};

export const getTokenExpiryTime = (): Date => {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    return now;
};