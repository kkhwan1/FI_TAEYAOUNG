'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  AlertCircle,
  Check
} from 'lucide-react';

interface DocumentUploadZoneProps {
  contractId: string;
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
}

export function DocumentUploadZone({
  contractId,
  onUploadSuccess,
  onUploadError
}: DocumentUploadZoneProps) {
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
        // Validate Korean filename encoding (erp-specialist skill pattern)
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

        // Validate file size (50MB limit)
        if (file.size > 52428800) {
          throw new Error('파일 크기는 50MB를 초과할 수 없습니다');
        }

        // Create FormData
        const formData = new FormData();
        formData.append('document', file);

        // Upload
        setUploadProgress(30);
        const response = await fetch(`/api/contracts/${contractId}/documents`, {
          method: 'POST',
          body: formData
        });

        setUploadProgress(70);
        const result = await response.json();

        if (!result.success) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          throw new Error(extractErrorMessage(result.error) || '업로드 실패');
        }

        setSuccess(true);
        setUploadProgress(100);
        onUploadSuccess?.();

        // Reset success state after 3 seconds
        setTimeout(() => {
          setSuccess(false);
          setUploadProgress(0);
        }, 3000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '파일 업로드 중 오류가 발생했습니다';
        setError(errorMessage);
        onUploadError?.(errorMessage);
      } finally {
        setUploading(false);
      }
    },
    [contractId, onUploadSuccess, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize: 52428800, // 50MB
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
            <Upload className="w-12 h-12 text-gray-600" />
          )}

          <div>
            {success ? (
              <>
                <p className="text-gray-600 font-medium">업로드 완료!</p>
                <p className="text-sm text-gray-500 mt-1">
                  문서가 성공적으로 업로드되었습니다
                </p>
              </>
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
                  클릭하거나 문서를 드래그하세요
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  PDF, DOCX, XLSX 형식 지원 (최대 50MB)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  한글 파일명 지원 (예: 계약서_2024_태창자동차.pdf)
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
