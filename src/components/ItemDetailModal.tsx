'use client';

import React, { useState } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { ImageUploadZone } from './ImageUploadZone';
import { ItemImageGallery } from './ItemImageGallery';
import { useToast } from '@/contexts/ToastContext';

interface ItemDetailModalProps {
  itemId: string;
  itemName: string;
  itemCode: string;
  onClose: () => void;
}

export function ItemDetailModal({
  itemId,
  itemName,
  itemCode,
  onClose
}: ItemDetailModalProps) {
  const { error: showError } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleImageDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-sm w-full max-w-5xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-gray-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{itemName}</h2>
                <p className="text-sm text-gray-500 mt-0.5">품목코드: {itemCode}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            <div className="space-y-6">
              {/* Upload Zone */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  이미지 업로드
                </h3>
                <ImageUploadZone
                  itemId={itemId}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={(error) => showError(error)}
                />
              </div>

              {/* Image Gallery */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  등록된 이미지
                </h3>
                <ItemImageGallery
                  itemId={itemId}
                  refreshTrigger={refreshTrigger}
                  onImageDeleted={handleImageDeleted}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
