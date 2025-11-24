'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Filter, Mail, Phone, Shield, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface User {
  user_id: number;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  department?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('username');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const { success, error } = useToast();

  const roles = [
    { value: 'ceo', label: 'CEO', color: 'gray' },
    { value: 'admin', label: '관리자', color: 'purple' },
    { value: 'accountant', label: '회계 담당자', color: 'blue' },
    { value: 'manager', label: '매니저', color: 'blue' },
    { value: 'user', label: '사용자', color: 'green' },
    { value: 'viewer', label: '열람자', color: 'gray' },
    { value: 'operator', label: '운영자', color: 'yellow' }
  ];

  const getRoleLabel = (role: string): string => {
    return roles.find(r => r.value === role)?.label || role;
  };

  const getRoleBadgeColor = (role: string): string => {
    const colorMap: Record<string, string> = {
      ceo: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
      admin: 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900',
      accountant: 'bg-gray-500 text-white dark:bg-gray-400 dark:text-gray-900',
      manager: 'bg-gray-400 text-gray-900 dark:bg-gray-500 dark:text-white',
      user: 'bg-gray-300 text-gray-900 dark:bg-gray-600 dark:text-white',
      viewer: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      operator: 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
    };
    return colorMap[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, selectedRole]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedRole) params.set('role', selectedRole);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/users?${params}`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setUsers(result.data);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '사용자 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      error('사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    setShowAddModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowAddModal(true);
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('정말 이 사용자를 비활성화하시겠습니까?')) return;

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/users/${userId}`, {
        method: 'DELETE'
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        success('사용자가 비활성화되었습니다.');
        fetchUsers();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '사용자를 비활성화할 수 없습니다.');
      }
    } catch (err) {
      error('사용자를 비활성화하는 중 오류가 발생했습니다.');
    }
  };

  const handleSave = async (formData: any) => {
    try {
      const isEdit = editingUser !== null;
      const url = isEdit ? `/api/users/${editingUser.user_id}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {
        method,
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
        success(isEdit ? '사용자 정보가 수정되었습니다.' : '사용자가 생성되었습니다.');
        setShowAddModal(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error(extractErrorMessage(result.error) || '저장에 실패했습니다.');
      }
    } catch (err) {
      error('저장 중 오류가 발생했습니다.');
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const sortedUsers = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'username':
          aValue = a.username || '';
          bValue = b.username || '';
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'role':
          aValue = getRoleLabel(a.role);
          bValue = getRoleLabel(b.role);
          break;
        case 'department':
          aValue = a.department || '';
          bValue = b.department || '';
          break;
        case 'phone':
          aValue = a.phone || '';
          bValue = b.phone || '';
          break;
        case 'is_active':
          aValue = a.is_active ? 1 : 0;
          bValue = b.is_active ? 1 : 0;
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

    return sorted;
  }, [users, sortColumn, sortOrder]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">사용자 관리</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          시스템 사용자 계정을 관리합니다
        </p>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="이름, 사용자명, 이메일 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">모든 역할</option>
            {roles.map(role => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>

          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            사용자 추가
          </button>
        </div>
      </div>

      {/* 사용자 목록 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">사용자가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('username')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      사용자명
                      {sortColumn === 'username' ? (
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
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      이름
                      {sortColumn === 'name' ? (
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
                      onClick={() => handleSort('role')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      역할
                      {sortColumn === 'role' ? (
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
                      onClick={() => handleSort('department')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      부서
                      {sortColumn === 'department' ? (
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
                      onClick={() => handleSort('phone')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      연락처
                      {sortColumn === 'phone' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('is_active')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto"
                    >
                      상태
                      {sortColumn === 'is_active' ? (
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
                {sortedUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{user.name}</div>
                      {user.email && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {user.department || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.phone ? (
                        <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {user.phone}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                        title="수정"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.is_active && (
                        <button
                          onClick={() => handleDelete(user.user_id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="비활성화"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 사용자 추가/수정 모달 */}
      {showAddModal && (
        <UserFormModal
          user={editingUser}
          onClose={() => {
            setShowAddModal(false);
            setEditingUser(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// 사용자 추가/수정 모달 컴포넌트
function UserFormModal({ user, onClose, onSave }: {
  user: User | null;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'user',
    department: user?.department || '',
    is_active: user?.is_active ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 수정 시 비밀번호가 비어있으면 제외
    if (user && !formData.password) {
      const { password, ...submitData } = formData;
      onSave(submitData);
    } else {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          {user ? '사용자 수정' : '사용자 추가'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                사용자명 *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={!!user}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                비밀번호 {!user && '*'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!user}
                placeholder={user ? '변경하지 않으려면 비워두세요' : ''}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                역할 *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="ceo">CEO</option>
                <option value="admin">관리자</option>
                <option value="accountant">회계 담당자</option>
                <option value="manager">매니저</option>
                <option value="user">사용자</option>
                <option value="viewer">열람자</option>
                <option value="operator">운영자</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              부서
            </label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {user && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                활성 상태
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {user ? '수정' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

