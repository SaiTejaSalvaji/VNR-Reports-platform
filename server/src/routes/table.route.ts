import { Router } from 'express';
import expressAsyncHandler from 'express-async-handler';
import { tableController } from '../controllers/table.controller';
import { authenticateToken, requireAdmin, requireHOD } from '../middleware/auth.middleware';

const tableRouter = Router();

// Get all table metadata (accessible to all authenticated users)
tableRouter.get('/metadata', authenticateToken, expressAsyncHandler(async (req, res) => {
    await tableController.getTableMetadata(req as any, res);
}));

// Get HOD stats (HOD only)
tableRouter.get('/hod/stats', authenticateToken, requireHOD, expressAsyncHandler(async (req, res) => {
    await tableController.getHodStats(req as any, res);
}));

// Get Admin stats (Admin only)
tableRouter.get('/admin/stats', authenticateToken, requireAdmin, expressAsyncHandler(async (req, res) => {
    await tableController.getAdminStats(req as any, res);
}));

export default tableRouter;
