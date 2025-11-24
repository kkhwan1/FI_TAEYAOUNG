'use client';

import React, { useState, useEffect } from 'react';
import { Star, Trash2, X, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/contexts/ToastContext';

interface ItemImage {
  image_id: number;
  item_id: number;
  image_url: string;
  file_name?: string;
  file_size: number;
  mime_type?: string;
  is_primary: boolean;
  display_order: number;
  uploaded_at: string;
}

interface ItemImageGalleryProps {
  itemId: string;
  refreshTrigger?: number;
  onImageDeleted?: () => void;
}

export function ItemImageGallery({
  itemId,
  refreshTrigger,
  onImageDeleted
}: ItemImageGalleryProps) {
  const { error: showError } = useToast();
  const [images, setImages] = useState<ItemImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ItemImage | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);

  const loadImages = async () => {
    setLoading(true);
    setError(null);

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/items/${itemId}/images`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '이미지 목록 로드 실패');
      }

      setImages(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '이미지 로드 중 오류가 발생했습니다';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [itemId, refreshTrigger]);

  const handleDelete = async (imageId: number) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) return;

    setDeletingId(imageId);

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/items/${itemId}/images/${imageId}`, {
        method: 'DELETE'
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '이미지 삭제 실패');
      }

      setImages(prev => prev.filter(img => img.image_id !== imageId));
      onImageDeleted?.();
    } catch (err) {
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(err) || '이미지 삭제 중 오류가 발생했습니다');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    setSettingPrimaryId(imageId);

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/items/${itemId}/images/${imageId}/primary`, {
        method: 'PUT'
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (!result.success) {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '대표 이미지 설정 실패');
      }

      // Update local state
      setImages(prev =>
        prev.map(img => ({
          ...img,
          is_primary: img.image_id === imageId
        }))
      );
    } catch (err) {
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(extractErrorMessage(err) || '대표 이미지 설정 중 오류가 발생했습니다');
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>등록된 이미지가 없습니다</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div
            key={image.image_id}
            className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
          >
            {/* Primary Badge */}
            {image.is_primary && (
              <div className="absolute top-2 left-2 z-10 bg-gray-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                대표
              </div>
            )}

            {/* Image */}
            <div className="relative aspect-square bg-gray-100">
              <Image
                src={image.image_url}
                alt={image.file_name || `품목 이미지 ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => setSelectedImage(image)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-2 hover:bg-gray-100"
                  title="확대 보기"
                >
                  <ZoomIn className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>

            {/* Info & Actions */}
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900 truncate" title={image.file_name || `이미지 ${image.image_id}`}>
                {image.file_name || `이미지 ${image.image_id}`}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatFileSize(image.file_size)}
              </p>

              <div className="flex gap-2 mt-3">
                {!image.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(image.image_id)}
                    disabled={settingPrimaryId === image.image_id}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="대표 이미지로 설정"
                  >
                    {settingPrimaryId === image.image_id ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-700"></div>
                    ) : (
                      <>
                        <Star className="w-3 h-3" />
                        대표 설정
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => handleDelete(image.image_id)}
                  disabled={deletingId === image.image_id}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="이미지 삭제"
                >
                  {deletingId === image.image_id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-700"></div>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <Image
              src={selectedImage.image_url}
              alt={selectedImage.file_name || '확대된 품목 이미지'}
              width={1200}
              height={1200}
              className="object-contain max-w-full max-h-full"
            />
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white text-center">
            <p className="font-medium">{selectedImage.file_name || `이미지 ${selectedImage.image_id}`}</p>
            <p className="text-sm text-gray-300 mt-1">
              {formatFileSize(selectedImage.file_size)} · {selectedImage.is_primary && '대표 이미지'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
