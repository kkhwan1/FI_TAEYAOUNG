'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, AlertCircle, Check } from 'lucide-react';

interface ImageUploadZoneProps {
  itemId: string;
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
}

export function ImageUploadZone({
  itemId,
  onUploadSuccess,
  onUploadError
}: ImageUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploading(true);
      setError(null);
      setSuccess(false);
      setUploadProgress(0);

      try {
        // Validate Korean filename encoding
        const koreanRegex = /[가-힣]/;
        if (koreanRegex.test(file.name)) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder('utf-8');
          const encoded = encoder.encode(file.name);
          const decoded = decoder.decode(encoded);
          if (decoded !== file.name) {
            throw new Error('한글 파일명 인코딩 오류');
          }
        }

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        // Upload
        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const result = await safeFetchJson(`/api/items/${itemId}/images`, {
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

        setSuccess(true);
        setUploadProgress(100);
        onUploadSuccess?.();

        // Reset success state after 2 seconds
        setTimeout(() => {
          setSuccess(false);
          setUploadProgress(0);
        }, 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '파일 업로드 중 오류가 발생했습니다';
        setError(errorMessage);
        onUploadError?.(errorMessage);
      } finally {
        setUploading(false);
      }
    },
    [itemId, onUploadSuccess, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: uploading
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          ${success ? 'border-gray-500 bg-gray-50' : ''}
          ${error ? 'border-gray-500 bg-gray-50' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center space-y-4">
          {success ? (
            <Check className="w-12 h-12 text-gray-600" />
          ) : error ? (
            <AlertCircle className="w-12 h-12 text-gray-600" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400" />
          )}

          <div>
            {success ? (
              <p className="text-gray-600 font-medium">업로드 완료!</p>
            ) : error ? (
              <>
                <p className="text-gray-600 font-medium">업로드 실패</p>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
              </>
            ) : uploading ? (
              <>
                <p className="text-gray-900 font-medium">업로드 중...</p>
                <div className="w-64 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-gray-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </>
            ) : isDragActive ? (
              <p className="text-gray-600 font-medium">파일을 여기에 놓으세요</p>
            ) : (
              <>
                <p className="text-gray-900 font-medium">
                  클릭하거나 이미지를 드래그하세요
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  JPEG, PNG, GIF, WebP 형식 지원 (최대 10MB)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  한글 파일명 지원 (예: 부품_A123_사진.jpg)
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
