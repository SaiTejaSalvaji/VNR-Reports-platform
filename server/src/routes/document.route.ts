import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const documentRouter = Router();

// Get document metadata
documentRouter.get('/', authenticateToken, documentController.getDocument);

// Get signed upload URL for direct GCS upload
documentRouter.post('/upload-url', authenticateToken, documentController.getUploadUrl);

// Get signed download URL for direct GCS download
documentRouter.get('/download-url', authenticateToken, documentController.getDownloadUrl);

// Delete document
documentRouter.delete('/', authenticateToken, documentController.deleteDocument);

export default documentRouter;
