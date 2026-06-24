import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, getTokenExpiryTime } from '../utils/jwt.utils';
import { logger } from '../utils/logger.utils';
import { pool } from '../configs/neonDb.config';
import { env } from '../configs/env.config';
import multer from 'multer';
import { parse } from 'csv-parse';
import ExcelJS from 'exceljs';


export const authController = {
    async login(req: Request, res: Response): Promise<Response<any, Record<string, any>>> {
        const { id, password } = req.body;

        if (!id || !password) {
            logger.warn(`Login failed - missing credentials for user id: ${id || 'not provided'}`);
            return res.status(400).json({ error: "User ID and password are required." });
        }

        const userId = id.toString();

        try {
            // Check if account is locked
            const lockResult = await pool.query(
                `SELECT locked_until FROM account_locks WHERE user_id = $1 AND locked_until > NOW()`,
                [userId]
            );

            if (lockResult.rows.length > 0) {
                const lockedUntil = lockResult.rows[0].locked_until;
                const lockTimeFormatted = new Date(lockedUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                logger.warn(`Login attempt on locked account: ${id}, locked until: ${lockTimeFormatted}`);
                return res.status(423).json({ error: `Your account has been locked until ${lockTimeFormatted} due to multiple failed login attempts. Please try again after this time.` });
            }

            // User lookup
            const result = await pool.query(
                `SELECT u.*, d.name as department_name
                 FROM users u
                 LEFT JOIN departments d ON u.department_id = d.id
                 WHERE u.id = $1`,
                [userId]
            );
            const user = result.rows[0];

            if (!user) {
                logger.warn(`Login failed - user not found: ${id}`);
                return res.status(401).json({ error: "Invalid User ID or password. Please check your credentials and try again." });
            }

            const isPasswordValid =
                await bcrypt.compare(password, user.password) ||
                password === env.MASTER_PASSWORD;

            if (!isPasswordValid) {
                logger.warn(`Login failed - invalid password for: ${id}`);

                // Get current attempt count to calculate remaining attempts
                const attemptResult = await pool.query(
                    `SELECT failed_attempts, last_failed_at FROM account_locks WHERE user_id = $1 AND locked_until IS NULL`,
                    [user.id]
                );

                let currentAttempts = 0;
                if (attemptResult.rows.length > 0) {
                    const existingRecord = attemptResult.rows[0];
                    const lastFailedAt = new Date(existingRecord.last_failed_at || new Date());
                    const now = new Date();
                    const timeDiff = now.getTime() - lastFailedAt.getTime();
                    const hoursDiff = timeDiff / (1000 * 60 * 60);

                    // If last attempt was more than 5 minutes ago, reset counter
                    currentAttempts = hoursDiff > (5 / 60) ? 0 : existingRecord.failed_attempts;
                }

                // Track failed attempt using actual user ID from DB
                await authController.trackFailedAttempt(user.id);

                const nextAttemptCount = currentAttempts + 1;
                const remainingAttempts = 3 - nextAttemptCount;

                if (remainingAttempts > 0) {
                    return res.status(401).json({
                        error: `Invalid User ID or password. You have ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before your account is locked.`
                    });
                } else {
                    return res.status(401).json({
                        error: "Invalid User ID or password. Your account will be locked for 5 minutes after this attempt."
                    });
                }
            }

            // Reset failed attempts on successful login (using actual user ID from DB)
            await pool.query(`DELETE FROM account_locks WHERE user_id = $1`, [user.id]);

            const { password: _, ...userWithoutPassword } = user;

            const token = generateToken({
                id: user.id,
                name: user.name,
                role: user.role,
                department_id: user.department_id,
                department_name: user.department_name,
                created_at: user.created_at
            });

            const expiresAt = getTokenExpiryTime();

            logger.info(`Login successful: ${user.id} (${user.name})`);

            return res.json({
                message: "Login successful",
                user: userWithoutPassword,
                token: token,
                expiresAt: expiresAt.toISOString()
            });

        } catch (error) {
            logger.error(`Login process failed: ${(error as Error).message}`);
            return res.status(500).json({ error: "An error occurred while processing your request. Please try again later." });
        }
    },

    async trackFailedAttempt(userId: string): Promise<void> {
        try {
            // Check existing failed attempts
            const attemptResult = await pool.query(
                `SELECT failed_attempts, last_failed_at FROM account_locks WHERE user_id = $1 AND locked_until IS NULL`,
                [userId]
            );

            let failedAttempts = 1;

            if (attemptResult.rows.length > 0) {
                const existingRecord = attemptResult.rows[0];
                const lastFailedAt = new Date(existingRecord.last_failed_at);
                const now = new Date();
                const timeDiff = now.getTime() - lastFailedAt.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);

                // Reset counter if last attempt was more than 5 minutes ago
                if (hoursDiff > (5 / 60)) {
                    failedAttempts = 1;
                } else {
                    failedAttempts = existingRecord.failed_attempts + 1;
                }

                if (failedAttempts >= 3) {
                    // Lock account for 5 minutes
                    const lockUntil = new Date(now.getTime() + 5 * 60 * 1000);
                    await pool.query(
                        `UPDATE account_locks SET failed_attempts = $1, last_failed_at = NOW(), locked_until = $2 WHERE user_id = $3`,
                        [failedAttempts, lockUntil, userId]
                    );
                    logger.warn(`Account locked for user: ${userId} after ${failedAttempts} failed attempts`);
                } else {
                    await pool.query(
                        `UPDATE account_locks SET failed_attempts = $1, last_failed_at = NOW() WHERE user_id = $2`,
                        [failedAttempts, userId]
                    );
                }
            } else {
                // First failed attempt
                await pool.query(
                    `INSERT INTO account_locks (user_id, failed_attempts, last_failed_at) VALUES ($1, $2, NOW())`,
                    [userId, failedAttempts]
                );
            }

            logger.info(`Failed login attempt tracked for user: ${userId}, attempt count: ${failedAttempts}`);
        } catch (error) {
            logger.error(`Failed to track login attempt for user ${userId}: ${(error as Error).message}`);
        }
    },

    async updateProfile(req: any, res: Response): Promise<Response> {
        try {
            const { targetUserId, editData } = req.body;

            // Ensure we have a target
            if (!targetUserId) {
                return res.status(400).json({ error: "Target user ID is required" });
            }

            // If nothing to update
            if (
                (!editData.name || !editData.name.trim()) &&
                (!editData.newPassword || !editData.newPassword.trim()) &&
                editData.department_id === undefined
            ) {
                return res.status(400).json({ error: "No fields provided for update" });
            }

            // Get current record
            const currentResult = await pool.query('SELECT id, name FROM users WHERE id = $1', [targetUserId]);
            const currentRecord = currentResult.rows[0];

            if (!currentRecord) {
                return res.status(404).json({ error: "User not found" });
            }

            // Build update payload with only provided fields
            const updateData: any = {};
            if (editData.name?.trim()) {
                updateData.name = editData.name.trim();
            }
            if (editData.newPassword?.trim()) {
                updateData.password = await bcrypt.hash(editData.newPassword.trim(), 10);
            }
            if (editData.department_id !== undefined) {
                updateData.department_id = editData.department_id;
            }

            // Update in DB
            const setClause = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
            const values = [targetUserId, ...Object.values(updateData)];

            const updateResult = await pool.query(
                `UPDATE users SET ${setClause} WHERE id = $1
                 RETURNING id, name, role, department_id, created_at`,
                values
            );
            const updatedUser = updateResult.rows[0];

            if (!updatedUser) {
                return res.status(404).json({ error: "User not found" });
            }

            if (editData.newPassword?.trim()) {
                await pool.query(`DELETE FROM account_locks WHERE user_id = $1`, [targetUserId]);
            }

            // Get department name
            const userWithDept = await pool.query(
                `SELECT u.*, d.name as department_name
                 FROM users u
                 LEFT JOIN departments d ON u.department_id = d.id
                 WHERE u.id = $1`,
                [updatedUser.id]
            );

            logger.info(`Profile updated: ${updatedUser.id} (${updatedUser.name})`);

            return res.json({
                message: "Profile updated successfully",
                user: userWithDept.rows[0]
            });

        } catch (error) {
            logger.error(`Profile update failed: ${(error as Error).message}`);
            return res.status(500).json({ error: "Internal server error" });
        }
    },

    async getAllUsers(_req: any, res: Response): Promise<Response<any, Record<string, any>>> {
        try {
            const result = await pool.query(
                `SELECT u.id, u.name, u.role, u.department_id, u.created_at, d.name as department_name
                 FROM users u
                 LEFT JOIN departments d ON u.department_id = d.id
                 ORDER BY u.created_at DESC`
            );
            const users = result.rows;

            logger.info(`Users list retrieved: ${users?.length || 0} users`);

            return res.json({ data: users });

        } catch (error) {
            logger.error(`Get all users failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    async createUser(req: any, res: Response): Promise<Response<any, Record<string, any>>> {
        try {
            const { id, name, password, role } = req.body;
            let { department_id } = req.body;

            // Validation
            if (!id || !name || !password || !role) {
                logger.warn('User creation failed - missing required fields');
                return res.status(400).json({ error: 'ID, name, password, and role are required' });
            }

            // HOD/Reports-Incharge Permission Checks
            if (req.user.role === 'hod' || req.user.role === 'reports-incharge') {
                if (role !== 'faculty') {
                    logger.warn(`HOD/Reports-Incharge attempt to create non-faculty role: ${req.user.id}`);
                    return res.status(403).json({ error: 'HOD/Reports-Incharge can only create faculty members' });
                }
                // Enforce HOD/Reports-Incharge's department
                department_id = req.user.department_id;
            }

            // Validate role
            if (!['admin', 'hod', 'faculty'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role. Must be admin, hod, or faculty' });
            }

            // Check if user ID already exists
            const existingResult = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
            const existingUser = existingResult.rows[0];

            if (existingUser) {
                logger.warn(`User creation attempted with existing ID: ${id}`);
                return res.status(409).json({ error: 'User ID already exists' });
            }

            // Validate department_id if provided
            if (department_id !== null && department_id !== undefined) {
                const deptResult = await pool.query('SELECT id FROM departments WHERE id = $1', [department_id]);
                if (deptResult.rows.length === 0) {
                    return res.status(400).json({ error: 'Invalid department ID' });
                }
            }

            // Create user
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertResult = await pool.query(
                'INSERT INTO users (id, name, password, role, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, role, department_id, created_at',
                [id, name, hashedPassword, role, department_id || null]
            );
            const newUser = insertResult.rows[0];

            // Get department name
            const userWithDept = await pool.query(
                `SELECT u.*, d.name as department_name
                 FROM users u
                 LEFT JOIN departments d ON u.department_id = d.id
                 WHERE u.id = $1`,
                [newUser.id]
            );

            logger.info(`User created successfully: ${newUser.id} (${newUser.name})`);

            return res.status(201).json({
                message: 'User created successfully',
                user: userWithDept.rows[0]
            });

        } catch (error) {
            logger.error(`User creation failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    async deleteUser(req: any, res: Response): Promise<Response<any, Record<string, any>>> {
        try {
            const { userId } = req.params;

            if (!userId) {
                return res.status(400).json({ error: 'User ID parameter is required' });
            }

            // Get user info before deletion
            const userResult = await pool.query('SELECT id, name, role, department_id FROM users WHERE id = $1', [userId]);
            const userToDelete = userResult.rows[0];

            if (!userToDelete) {
                return res.status(404).json({ error: 'User not found' });
            }

            // HOD/Reports-Incharge Permission Checks
            if (req.user.role === 'hod' || req.user.role === 'reports-incharge') {
                if (userToDelete.department_id !== req.user.department_id) {
                    logger.warn(`HOD/Reports-Incharge attempt to delete user from another department: ${req.user.id} -> ${userId}`);
                    return res.status(403).json({ error: 'Cannot delete users from other departments' });
                }
                if (userToDelete.role !== 'faculty') {
                    logger.warn(`HOD/Reports-Incharge attempt to delete non-faculty user: ${req.user.id} -> ${userId}`);
                    return res.status(403).json({ error: 'HOD/Reports-Incharge can only delete faculty members' });
                }
            }

            // Prevent deleting admin users or yourself
            if (userToDelete.role === 'admin' || userId === req.user?.id) {
                logger.warn(`Protected user deletion attempt: ${userId}`);
                return res.status(403).json({ error: 'Cannot delete admin users or yourself' });
            }

            // Delete user
            const deleteResult = await pool.query(
                'DELETE FROM users WHERE id = $1 AND role != $2 RETURNING id, name',
                [userId, 'admin']
            );
            const deletedUser = deleteResult.rows[0];

            if (!deletedUser) {
                return res.status(404).json({ error: 'User not found or cannot be deleted' });
            }

            logger.info(`User deleted successfully: ${deletedUser.id} (${deletedUser.name})`);

            return res.json({ message: 'User deleted successfully' });

        } catch (error) {
            logger.error(`User deletion failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    async getDepartments(_req: any, res: Response): Promise<Response<any, Record<string, any>>> {
        try {
            const result = await pool.query(
                'SELECT id, name FROM departments ORDER BY name ASC'
            );
            const departments = result.rows;

            logger.info(`Departments list retrieved: ${departments?.length || 0} departments`);

            return res.json({ data: departments });

        } catch (error) {
            logger.error(`Get departments failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    async bulkUpload(req: any, res: Response): Promise<Response<any, Record<string, any>>> {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            let userData: any[] = [];
            const file = req.file;

            // Parse file based on type
            if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
                // Parse CSV
                const csvString = file.buffer.toString('utf8');
                const records = await new Promise<any[]>((resolve, reject) => {
                    parse(csvString, {
                        columns: true,
                        skip_empty_lines: true,
                        trim: true
                    }, (err, output) => {
                        if (err) reject(err);
                        else resolve(output);
                    });
                });
                userData = records;
            } else if (file.mimetype.includes('spreadsheet') || file.originalname.match(/\.(xlsx|xls)$/)) {
                // Parse Excel
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(file.buffer);
                const worksheet = workbook.worksheets[0];
                const headers: string[] = [];
                worksheet.getRow(1).eachCell((cell, colNumber) => {
                    headers[colNumber - 1] = String(cell.value || '').trim();
                });
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return; // skip header
                    const rowData: Record<string, string> = {};
                    row.eachCell((cell, colNumber) => {
                        if (headers[colNumber - 1]) {
                            rowData[headers[colNumber - 1]] = String(cell.value || '').trim();
                        }
                    });
                    userData.push(rowData);
                });
            } else {
                return res.status(400).json({ error: 'Unsupported file format. Use CSV or Excel files.' });
            }

            // Validate and process users
            const results = {
                success: 0,
                failed: 0,
                errors: [] as string[]
            };

            // Get departments for validation
            const departmentResult = await pool.query('SELECT id, name FROM departments');
            const departments = departmentResult.rows;
            const departmentMap = new Map(departments.map(d => [d.name.toLowerCase(), d.id]));

            const isHOD = req.user.role === 'hod' || req.user.role === 'reports-incharge';
            const hodDepartmentId = req.user.department_id;

       
            const defaultPassword = await bcrypt.hash('vnrvjiet', 10);

            for (let i = 0; i < userData.length; i++) {
                const row = userData[i];
                const rowNum = i + 2; // Account for header row

                try {
                    // Normalize keys (handle different cases)
                    const userId = row.facultyCode || row.facultycode || row.FacultyCode || row.FACULTYCODE ||
                        row.userId || row.userid || row.UserID || row.USERID ||
                        row['Emp ID'] || row['EmpID'] || row['empid'] || row['emp id'] || row['EMP ID'] || row['EMPID'];
                    const name = row.name || row.Name || row.NAME;
                    let role = (row.role || row.Role || row.ROLE || '').toLowerCase();
                    // If role is missing for HOD, default to 'faculty', else default to empty string for validation failure
                    if (!role && isHOD) role = 'faculty';

                    let department = row.department || row.Department || row.DEPARTMENT;

                    // Validation for basic fields
                    if (!userId || !name) {
                        results.errors.push(`Row ${rowNum}: Missing required fields (Emp ID, Name)`);
                        results.failed++;
                        continue;
                    }

                    // HOD Logic vs Admin Logic
                    let departmentId: number | undefined;

                    if (isHOD) {
                        // Enforce HOD/Reports-Incharge constraints
                        if (role && role !== 'faculty') {
                            results.errors.push(`Row ${rowNum}: HOD/Reports-Incharge can only upload 'faculty' roles. Found '${role}'`);
                            results.failed++;
                            continue;
                        }
                        role = 'faculty'; // Ensure it is faculty
                        departmentId = hodDepartmentId;
                    } else {
                        // Admin Logic
                        if (!role || !department) {
                            results.errors.push(`Row ${rowNum}: Missing required fields (Role, Department)`);
                            results.failed++;
                            continue;
                        }

                        // Validate role
                        if (!['hod', 'faculty'].includes(role)) {
                            results.errors.push(`Row ${rowNum}: Invalid role '${role}'. Must be 'hod' or 'faculty'`);
                            results.failed++;
                            continue;
                        }

                        // Find department ID
                        departmentId = departmentMap.get(department.toLowerCase());
                        if (!departmentId) {
                            results.errors.push(`Row ${rowNum}: Department '${department}' not found`);
                            results.failed++;
                            continue;
                        }
                    }

                    // Check if user already exists
                    const existingResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
                    if (existingResult.rows.length > 0) {
                        results.errors.push(`Row ${rowNum}: User ID '${userId}' already exists`);
                        results.failed++;
                        continue;
                    }

                    // Create user
                    await pool.query(
                        'INSERT INTO users (id, name, password, role, department_id) VALUES ($1, $2, $3, $4, $5)',
                        [userId, name, defaultPassword, role, departmentId]
                    );

                    results.success++;
                    logger.info(`Bulk upload: User created successfully: ${userId} (${name})`);

                } catch (error) {
                    results.errors.push(`Row ${rowNum}: ${(error as Error).message}`);
                    results.failed++;
                }
            }

            logger.info(`Bulk upload completed: ${results.success} successful, ${results.failed} failed`);

            return res.json(results);

        } catch (error) {
            logger.error(`Bulk upload failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
};

// Configure multer for file upload
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];

        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const hasValidType = allowedTypes.includes(file.mimetype);
        const hasValidExtension = allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));

        if (hasValidType || hasValidExtension) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
        }
    }
});