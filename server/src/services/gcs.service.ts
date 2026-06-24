import { Storage } from '@google-cloud/storage';
import { env } from '../configs/env.config';
import { logger } from '../utils/logger.utils';

// Initialize Google Cloud Storage with service account credentials
const storage = new Storage({
  projectId: env.GCS_PROJECT_ID,
  credentials: {
    client_email: env.GCS_CLIENT_EMAIL,
    private_key: env.GCS_PRIVATE_KEY,
  },
});

const bucket = storage.bucket(env.GCS_BUCKET_NAME);

/**
 * Generate a signed URL for uploading a file to GCS
 * @param fileName - The name of the file to upload
 * @param contentType - The MIME type of the file
 * @returns Signed upload URL and GCS path
 */
export async function generateUploadSignedUrl(
  fileName: string,
  contentType: string = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
): Promise<{ uploadUrl: string; gcsPath: string }> {
  const gcsPath = fileName;
  const file = bucket.file(gcsPath);

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: contentType,
  });

  logger.info(`GCS upload URL generated: ${gcsPath}`);
  return { uploadUrl, gcsPath };
}

/**
 * Generate a signed URL for downloading a file from GCS
 * @param gcsPath - The GCS object path
 * @returns Signed download URL
 */
export async function generateDownloadSignedUrl(gcsPath: string): Promise<string> {
  const file = bucket.file(gcsPath);

  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });

  return downloadUrl;
}

/**
 * Delete a file from GCS
 * @param gcsPath - The GCS object path
 */
export async function deleteFileFromGCS(gcsPath: string): Promise<void> {
  const file = bucket.file(gcsPath);
  await file.delete();
  logger.info(`GCS file deleted: ${gcsPath}`);
}

/**
 * Check if a file exists in GCS
 * @param gcsPath - The GCS object path
 * @returns Boolean indicating existence
 */
export async function fileExistsInGCS(gcsPath: string): Promise<boolean> {
  const file = bucket.file(gcsPath);
  const [exists] = await file.exists();
  return exists;
}
