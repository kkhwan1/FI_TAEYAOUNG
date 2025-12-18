'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  maxHeight?: 'auto' | 'tall';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  maxHeight = 'auto'
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    '3xl': 'max-w-[85vw]',
    '4xl': 'max-w-[90vw]',
    full: 'max-w-[95vw]'
  };

  const heightClasses = {
    auto: '',
    tall: 'min-h-[85vh] max-h-[95vh]'
  };

  const contentHeightClasses = {
    auto: '',
    tall: 'flex-1 min-h-0 overflow-y-auto'
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop - explicit z-index 1, aria-hidden */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        style={{ zIndex: 1 }}
      />

      {/* Modal Container - z-index 10, pointer-events control */}
      <div
        className="flex min-h-full items-center justify-center p-4 pointer-events-none"
        style={{ position: 'relative', zIndex: 10, overflow: 'visible' }}
      >
        {/* Modal Content - pointer-events restored, propagation stopped */}
        <div
          className={`relative bg-white dark:bg-gray-900 rounded-lg shadow-sm w-full ${sizeClasses[size]} ${heightClasses[maxHeight]} transform transition-all pointer-events-auto flex flex-col`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          style={{ overflow: 'visible' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            {title && (
              <h2
                id="modal-title"
                className="text-xl font-semibold text-gray-900 dark:text-white"
              >
                {title}
              </h2>
            )}
            <button
              onClick={onClose}
              className="ml-auto text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className={`p-6 ${contentHeightClasses[maxHeight]}`} style={{ overflowY: 'auto', overflowX: 'visible', position: 'relative', maxHeight: maxHeight === 'tall' ? 'calc(95vh - 120px)' : 'none' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}