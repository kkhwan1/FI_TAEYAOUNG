'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Edit2, Trash2, Building2, File, Download, X, Calendar, Save, XCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import Modal from '@/components/Modal';
import CompanySelect from '@/components/CompanySelect';
import FileUploadZone from '@/components/FileUploadZone';

interface Contract {
  contract_id: number;
  contract_no: string;
  contract_name: string;
  contract_type: string;
  company_id: number;
  company: {
    company_id: number;
    company_name: string;
  };
  start_date: string;
  end_date: string;
  total_amount: number;
  status: string;
  created_at: string;
  contract_date?: string;
  terms?: string;
  notes?: string;
}

interface Document {
  document_id: string;
  contract_id: string;
  document_url: string;
  original_filename: string;
  file_size: number;
  document_type?: string;
  mime_type?: string;
  file_type?: string;
  description?: string;
  uploaded_at: string;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  
  // 정렬 상태
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingContractId, setDeletingContractId] = useState<number | null>(null);
  
  // 상세보기 모달 상태
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  
  // 계약 추가 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_id: null as number | null,
    contract_name: '',
    contract_type: '매출계약',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    total_amount: 0,
    status: 'ACTIVE',
    terms: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [newContractId, setNewContractId] = useState<number | null>(null);
  
  const { success, error } = useToast();

  const contractTypes = [
    { value: '매출계약', label: '매출계약 (SC)', color: 'blue' },
    { value: '매입계약', label: '매입계약 (PC)', color: 'green' },
    { value: '협력계약', label: '협력계약 (CC)', color: 'purple' }
  ];

  const getTypeBadgeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      '매출계약': 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
      '매입계약': 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900',
      '협력계약': 'bg-gray-500 text-white dark:bg-gray-400 dark:text-gray-900'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const getStatusBadgeColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      '진행중': 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
      '만료': 'bg-gray-500 text-white dark:bg-gray-400 dark:text-gray-900',
      '해지': 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  useEffect(() => {
    fetchContracts();
  }, [searchTerm, selectedType]);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedType) params.set('contract_type', selectedType);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/contracts?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setContracts(result.data);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '계약 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      error('계약 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // 같은 컬럼 클릭 시 정렬 순서 토글
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 컬럼 클릭 시 해당 컬럼으로 정렬 (기본: 내림차순)
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  // 필터링 및 정렬된 계약 목록
  const filteredAndSortedContracts = contracts
    .filter(contract => {
      const matchesSearch = !searchTerm || 
        contract.contract_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.contract_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = !selectedType || contract.contract_type === selectedType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'contract_no':
          aValue = a.contract_no || '';
          bValue = b.contract_no || '';
          break;
        case 'contract_name':
          aValue = a.contract_name || '';
          bValue = b.contract_name || '';
          break;
        case 'contract_type':
          aValue = a.contract_type || '';
          bValue = b.contract_type || '';
          break;
        case 'company_name':
          aValue = a.company?.company_name || '';
          bValue = b.company?.company_name || '';
          break;
        case 'start_date':
          aValue = new Date(a.start_date || 0).getTime();
          bValue = new Date(b.start_date || 0).getTime();
          break;
        case 'total_amount':
          aValue = a.total_amount || 0;
          bValue = b.total_amount || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue, 'ko')
          : bValue.localeCompare(aValue, 'ko');
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

  // 상세보기 핸들러
  const handleViewDetails = async (contract: Contract) => {
    setSelectedContract(contract);
    setIsDetailModalOpen(true);
    await fetchDocuments(contract.contract_id);
  };

  // 문서 목록 조회
  const fetchDocuments = async (contractId: number) => {
    setDocumentsLoading(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/contracts/${contractId}/documents`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setDocuments(result.data || []);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '문서 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      error('문서 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setDocumentsLoading(false);
    }
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 문서 삭제 핸들러
  const handleDeleteDocument = async (docId: string) => {
    if (!selectedContract) return;
    
    if (!confirm('이 문서를 삭제하시겠습니까?')) return;
    
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(
        `/api/contracts/${selectedContract.contract_id}/documents?doc_id=${docId}`,
        { method: 'DELETE' },
        {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        }
      );
      
      if (result.success) {
        success('문서가 삭제되었습니다.');
        await fetchDocuments(selectedContract.contract_id);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '문서 삭제 실패');
      }
    } catch (err) {
      error('문서 삭제 중 오류가 발생했습니다.');
    }
  };

  // 계약 추가 핸들러
  const handleAddContract = () => {
    setIsAddModalOpen(true);
    setFormData({
      company_id: null,
      contract_name: '',
      contract_type: '매출계약',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      total_amount: 0,
      status: 'ACTIVE',
      terms: '',
      notes: ''
    });
  };

  // 계약 삭제
  const handleDelete = async (contract: Contract) => {
    if (!confirm(`계약번호 ${contract.contract_no}를 삭제하시겠습니까?`)) return;

    try {
      setDeletingContractId(contract.contract_id);
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/contracts?id=${contract.contract_id}`, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(contract.contract_id);
          return next;
        });
        success('계약이 삭제되었습니다.');
        fetchContracts();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '삭제 실패');
      }
    } catch (err) {
      error('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingContractId(null);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredAndSortedContracts.map(c => c.contract_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectItem = (contractId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(contractId);
      } else {
        next.delete(contractId);
      }
      return next;
    });
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`선택한 ${selectedIds.size}개 계약을 삭제하시겠습니까?`)) return;

    const idsToDelete = Array.from(selectedIds);
    setDeletingContractId(-1); // 일괄 삭제 중 표시

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const deletePromises = idsToDelete.map(id =>
        safeFetchJson(`/api/contracts?id=${id}`, {
          method: 'DELETE'
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      if (failed.length > 0) {
        error(`${failed.length}개 계약 삭제에 실패했습니다.`);
      } else {
        success(`${idsToDelete.length}개 계약이 삭제되었습니다.`);
      }

      setSelectedIds(new Set());
      fetchContracts();
    } catch (err) {
      error('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingContractId(null);
    }
  };

  // 계약 추가 제출
  const handleSubmitContract = async () => {
    if (!formData.company_id || !formData.contract_name || !formData.start_date || !formData.end_date) {
      error('필수 필드를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        const contractId = result.data.contract_id;
        setNewContractId(contractId);  // 파일 업로드용으로 저장
        success('계약이 추가되었습니다. 파일을 업로드할 수 있습니다.');
        // 모달은 파일 업로드 후 닫기
        // 계약 목록 새로고침
        await fetchContracts();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '계약 추가에 실패했습니다.');
      }
    } catch (err) {
      error('계약 추가 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">계약 관리</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          거래처 계약 정보를 관리합니다
        </p>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="계약번호, 계약명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">모든 계약 타입</option>
            {contractTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <button
            onClick={handleAddContract}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            계약 추가
          </button>
        </div>
      </div>

      {/* 일괄 삭제 버튼 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
            {selectedIds.size}개 항목 선택됨
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={deletingContractId === -1}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {deletingContractId === -1 ? '삭제 중...' : `선택 항목 삭제 (${selectedIds.size}개)`}
          </button>
        </div>
      )}

      {/* 계약 목록 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : filteredAndSortedContracts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">계약이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredAndSortedContracts.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('contract_no')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      계약번호
                      {sortColumn === 'contract_no' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('contract_name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      계약명
                      {sortColumn === 'contract_name' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('contract_type')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      타입
                      {sortColumn === 'contract_type' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('company_name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      거래처
                      {sortColumn === 'company_name' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('start_date')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      계약기간
                      {sortColumn === 'start_date' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('total_amount')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                    >
                      계약금액
                      {sortColumn === 'total_amount' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      상태
                      {sortColumn === 'status' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAndSortedContracts.map((contract) => (
                  <tr key={contract.contract_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contract.contract_id)}
                        onChange={(e) => handleSelectItem(contract.contract_id, e.target.checked)}
                        className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {contract.contract_no}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {contract.contract_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(contract.contract_type)}`}>
                        {contract.contract_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {contract.company?.company_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDate(contract.start_date)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        ~ {formatDate(contract.end_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(contract.total_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(contract.status)}`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(contract)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="상세"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contract)}
                          disabled={deletingContractId === contract.contract_id}
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="삭제"
                        >
                          {deletingContractId === contract.contract_id ? (
                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 계약 추가 모달 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="계약 추가"
        size="lg"
      >
        <div className="space-y-4">
          {/* 거래처 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              거래처 <span className="text-red-500">*</span>
            </label>
            <CompanySelect
              value={formData.company_id}
              onChange={(companyId) => setFormData({ ...formData, company_id: companyId })}
              placeholder="거래처를 선택하세요"
              required
            />
          </div>

          {/* 계약명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              계약명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.contract_name}
              onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="계약명을 입력하세요"
            />
          </div>

          {/* 계약 타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              계약 타입 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.contract_type}
              onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="매출계약">매출계약 (SC)</option>
              <option value="매입계약">매입계약 (PC)</option>
              <option value="협력계약">협력계약 (CC)</option>
            </select>
          </div>

          {/* 계약 기간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                종료일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* 계약 금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              계약 금액
            </label>
            <input
              type="number"
              value={formData.total_amount}
              onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="0"
              min="0"
              step="1000"
            />
          </div>

          {/* 조건 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              조건
            </label>
            <input
              type="text"
              value={formData.terms}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="조건을 입력하세요"
            />
          </div>

          {/* 파일 업로드 섹션 */}
          {newContractId && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                계약 문서 첨부
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                계약에 첨부할 문서를 업로드할 수 있습니다. (선택사항)
              </p>
              <FileUploadZone 
                contractId={newContractId}
                onUploadComplete={() => {
                  setIsAddModalOpen(false);
                  setNewContractId(null);
                  setFormData({
                    company_id: null,
                    contract_name: '',
                    contract_type: '매출계약',
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: '',
                    total_amount: 0,
                    status: 'ACTIVE',
                    terms: '',
                    notes: ''
                  });
                  fetchContracts();
                }}
              />
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmitContract}
              disabled={submitting || newContractId !== null}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              저장
            </button>
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setNewContractId(null);
              }}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              {newContractId ? '닫기' : '취소'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 계약 상세 모달 */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedContract(null);
          setDocuments([]);
        }} 
        title="계약 상세 정보" 
        size="lg"
      >
        {selectedContract && (
          <div className="space-y-6">
            {/* 계약 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계약번호</label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">{selectedContract.contract_no}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계약 타입</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(selectedContract.contract_type)}`}>
                  {selectedContract.contract_type}
                </span>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계약명</label>
                <p className="text-sm text-gray-900 dark:text-white">{selectedContract.contract_name}</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">거래처</label>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white">{selectedContract.company?.company_name}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계약 기간</label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatDate(selectedContract.start_date)} ~ {formatDate(selectedContract.end_date)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">계약금액</label>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(selectedContract.total_amount)}
                </p>
              </div>
              {selectedContract.terms && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">조건</label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedContract.terms}</p>
                </div>
              )}
            </div>

            {/* 첨부 문서 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <File className="w-4 h-4" />
                첨부 문서
              </h3>
              
              {/* 파일 업로드 섹션 추가 */}
              {selectedContract && !documentsLoading && (
                <div className="mb-4">
                  <FileUploadZone 
                    contractId={selectedContract.contract_id}
                    onUploadComplete={() => fetchDocuments(selectedContract.contract_id)}
                  />
                </div>
              )}
              
              {documentsLoading ? (
                <div className="text-center text-gray-500 py-4">로딩 중...</div>
              ) : documents.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">첨부된 문서가 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div 
                      key={doc.document_id} 
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {doc.original_filename}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(doc.file_size)} • {doc.document_type || doc.mime_type || '파일'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.open(doc.document_url, '_blank')}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600 rounded"
                          title="다운로드"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.document_id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-gray-600 rounded"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
