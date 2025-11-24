'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File } from 'lucide-react';

interface FileUploadZoneProps {
  contractId: number;
  onUploadComplete?: () => void;
}

export default function FileUploadZone({ contractId, onUploadComplete }: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setUploading(true);

    try {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const result = await safeFetchJson(`/api/contracts/${contractId}/documents`, {
          method: 'POST',
          body: formData
        }, {
          timeout: 120000,
          maxRetries: 1,
          retryDelay: 2000
        });

        if (!result.success) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          throw new Error(extractErrorMessage(result.error) || '업로드 실패');
        }

        setUploadedFiles(prev => [...prev, file.name]);
      }

      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  }, [contractId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        {uploading ? (
          <p className="text-gray-600 dark:text-gray-400">업로드 중...</p>
        ) : isDragActive ? (
          <p className="text-gray-700 dark:text-gray-300">파일을 여기에 놓으세요</p>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              PDF, 이미지, Word, Excel 파일 (최대 10MB)
            </p>
          </div>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
            업로드 완료
          </h3>
          <ul className="space-y-1">
            {uploadedFiles.map((filename, idx) => (
              <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <File className="w-4 h-4" />
                {filename}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-800 dark:text-gray-200">{error}</p>
        </div>
      )}
    </div>
  );
}

