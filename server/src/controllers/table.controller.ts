import { Request, Response } from 'express';
import { pool } from '../configs/neonDb.config';
import { logger } from '../utils/logger.utils';

export const tableController = {
    // Legacy: Get all table metadata (Replaced by sectionController, keeping for compatibility if needed)
    async getTableMetadata(req: any, res: Response): Promise<Response> {
        // Redirect to section metadata logic if possible, or return empty to prevent crashes
        try {
            const result = await pool.query(
                `SELECT id, section_key as table_name, display_name, 'section' as description, created_by, created_at
                 FROM section_metadata
                 WHERE is_active = true
                 ORDER BY display_order ASC`
            );
            return res.json({ tables: result.rows });
        } catch (error) {
            logger.error(`Get table metadata failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get Admin stats with optional month filter
    async getAdminStats(req: any, res: Response): Promise<Response> {
        try {
            const { month, year } = req.query;

            // 1. Get Summary Counts
            const usersResult = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM section_metadata WHERE is_active = true) as total_sections,
                    (SELECT COUNT(*) FROM departments) as total_departments,
                    COUNT(*) as total_users,
                    COUNT(*) FILTER (WHERE role = 'faculty') as total_faculty,
                    COUNT(*) FILTER (WHERE role = 'hod') as total_hods
                FROM users WHERE role != 'admin'
            `);
            const summary = usersResult.rows[0];

            // 2. Fetch Reports for calculation (only for department stats)
            let reportsQuery = `
                SELECT r.department_id, r.report_data
                FROM monthly_reports r
            `;
            const params: any[] = [];
            if (month && year) {
                reportsQuery += ` WHERE r.month = $1 AND r.year = $2`;
                params.push(month, year);
            }
            const reportsResult = await pool.query(reportsQuery, params);
            const reports = reportsResult.rows;

            // 3. Initialize Dept Stats
            const departmentStatsMap = new Map<number, any>();
            const allDepts = await pool.query('SELECT id, name FROM departments');

            allDepts.rows.forEach(d => {
                departmentStatsMap.set(d.id, {
                    id: d.id,
                    name: d.name,
                    faculty_count: 0,
                    hod_count: 0,
                    total_entries: 0
                });
            });

            // 4. Get Faculty/HOD counts per dept
            const deptUserCounts = await pool.query(`
                SELECT department_id, 
                       COUNT(*) FILTER (WHERE role = 'faculty') as faculty_count,
                       COUNT(*) FILTER (WHERE role = 'hod') as hod_count
                FROM users GROUP BY department_id
            `);
            deptUserCounts.rows.forEach(d => {
                const stats = departmentStatsMap.get(d.department_id);
                if (stats) {
                    stats.faculty_count = parseInt(d.faculty_count);
                    stats.hod_count = parseInt(d.hod_count);
                }
            });

            // 5. Calculate Entries per Department
            // We need to know which keys are sections to count entries correctly
            const sectionsResult = await pool.query(`SELECT section_key, section_type FROM section_metadata`);
            const sections = sectionsResult.rows;

            reports.forEach(report => {
                const deptStats = departmentStatsMap.get(report.department_id);
                if (!deptStats) return;

                sections.forEach(section => {
                    const data = report.report_data[section.section_key];
                    let count = 0;

                    if (section.section_type === 'records' && Array.isArray(data)) {
                        count = data.length;
                    } else if (data) {
                        count = 1;
                    }

                    if (count > 0) {
                        deptStats.total_entries += count;
                    }
                });
            });

            // Format Output
            const department_stats = Array.from(departmentStatsMap.values());
            const inactive_departments = department_stats.filter(d => d.total_entries === 0);

            return res.json({
                summary: {
                    total_tables: parseInt(summary.total_sections),
                    total_departments: parseInt(summary.total_departments),
                    total_users: parseInt(summary.total_users),
                    total_faculty: parseInt(summary.total_faculty),
                    total_hods: parseInt(summary.total_hods)
                },
                department_stats,
                inactive_departments
            });

        } catch (error) {
            logger.error(`Get admin stats failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error', details: (error as Error).message });
        }
    },

    // Get HOD stats with optional month filter
    async getHodStats(req: any, res: Response): Promise<Response> {
        try {
            const departmentId = req.user?.department_id;

            if (!departmentId) {
                return res.status(400).json({ error: 'Department ID not found' });
            }

            // Get Faculty Count
            const facultyResult = await pool.query(
                'SELECT COUNT(*) as faculty_count FROM users WHERE department_id = $1 AND role = $2',
                [departmentId, 'faculty']
            );
            const facultyCount = parseInt(facultyResult.rows[0].faculty_count);

            // Inactive Faculty (Returning all faculty for now as per legacy logic, simplified)
            const inactiveFacultyResult = await pool.query(
                'SELECT id, name FROM users WHERE department_id = $1 AND role = $2',
                [departmentId, 'faculty']
            );
            const inactiveFaculty = inactiveFacultyResult.rows;

            return res.json({
                summary: {
                    faculty_count: facultyCount
                },
                inactive_faculty: inactiveFaculty
            });

        } catch (error) {
            logger.error(`Get HOD stats failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error', details: (error as Error).message });
        }
    }
};