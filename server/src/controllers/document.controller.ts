import { Request, Response } from 'express';
import { pool } from '../configs/neonDb.config';
import { logger } from '../utils/logger.utils';
import {
    generateUploadSignedUrl,
    generateDownloadSignedUrl,
    deleteFileFromGCS
} from '../services/gcs.service';

interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
        department_id: number;
    };
}

export const documentController = {
    /**
     * Generate signed URL for uploading a document to GCS (supports multiple files)
     */
    async getUploadUrl(req: AuthRequest, res: Response): Promise<Response> {
        try {
            const { section_key, month, year, department_id, file_name, content_type } = req.body;

            if (!section_key || !month || !year || !file_name) {
                return res.status(400).json({ error: 'Missing required parameters: section_key, month, year, file_name' });
            }

            const userId = req.user?.id;
            const userDeptId = req.user?.department_id;
            const role = req.user?.role;

            // Determine target department
            const targetDeptId = (role === 'admin' && department_id)
                ? parseInt(department_id)
                : userDeptId;

            // Verify user has permission
            if (role !== 'admin' && targetDeptId !== userDeptId) {
                return res.status(403).json({ error: 'Unauthorized to upload for this department' });
            }

            // Generate unique GCS file path with timestamp to avoid conflicts: {year}-{month}/{section_key}/{timestamp}_{original_filename}
            const timestamp = Date.now();
            const gcsFileName = `${year}-${month}/${section_key}/${timestamp}_${file_name}`;

            // Generate signed upload URL
            const { uploadUrl, gcsPath } = await generateUploadSignedUrl(
                gcsFileName,
                content_type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );

            // Insert new document metadata (no longer using UPSERT - supports multiple files)
            const query = `
                INSERT INTO uploaded_documents (
                    department_id, month, year, section_key,
                    file_name, gcs_path, content_type, uploaded_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, file_name, uploaded_at
            `;

            const result = await pool.query(query, [
                targetDeptId,
                parseInt(month),
                parseInt(year),
                section_key,
                file_name,
                gcsPath,
                content_type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                userId
            ]);

            logger.info(`Upload URL generated for: ${file_name} - dept ${targetDeptId}, ${month}/${year}`);

            return res.json({
                uploadUrl,
                gcsPath,
                document: result.rows[0]
            });

        } catch (error) {
            logger.error(`Get upload URL failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Failed to generate upload URL' });
        }
    },

    /**
     * Get document metadata (returns all documents for the section)
     */
    async getDocument(req: AuthRequest, res: Response): Promise<Response> {
        try {
            const { section_key, month, year, department_id } = req.query;

            if (!section_key || !month || !year) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            const userDeptId = req.user?.department_id;
            const role = req.user?.role;

            const targetDeptId = (role === 'admin' && department_id)
                ? parseInt(department_id as string)
                : userDeptId;

            const result = await pool.query(
                `SELECT id, file_name, gcs_path, uploaded_at, uploaded_by
                 FROM uploaded_documents
                 WHERE department_id = $1 AND month = $2 AND year = $3 AND section_key = $4
                 ORDER BY uploaded_at DESC`,
                [targetDeptId, parseInt(month as string), parseInt(year as string), section_key]
            );

            // Return empty array if no documents found (not an error for multiple files)
            return res.json({ documents: result.rows });

        } catch (error) {
            logger.error(`Get documents failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Failed to get documents' });
        }
    },

    /**
     * Get signed download URL for document (by document ID)
     */
    async getDownloadUrl(req: AuthRequest, res: Response): Promise<Response> {
        try {
            const { document_id } = req.query;

            if (!document_id) {
                return res.status(400).json({ error: 'Missing required parameter: document_id' });
            }

            const userDeptId = req.user?.department_id;
            const role = req.user?.role;

            // Get document and verify permissions
            const result = await pool.query(
                `SELECT file_name, gcs_path, department_id
                 FROM uploaded_documents
                 WHERE id = $1`,
                [parseInt(document_id as string)]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Document not found' });
            }

            const doc = result.rows[0];

            // Verify user has permission to download
            if (role !== 'admin' && doc.department_id !== userDeptId) {
                return res.status(403).json({ error: 'Unauthorized to download this document' });
            }

            // Generate signed download URL
            const downloadUrl = await generateDownloadSignedUrl(doc.gcs_path);

            logger.info(`Download URL generated for: ${doc.file_name}`);

            return res.json({
                downloadUrl,
                fileName: doc.file_name
            });

        } catch (error) {
            logger.error(`Get download URL failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Failed to generate download URL' });
        }
    },

    /**
     * Delete document (by document ID)
     */
    async deleteDocument(req: AuthRequest, res: Response): Promise<Response> {
        try {
            const { document_id } = req.query;

            if (!document_id) {
                return res.status(400).json({ error: 'Missing required parameter: document_id' });
            }

            const userDeptId = req.user?.department_id;
            const role = req.user?.role;

            // Get document and verify permissions
            const docResult = await pool.query(
                `SELECT gcs_path, department_id FROM uploaded_documents WHERE id = $1`,
                [parseInt(document_id as string)]
            );

            if (docResult.rows.length === 0) {
                return res.status(404).json({ error: 'Document not found' });
            }

            const doc = docResult.rows[0];

            // Verify permission
            if (role !== 'admin' && doc.department_id !== userDeptId) {
                return res.status(403).json({ error: 'Unauthorized to delete this document' });
            }

            // Delete from database
            await pool.query(
                `DELETE FROM uploaded_documents WHERE id = $1`,
                [parseInt(document_id as string)]
            );

            // Delete from GCS
            try {
                await deleteFileFromGCS(doc.gcs_path);
                logger.info(`File deleted from GCS: ${doc.gcs_path}`);
            } catch (error) {
                logger.warn(`Failed to delete file from GCS: ${(error as Error).message}`);
                // Continue even if GCS deletion fails
            }

            logger.info(`Document deleted with ID: ${document_id}`);

            return res.json({ message: 'Document deleted successfully' });

        } catch (error) {
            logger.error(`Delete document failed: ${(error as Error).message}`);
            return res.status(500).json({ error: 'Failed to delete document' });
        }
    }
};
