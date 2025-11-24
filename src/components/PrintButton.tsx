'use client';

import React, { useState } from 'react';
import { Printer, Download, Settings, Eye } from 'lucide-react';
import {
  printTable,
  printWithPreview,
  PrintOptions,
  TableColumn
} from '@/utils/printUtils';
import { useToast } from '@/contexts/ToastContext';

interface PrintButtonProps {
  data: Record<string, any>[];
  columns: TableColumn[];
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg';
  showPreview?: boolean;
  showOptions?: boolean;
  orientation?: 'portrait' | 'landscape';
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  onPrintStart?: () => void;
  onPrintComplete?: () => void;
  onError?: (error: Error) => void;
}

interface PrintOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (options: PrintOptions) => void;
  currentOptions: PrintOptions;
}

/**
 * 인쇄 옵션 모달
 */
function PrintOptionsModal({ isOpen, onClose, onPrint, currentOptions }: PrintOptionsModalProps) {
  const [options, setOptions] = useState<PrintOptions>(currentOptions);

  if (!isOpen) return null;

  const handlePrint = () => {
    onPrint(options);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            인쇄 옵션
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            
          </button>
        </div>

        <div className="space-y-4">
          {/* 용지 방향 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              용지 방향
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="orientation"
                  value="portrait"
                  checked={options.orientation === 'portrait'}
                  onChange={(e) => setOptions({ ...options, orientation: e.target.value as 'portrait' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">세로</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="orientation"
                  value="landscape"
                  checked={options.orientation === 'landscape'}
                  onChange={(e) => setOptions({ ...options, orientation: e.target.value as 'landscape' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">가로</span>
              </label>
            </div>
          </div>

          {/* 용지 크기 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              용지 크기
            </label>
            <select
              value={options.pageSize || 'A4'}
              onChange={(e) => setOptions({ ...options, pageSize: e.target.value as 'A4' | 'A3' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </div>

          {/* 헤더/푸터 옵션 */}
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.includeHeader !== false}
                onChange={(e) => setOptions({ ...options, includeHeader: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                회사 정보 헤더 포함
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.includeFooter !== false}
                onChange={(e) => setOptions({ ...options, includeFooter: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                페이지 번호 푸터 포함
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.showPageNumbers !== false}
                onChange={(e) => setOptions({ ...options, showPageNumbers: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                페이지 번호 표시
              </span>
            </label>
          </div>

          {/* 제목 및 부제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              보고서 제목
            </label>
            <input
              type="text"
              value={options.title || ''}
              onChange={(e) => setOptions({ ...options, title: e.target.value })}
              placeholder="보고서 제목을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              부제목 (선택)
            </label>
            <input
              type="text"
              value={options.subtitle || ''}
              onChange={(e) => setOptions({ ...options, subtitle: e.target.value })}
              placeholder="부제목을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Printer className="w-4 h-4" />
            인쇄
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 인쇄 버튼 컴포넌트
 */
export default function PrintButton({
  data,
  columns,
  title = '데이터 목록',
  subtitle,
  variant = 'default',
  size = 'md',
  showPreview = false,
  showOptions = true,
  orientation = 'landscape',
  className = '',
  disabled = false,
  children,
  onPrintStart,
  onPrintComplete,
  onError
}: PrintButtonProps) {
  const { error: showErrorToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const defaultOptions: PrintOptions = {
    orientation,
    pageSize: 'A4',
    includeHeader: true,
    includeFooter: true,
    showPageNumbers: true,
    title,
    subtitle
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  };

  const handlePrint = async (options: PrintOptions = defaultOptions) => {
    if (disabled || data.length === 0) return;

    try {
      setIsLoading(true);
      onPrintStart?.();

      if (showPreview) {
        await printWithPreview(data, columns, options);
      } else {
        await printTable(data, columns, options);
      }

      onPrintComplete?.();
    } catch (error) {
      console.error('Print error:', error);
      onError?.(error as Error);

      // 사용자에게 오류 메시지 표시
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showErrorToast(`인쇄 중 오류가 발생했습니다: ${extractErrorMessage(error) || (error instanceof Error ? error.message : '알 수 없는 오류')}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectPrint = () => {
    if (showOptions) {
      setShowOptionsModal(true);
    } else {
      handlePrint();
    }
  };

  const renderButton = () => {
    const baseClasses = `
      inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors
      disabled:opacity-50 disabled:cursor-not-allowed
      ${getSizeClasses()}
      ${className}
    `;

    const iconClass = getIconSize();

    if (variant === 'icon') {
      return (
        <button
          onClick={handleDirectPrint}
          disabled={disabled || isLoading || data.length === 0}
          className={`${baseClasses} bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700`}
          title="인쇄"
        >
          {isLoading ? (
            <div className={`${iconClass} border-2 border-white border-t-transparent rounded-full animate-spin`} />
          ) : (
            children || <Printer className={iconClass} />
          )}
        </button>
      );
    }

    if (variant === 'text') {
      return (
        <button
          onClick={handleDirectPrint}
          disabled={disabled || isLoading || data.length === 0}
          className={`${baseClasses} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300`}
        >
          {isLoading ? (
            <>
              <div className={`${iconClass} border-2 border-gray-600 border-t-transparent rounded-full animate-spin`} />
              인쇄 중...
            </>
          ) : (
            <>
              <Printer className={iconClass} />
              인쇄
            </>
          )}
        </button>
      );
    }

    return (
      <button
        onClick={handleDirectPrint}
        disabled={disabled || isLoading || data.length === 0}
        className={`${baseClasses} bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700`}
      >
        {isLoading ? (
          <>
            <div className={`${iconClass} border-2 border-white border-t-transparent rounded-full animate-spin`} />
            인쇄 중...
          </>
        ) : (
          <>
            <Printer className={iconClass} />
            인쇄
          </>
        )}
      </button>
    );
  };

  const isEmpty = data.length === 0;

  return (
    <>
      <div className="relative">
        {renderButton()}

        {/* 데이터가 없을 때 툴팁 */}
        {isEmpty && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            인쇄할 데이터가 없습니다
          </div>
        )}
      </div>

      {/* 인쇄 옵션 모달 */}
      <PrintOptionsModal
        isOpen={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        onPrint={handlePrint}
        currentOptions={defaultOptions}
      />
    </>
  );
}

/**
 * 프리셋 인쇄 버튼들
 */

interface QuickPrintButtonsProps {
  data: Record<string, any>[];
  columns: TableColumn[];
  title?: string;
  className?: string;
}

export function QuickPrintButtons({ data, columns, title, className = '' }: QuickPrintButtonsProps) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {/* 빠른 인쇄 */}
      <PrintButton
        data={data as Record<string, any>[]}
        columns={columns}
        title={title}
        variant="default"
        size="md"
        showPreview={false}
        showOptions={false}
      />

      {/* 미리보기 후 인쇄 */}
      <PrintButton
        data={data as Record<string, any>[]}
        columns={columns}
        title={title}
        variant="icon"
        size="md"
        showPreview={true}
        showOptions={false}
        className="bg-gray-500 hover:bg-gray-600"
      >
        <Eye className="w-5 h-5" />
      </PrintButton>

      {/* 옵션 설정 후 인쇄 */}
      <PrintButton
        data={data as Record<string, any>[]}
        columns={columns}
        title={title}
        variant="icon"
        size="md"
        showPreview={false}
        showOptions={true}
        className="bg-gray-500 hover:bg-gray-600"
      >
        <Settings className="w-5 h-5" />
      </PrintButton>
    </div>
  );
}

/**
 * 드롭다운 인쇄 메뉴
 */
interface PrintDropdownProps {
  data: Record<string, any>[];
  columns: TableColumn[];
  title?: string;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
}

export function PrintDropdown({ data, columns, title, onExportExcel, onExportPDF }: PrintDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
      >
        <Download className="w-5 h-5" />
        내보내기
        <span className="ml-1">▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 z-20">
            <div className="py-1">
              <PrintButton
                data={data as Record<string, any>[]}
                columns={columns}
                title={title}
                variant="text"
                size="sm"
                showPreview={false}
                showOptions={false}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              />

              <PrintButton
                data={data as Record<string, any>[]}
                columns={columns}
                title={title}
                variant="text"
                size="sm"
                showPreview={true}
                showOptions={false}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              />

              {onExportExcel && (
                <button
                  onClick={() => {
                    onExportExcel();
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Excel로 내보내기
                </button>
              )}

              {onExportPDF && (
                <button
                  onClick={() => {
                    onExportPDF();
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  PDF로 내보내기
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}