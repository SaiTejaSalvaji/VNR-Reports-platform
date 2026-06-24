import { Router } from 'express';
import expressAsyncHandler from 'express-async-handler';
import { authController, upload } from '../controllers/auth.controller';
import { authenticateToken, requireAdmin, requireAdminOrHOD } from '../middleware/auth.middleware';

const authRouter = Router();

authRouter.post('/login', expressAsyncHandler(async (req, res) => {
    await authController.login(req, res);
}));

authRouter.patch('/profile', authenticateToken, expressAsyncHandler(async (req, res) => {
    await authController.updateProfile(req as any, res);
}));

// Admin-only routes
authRouter.get('/users', authenticateToken, requireAdmin, expressAsyncHandler(async (req, res) => {
    await authController.getAllUsers(req as any, res);
}));

authRouter.post('/users', authenticateToken, requireAdminOrHOD, expressAsyncHandler(async (req, res) => {
    await authController.createUser(req as any, res);
}));

authRouter.delete('/users/:userId', authenticateToken, requireAdminOrHOD, expressAsyncHandler(async (req, res) => {
    await authController.deleteUser(req as any, res);
}));

authRouter.post('/bulk-upload', authenticateToken, requireAdminOrHOD, upload.single('file'), expressAsyncHandler(async (req, res) => {
    await authController.bulkUpload(req as any, res);
}));

authRouter.get('/departments', authenticateToken, expressAsyncHandler(async (req, res) => {
    await authController.getDepartments(req as any, res);
}));

export default authRouter;