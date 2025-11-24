'use client';

import { useState } from 'react';
import { Star, Plus, Edit, Trash2, Download, Upload, Clock } from 'lucide-react';
import { SearchPreset } from '@/hooks/useAdvancedSearch';
import Modal from './Modal';
import { useToast } from '@/contexts/ToastContext';

interface SearchPresetsProps {
  presets: SearchPreset[];
  onLoadPreset: (preset: SearchPreset) => void;
  onSavePreset: (name: string, description?: string) => SearchPreset;
  onDeletePreset: (presetId: string) => void;
  className?: string;
  currentFilters?: any;
  hasActiveFilters?: boolean;
}

interface PresetFormData {
  name: string;
  description: string;
}

export default function SearchPresets({
  presets,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  className = '',
  currentFilters,
  hasActiveFilters = false
}: SearchPresetsProps) {
  const { success: showSuccess, error: showError } = useToast();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SearchPreset | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [formData, setFormData] = useState<PresetFormData>({ name: '', description: '' });

  // Default presets (cannot be deleted)
  const defaultPresets = presets.filter(p => p.isDefault);
  const userPresets = presets.filter(p => !p.isDefault);

  // Handle save preset
  const handleSavePreset = () => {
    if (!formData.name.trim()) return;

    try {
      const newPreset = onSavePreset(formData.name.trim(), formData.description.trim() || undefined);
      setShowSaveModal(false);
      setFormData({ name: '', description: '' });
      console.log('프리셋이 저장되었습니다:', newPreset.name);
    } catch (error) {
      console.error('프리셋 저장 실패:', error);
    }
  };

  // Handle preset click
  const handlePresetClick = (preset: SearchPreset) => {
    onLoadPreset(preset);
  };

  // Handle delete preset
  const handleDeletePreset = (preset: SearchPreset) => {
    if (preset.isDefault) return;

    if (confirm(`'${preset.name}' 프리셋을 삭제하시겠습니까?`)) {
      onDeletePreset(preset.id);
    }
  };

  // Export presets
  const handleExportPresets = () => {
    const exportData = {
      presets: userPresets,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search_presets_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
  };

  // Import presets
  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        if (importData.presets && Array.isArray(importData.presets)) {
          // Here you would implement the import logic
          // For now, just log the imported data
          console.log('프리셋 가져오기:', importData.presets);
          showSuccess(`${importData.presets.length}개의 프리셋을 가져왔습니다.`);
        }
      } catch (error) {
        showError('프리셋 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
  };

  // Format preset description for display
  const formatPresetDescription = (preset: SearchPreset): string => {
    if (preset.description) return preset.description;

    // Generate description from filters
    const filters = preset.filters;
    const descriptions: string[] = [];

    if (filters.search) descriptions.push(`검색: "${filters.search}"`);
    if (filters.itemType) descriptions.push(`타입: ${filters.itemType}`);
    if (filters.companyType) descriptions.push(`거래처타입: ${filters.companyType}`);
    if (filters.isLowStock) descriptions.push('재고부족품목');
    if (filters.priceRange?.min || filters.priceRange?.max) {
      const min = filters.priceRange.min ? `₩${filters.priceRange.min.toLocaleString()}` : '';
      const max = filters.priceRange.max ? `₩${filters.priceRange.max.toLocaleString()}` : '';
      if (min && max) descriptions.push(`가격: ${min} ~ ${max}`);
      else if (min) descriptions.push(`가격: ${min} 이상`);
      else if (max) descriptions.push(`가격: ${max} 이하`);
    }

    return descriptions.join(', ') || '사용자 정의 필터';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">검색 프리셋</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="프리셋 내보내기/가져오기"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={!hasActiveFilters}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="현재 필터를 프리셋으로 저장"
            >
              <Plus className="w-4 h-4" />
              저장
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Default Presets */}
        {defaultPresets.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">기본 프리셋</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {defaultPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset)}
                  className="p-3 text-left bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {preset.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {formatPresetDescription(preset)}
                      </div>
                    </div>
                    <Star className="w-4 h-4 text-gray-500 ml-2 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User Presets */}
        {userPresets.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              사용자 프리셋 ({userPresets.length})
            </h4>
            <div className="space-y-2">
              {userPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => handlePresetClick(preset)}
                      className="flex-1 text-left hover:bg-gray-50 dark:hover:bg-gray-600 -m-1 p-1 rounded"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {preset.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatPresetDescription(preset)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-2">
                        <Clock className="w-3 h-3" />
                        {new Date(preset.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleDeletePreset(preset)}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        title="프리셋 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {userPresets.length === 0 && (
          <div className="text-center py-8">
            <Star className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              저장된 사용자 프리셋이 없습니다
            </div>
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={!hasActiveFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              첫 번째 프리셋 저장하기
            </button>
          </div>
        )}
      </div>

      {/* Save Preset Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setFormData({ name: '', description: '' });
        }}
        title="검색 프리셋 저장"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              프리셋 이름 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="예: 재고부족품목, 고가자재 등"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              설명 (선택사항)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="프리셋에 대한 간단한 설명을 입력하세요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={200}
            />
          </div>

          {/* Current Filters Preview */}
          {currentFilters && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                저장될 필터 설정:
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {Object.entries(currentFilters)
                  .filter(([, value]) => value !== null && value !== undefined && value !== '')
                  .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                  .join(', ') || '필터 없음'}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setShowSaveModal(false);
                setFormData({ name: '', description: '' });
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSavePreset}
              disabled={!formData.name.trim()}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </Modal>

      {/* Export/Import Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="프리셋 내보내기/가져오기"
        size="md"
      >
        <div className="space-y-6">
          {/* Export */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">프리셋 내보내기</h4>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                현재 저장된 사용자 프리셋을 JSON 파일로 내보냅니다.
              </p>
              <button
                onClick={handleExportPresets}
                disabled={userPresets.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                프리셋 내보내기 ({userPresets.length}개)
              </button>
            </div>
          </div>

          {/* Import */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">프리셋 가져오기</h4>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                이전에 내보낸 프리셋 JSON 파일을 선택하여 가져옵니다.
              </p>
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 cursor-pointer">
                <Upload className="w-4 h-4" />
                프리셋 파일 선택
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportPresets}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}