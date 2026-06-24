import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import api from '../libs/api';

interface WordUploadProps {
  sectionKey: string;
  month: number;
  year: number;
  departmentId?: number;
  readOnly?: boolean;
  onUploadSuccess?: () => void;
}

interface UploadedDocument {
  id: number;
  file_name: string;
  uploaded_at: string;
  uploaded_by: string;
}

const WordUpload: React.FC<WordUploadProps> = ({
  sectionKey,
  month,
  year,
  departmentId,
  readOnly = false,
  onUploadSuccess
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing documents on mount
  React.useEffect(() => {
    fetchDocuments();
  }, [sectionKey, month, year, departmentId]);

  // ESC key listener for delete dialog
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteDocId !== null) {
        setDeleteDocId(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [deleteDocId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        section_key: sectionKey,
        month: month.toString(),
        year: year.toString()
      });
      if (departmentId) {
        params.append('department_id', departmentId.toString());
      }

      const response = await api.get(`/documents?${params.toString()}`);
      setDocuments(response.data.documents || []);
    } catch (err: any) {
      // 404 is expected if no documents exist
      if (err.response?.status !== 404) {
        console.error('Failed to fetch documents:', err);
      }
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validate file types
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    const invalidFiles = Array.from(files).filter(file => !validTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      setError('Please upload only Word documents (.doc or .docx)');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const totalFiles = files.length;
      let uploadedCount = 0;

      // Upload each file
      for (const file of Array.from(files)) {
        // Step 1: Get signed upload URL from backend
        const uploadUrlResponse = await api.post('/documents/upload-url', {
          section_key: sectionKey,
          month: month,
          year: year,
          department_id: departmentId,
          file_name: file.name,
          content_type: file.type
        });

        const { uploadUrl } = uploadUrlResponse.data;

        // Step 2: Upload file directly to GCS using signed URL
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type
          },
          body: file
        });

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      // Refresh document list
      await fetchDocuments();

      const message = totalFiles === 1
        ? 'Document uploaded successfully'
        : `${totalFiles} documents uploaded successfully`;
      setSuccess(message);
      onUploadSuccess?.();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Failed to upload documents');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (documentId: number, fileName: string) => {
    try {
      const params = new URLSearchParams({
        document_id: documentId.toString()
      });

      // Get signed download URL from backend
      const response = await api.get(`/documents/download-url?${params.toString()}`);
      const { downloadUrl } = response.data;

      // Download file directly from GCS
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error('Download failed:', err);
      setError('Failed to download document');
    }
  };

  const handleDelete = async () => {
    if (deleteDocId === null) return;

    try {
      const params = new URLSearchParams({
        document_id: deleteDocId.toString()
      });

      await api.delete(`/documents?${params.toString()}`);

      // Remove from local state
      setDocuments(documents.filter(doc => doc.id !== deleteDocId));

      setSuccess('Document deleted successfully');
      setDeleteDocId(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete document');
      setDeleteDocId(null);
    }
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
        <div className="flex items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-16 border border-gray-300 rounded-lg bg-white">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Additional Documents {documents.length > 0 && `(${documents.length})`}
        </h3>
        {!readOnly && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Files
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || readOnly}
          multiple
        />
      </div>

      <div className="p-4">
        {/* Error Message */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              &times;
            </button>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle size={18} />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && uploadProgress > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Uploading files...</span>
              <span className="text-sm font-medium text-gray-900">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Documents List */}
        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="text-blue-600 flex-shrink-0" size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleDownload(doc.id, doc.file_name)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition border border-transparent hover:border-gray-300"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                    {!readOnly && (
                      <button
                        onClick={() => setDeleteDocId(doc.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-300"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="mx-auto mb-2 text-gray-400" size={32} />
            <p className="text-sm">No documents uploaded yet</p>
            {!readOnly && (
              <p className="text-xs mt-1">Click "Upload Files" to add documents</p>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteDocId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md mx-4 w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Document
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete "
                {documents.find(d => d.id === deleteDocId)?.file_name}"? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteDocId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-lg border border-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordUpload;
