import { Router } from 'express';
import { sectionController } from '../controllers/section.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const sectionRouter = Router();

sectionRouter.get('/', authenticateToken, sectionController.getAccessibleSections);
sectionRouter.get('/sidebar', authenticateToken, sectionController.getSidebarSections);
sectionRouter.put('/:sectionKey/config', authenticateToken, sectionController.updateSectionConfig);

export default sectionRouter;
