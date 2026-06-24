import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const reportRouter = Router();

// Get a monthly report
reportRouter.get('/', authenticateToken, reportController.getMonthlyReport);

// Get departments with data for a specific section (Admin only)
reportRouter.get('/departments-with-data', authenticateToken, requireAdmin, reportController.getDepartmentsWithData);

// Save/Update a monthly report
reportRouter.post('/save', authenticateToken, reportController.saveMonthlyReport);

// Generate report with SSE progress updates (Admin only)
// Query parameters: month (1-12), year (e.g., 2024), department_id (optional)
// Example: GET /reports/generate?month=10&year=2024&department_id=1
reportRouter.get('/generate', authenticateToken, requireAdmin, async (req, res) => {
    await reportController.generateReportWithProgress(req, res);
});

// Generate snapshot report with SSE progress (Admin only)
// Query parameters: month (1-12), year (e.g., 2025)
reportRouter.get('/snapshot/generate', authenticateToken, requireAdmin, async (req, res) => {
    await reportController.generateSnapshotReport(req, res);
});

export default reportRouter;
