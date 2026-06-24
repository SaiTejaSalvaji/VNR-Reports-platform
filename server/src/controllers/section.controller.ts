import { Response } from 'express';
import { pool } from '../configs/neonDb.config';
import { logger } from '../utils/logger.utils';
import { NEW_SECTION_EXPIRY } from '../configs/newSectionLabels.config';

export const sectionController = {
    /**
     * Get sections accessible by the current user
     * Filters section_metadata by the user's department and role
     */
    async getAccessibleSections(req: any, res: Response): Promise<Response> {
        try {
            const departmentName = req.user?.department_name;
            const role = req.user?.role;
            const month = req.query.month ? Number(req.query.month) : null;
            const year  = req.query.year  ? Number(req.query.year)  : null;

            const specialDepts = ['HR', 'MTP', 'ALUMNI', 'ED CELL', 'LIBRARY', 'RDC', 'IQAC'];
            const isSpecialDept = specialDepts.includes(departmentName);

            const params: any[] = [];

            // Simple exact month/year LEFT JOIN
            let configJoin = `LEFT JOIN section_config sc ON FALSE`;
            if (month !== null && year !== null) {
                params.push(month, year);
                configJoin = `LEFT JOIN section_config sc ON sc.section_key = sm.section_key AND sc.month = $1 AND sc.year = $2`;
            }

            let query = `
                SELECT sm.*, sc.config
                FROM section_metadata sm
                ${configJoin}
                WHERE sm.is_active = true
            `;

            if (role !== 'admin') {
                const p = params.length + 1;
                if (isSpecialDept) {
                    query += ` AND sm.accessible_by @> $${p}::jsonb`;
                    params.push(JSON.stringify([`dept:${departmentName}`]));
                } else {
                    query += ` AND sm.accessible_by @> '["academic"]'::jsonb`;
                }
            }

            query += ` ORDER BY sm.display_order ASC`;

            const result = await pool.query(query, params);
            const sections = result.rows;

            // For sections with no config this month/year, check if they have config
            // for any other month — if so, create an empty entry for this month/year
            if (month !== null && year !== null) {
                const nullConfigKeys = sections
                    .filter(s => s.config === null)
                    .map(s => s.section_key);

                if (nullConfigKeys.length > 0) {
                    const existing = await pool.query(
                        `SELECT DISTINCT section_key FROM section_config WHERE section_key = ANY($1)`,
                        [nullConfigKeys]
                    );
                    const keysToCreate = existing.rows.map((r: any) => r.section_key);

                    if (keysToCreate.length > 0) {
                        await pool.query(
                            `INSERT INTO section_config (section_key, config, month, year, created_by)
                             SELECT unnest($1::text[]), '{"labels":{}}'::jsonb, $2, $3, 'ADMIN'
                             ON CONFLICT (section_key, month, year) DO NOTHING`,
                            [keysToCreate, month, year]
                        );
                        // Patch the in-memory response
                        keysToCreate.forEach((key: string) => {
                            const idx = sections.findIndex((s: any) => s.section_key === key);
                            if (idx >= 0) sections[idx] = { ...sections[idx], config: { labels: {} } };
                        });
                    }
                }
            }

            return res.json({ sections });
        } catch (error) {
            logger.error(`Get accessible sections failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    async updateSectionConfig(req: any, res: Response): Promise<Response> {
        try {
            const { sectionKey } = req.params;
            const { config, month, year } = req.body;

            if (!config || typeof config !== 'object') {
                return res.status(400).json({ error: 'config object is required' });
            }
            if (!month || !year) {
                return res.status(400).json({ error: 'month and year are required' });
            }

            const result = await pool.query(
                `INSERT INTO section_config (section_key, config, month, year, created_by)
                 VALUES ($1, $2, $3, $4, 'ADMIN')
                 ON CONFLICT (section_key, month, year)
                 DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
                 RETURNING config`,
                [sectionKey, JSON.stringify(config), Number(month), Number(year)]
            );

            return res.json({ config: result.rows[0].config });
        } catch (error) {
            logger.error(`Update section config failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * Get simplified list of sections for the sidebar navigation
     */
    async getSidebarSections(req: any, res: Response): Promise<Response> {
        try {
            const departmentName = req.user?.department_name;
            const role = req.user?.role;

            const specialDepts = ['HR', 'MTP', 'ALUMNI', 'ED CELL', 'LIBRARY', 'RDC', 'IQAC'];
            const isSpecialDept = specialDepts.includes(departmentName);

            let query = `SELECT id, section_key, display_name, display_order FROM section_metadata WHERE is_active = true`;
            const params: any[] = [];

            if (role !== 'admin') {
                if (isSpecialDept) {
                    query += ` AND accessible_by @> $1::jsonb`;
                    params.push(JSON.stringify([`dept:${departmentName}`]));
                } else {
                    query += ` AND accessible_by @> '["academic"]'::jsonb`;
                }
            }

            query += ` ORDER BY display_order ASC`;

            const result = await pool.query(query, params);

            const now = new Date();
            const sections = result.rows.map((row: any) => {
                const expiryStr = NEW_SECTION_EXPIRY[row.section_key];
                const is_new = expiryStr ? now <= new Date(expiryStr) : false;
                return { ...row, is_new };
            });

            return res.json({ sections });
        } catch (error) {
            logger.error(`Get sidebar sections failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
};