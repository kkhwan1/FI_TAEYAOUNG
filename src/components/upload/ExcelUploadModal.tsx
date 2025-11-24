'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Upload, Download, FileSpreadsheet, X, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// Dynamic import for Modal component to reduce initial bundle size
const Modal = dynamic(() => import('../Modal'), {
  loading: () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
          <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>
  ),
  ssr: false
});

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadUrl: string;
  title: string;
  onUploadSuccess: () => void;
  templateUrl?: string; // 템플릿 다운로드 URL (선택적)
  templateFileName?: string; // 템플릿 파일명 (선택적)
}

export default function ExcelUploadModal({
  isOpen,
  onClose,
  uploadUrl,
  title,
  onUploadSuccess,
  templateUrl,
  templateFileName
}: ExcelUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Allowed file types
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];

  const allowedExtensions = ['.xlsx', '.xls'];

  const validateFile = (file: File): boolean => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        setError('Excel 파일만 업로드 가능합니다. (.xlsx, .xls)');
        return false;
      }
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.');
      return false;
    }

    setError('');
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 100);

      // Upload file using FormData
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(uploadUrl, {
        method: 'POST',
        body: formData,
      }, {
        timeout: 120000,
        maxRetries: 1,
        retryDelay: 2000
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        // Show detailed success/error message if available
        const data = result.data || result;
        const successCount = data.successCount || data.inserted?.length || 0;
        const errorCount = data.errorCount || data.errors?.length || 0;
        const totalProcessed = data.totalProcessed || successCount + errorCount;
        
        let message = '엑셀 업로드가 완료되었습니다.';
        if (totalProcessed > 0) {
          if (errorCount > 0) {
            message = `${successCount}개 성공, ${errorCount}개 실패 (총 ${totalProcessed}개 처리)`;
            toast.error('업로드 완료 (일부 실패)', message);
          } else {
            message = `${successCount}개 항목이 성공적으로 업로드되었습니다.`;
            toast.success('업로드 완료', message);
          }
        } else {
          toast.error('업로드 실패', '처리된 항목이 없습니다. 파일 내용을 확인해주세요.');
        }
        
        setTimeout(() => {
          resetModal();
          onUploadSuccess();
        }, 500);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '업로드에 실패했습니다.');
      }
          } catch (err: any) {
      setError(err.message || '업로드 중 오류가 발생했습니다.');
      toast.error('업로드 실패', err.message || '업로드 중 오류가 발생했습니다.');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const resetModal = () => {
    setSelectedFile(null);
    setIsDragOver(false);
    setIsUploading(false);
    setUploadProgress(0);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      resetModal();
      onClose();
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTemplateDownload = async () => {
    try {
      // templateUrl이 제공되면 사용, 아니면 기존 로직 사용
      let templateUrlToUse = templateUrl;
      if (!templateUrlToUse) {
        templateUrlToUse = uploadUrl.replace('/upload/', '/download/template/');
      }

      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch(templateUrlToUse, {}, {
        timeout: 30000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!response.ok) {
        throw new Error('템플릿을 찾을 수 없습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Determine filename based on templateFileName prop or upload URL
      const fileName = templateFileName || 
        (uploadUrl.includes('items') ? '품목_템플릿.xlsx' : 
         uploadUrl.includes('inventory') ? '재고거래_템플릿.xlsx' :
         '거래처_템플릿.xlsx');
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('템플릿 다운로드 완료', `${fileName}이 다운로드되었습니다.`);
    } catch (err: any) {
      toast.error('다운로드 실패', err.message || '템플릿 다운로드에 실패했습니다.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="md">
      <div className="space-y-6">
        {/* Template Download Button */}
        <div className="flex justify-end">
          <button
            onClick={handleTemplateDownload}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            템플릿 다운로드
          </button>
        </div>

        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-gray-400 bg-gray-50 dark:bg-gray-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading}
          />

          {!selectedFile ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <FileSpreadsheet className="w-12 h-12 text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Excel 파일을 여기에 드래그하거나
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  파일 선택
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                지원 형식: .xlsx, .xls (최대 10MB)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-gray-500" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={removeFile}
                  disabled={isUploading}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">업로드 중...</span>
                    <span className="text-gray-600 dark:text-gray-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gray-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-gray-500" />
            <p className="text-sm text-gray-700 dark:text-gray-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                업로드 중...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                업로드
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}