'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface Company {
  company_id?: number;
  company_name: string;
  company_type: 'CUSTOMER' | 'SUPPLIER' | 'PARTNER';
  business_number?: string;
  remarks?: string;
  contact_person?: string;
  phone?: string;
  fax?: string;
  mobile?: string;
  email?: string;
  address?: string;
  payment_terms?: number;
  notes?: string;
  is_active?: boolean;
  company_category?: string;
  business_info?: {
    business_type?: string;
    business_item?: string;
    main_products?: string;
    mobile?: string;
    website?: string;
    tax_email?: string;
    billing_email?: string;
    bank_account?: {
      bank_name?: string;
      account_no?: string;
      holder?: string;
    };
    credit_limit?: number;
    billing_cycle?: 'monthly' | 'biweekly' | 'weekly';
    payment_method?: 'cash' | 'transfer' | 'card' | 'mixed';
    currency?: string;
    vat_rate?: number;
    delivery_terms?: string;
    address_details?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
    contacts?: Array<{
      name?: string;
      role?: string;
      phone?: string;
      email?: string;
    }>;
    notes?: string;
  };
}

interface CompanyFormProps {
  company?: Company | null;
  onSubmit: (data: Company) => Promise<void>;
  onCancel: () => void;
}

export default function CompanyForm({ company, onSubmit, onCancel }: CompanyFormProps) {
  const [formData, setFormData] = useState<Company>({
    company_name: '',
    company_type: 'CUSTOMER',
    business_number: '',
    remarks: '',
    contact_person: '',
    phone: '',
    fax: '',
    mobile: '',
    email: '',
    address: '',
    payment_terms: 0,
    notes: '',
    is_active: true,
    company_category: '',
    business_info: {
      business_type: '',
      business_item: '',
      main_products: '',
      mobile: '',
      website: '',
      tax_email: '',
      billing_email: '',
      bank_account: {
        bank_name: '',
        account_no: '',
        holder: ''
      },
      credit_limit: 0,
      billing_cycle: undefined,
      payment_method: undefined,
      currency: 'KRW',
      vat_rate: 10,
      delivery_terms: '',
      address_details: {
        line1: '', line2: '', city: '', state: '', postal_code: '', country: ''
      },
      contacts: [],
      notes: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (company) {
      setFormData({
        ...company,
        payment_terms: company.payment_terms ?? 0,
        business_number: company.business_number ?? '',
        contact_person: company.contact_person ?? '',
        phone: company.phone ?? '',
        fax: (company as any).fax ?? '',
        mobile: company.mobile ?? '',
        email: company.email ?? '',
        address: company.address ?? '',
        remarks: company.remarks ?? '',
        notes: company.notes ?? '',
        company_category: company.company_category ?? '',
        business_info: {
          business_type: company.business_info?.business_type ?? '',
          business_item: company.business_info?.business_item ?? '',
          main_products: company.business_info?.main_products ?? '',
          mobile: company.business_info?.mobile ?? company.mobile ?? '',
          website: company.business_info?.website ?? '',
          tax_email: company.business_info?.tax_email ?? '',
          billing_email: company.business_info?.billing_email ?? '',
          bank_account: {
            bank_name: company.business_info?.bank_account?.bank_name ?? '',
            account_no: company.business_info?.bank_account?.account_no ?? '',
            holder: company.business_info?.bank_account?.holder ?? ''
          },
          credit_limit: company.business_info?.credit_limit ?? 0,
          billing_cycle: company.business_info?.billing_cycle,
          payment_method: company.business_info?.payment_method,
          currency: company.business_info?.currency ?? 'KRW',
          vat_rate: company.business_info?.vat_rate ?? 10,
          delivery_terms: company.business_info?.delivery_terms ?? '',
          address_details: {
            line1: company.business_info?.address_details?.line1 ?? '',
            line2: company.business_info?.address_details?.line2 ?? '',
            city: company.business_info?.address_details?.city ?? '',
            state: company.business_info?.address_details?.state ?? '',
            postal_code: company.business_info?.address_details?.postal_code ?? '',
            country: company.business_info?.address_details?.country ?? ''
          },
          contacts: company.business_info?.contacts ?? [],
          notes: company.business_info?.notes ?? company.notes ?? ''
        }
      });
    }
  }, [company]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseInt(value) : 0) : value
    }));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBusinessInfoChange = (field: 'business_type' | 'business_item' | 'main_products', value: string) => {
    setFormData(prev => ({
      ...prev,
      business_info: {
        ...prev.business_info,
        [field]: value
      }
    }));
  };

  const handleBusinessInfoDirectChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      business_info: {
        ...prev.business_info,
        [field]: value
      }
    }));
  };

  const handleNestedChange = (group: 'bank_account' | 'address_details', field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      business_info: {
        ...prev.business_info,
        [group]: {
          ...(prev.business_info as any)?.[group],
          [field]: value
        }
      }
    }));
  };

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      business_info: {
        ...prev.business_info,
        contacts: [ ...(prev.business_info?.contacts || []), { name: '', role: '', phone: '', email: '' } ]
      }
    }));
  };

  const updateContact = (index: number, key: 'name' | 'role' | 'phone' | 'email', value: string) => {
    setFormData(prev => {
      const contacts = [...(prev.business_info?.contacts || [])];
      contacts[index] = { ...contacts[index], [key]: value };
      return { ...prev, business_info: { ...prev.business_info, contacts } };
    });
  };

  const removeContact = (index: number) => {
    setFormData(prev => {
      const contacts = [...(prev.business_info?.contacts || [])];
      contacts.splice(index, 1);
      return { ...prev, business_info: { ...prev.business_info, contacts } };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = '거래처명은 필수입니다';
    }

    if (!formData.company_type) {
      newErrors.company_type = '거래처 타입은 필수입니다';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식을 입력해주세요';
    }

    if (formData.phone && !/^[\d-]+$/.test(formData.phone)) {
      newErrors.phone = '전화번호는 숫자와 하이픈(-)만 입력 가능합니다';
    }

    if (formData.mobile && !/^[\d-]+$/.test(formData.mobile)) {
      newErrors.mobile = '휴대폰번호는 숫자와 하이픈(-)만 입력 가능합니다';
    }

    if (formData.payment_terms && formData.payment_terms < 0) {
      newErrors.payment_terms = '결제조건은 0 이상이어야 합니다';
    }

    if (formData.business_info?.tax_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.business_info.tax_email)) {
      newErrors.tax_email = '세금용 이메일 형식이 올바르지 않습니다';
    }
    if (formData.business_info?.billing_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.business_info.billing_email)) {
      newErrors.billing_email = '청구서 이메일 형식이 올바르지 않습니다';
    }
    if ((formData.business_info?.credit_limit ?? 0) < 0) {
      newErrors.credit_limit = '신용한도는 0 이상이어야 합니다';
    }
    if (formData.business_info?.vat_rate !== undefined) {
      const vr = formData.business_info.vat_rate;
      if (vr! < 0 || vr! > 100) newErrors.vat_rate = '부가세율은 0~100 사이여야 합니다';
    }

    // Validate company_category if provided
    const validCategories = ['협력업체-원자재', '협력업체-외주', '소모품업체', '기타'];
    if (formData.company_category && !validCategories.includes(formData.company_category)) {
      newErrors.company_category = '올바른 거래처 분류를 선택해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // UI 상의 mobile/notes도 business_info에 일원화하여 전달
      const normalized = {
        ...formData,
        business_info: {
          ...formData.business_info,
          mobile: formData.business_info?.mobile || formData.mobile || '',
          notes: formData.business_info?.notes || formData.notes || ''
        }
      };
      await onSubmit(normalized);
      // 성공 시 자동으로 모달 닫기
      onCancel();
    } catch (error) {
      // 에러는 상위 컴포넌트에서 처리
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* 거래처명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            거래처명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.company_name ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 현대자동차"
          />
          {errors.company_name && (
            <p className="mt-1 text-sm text-red-500">{errors.company_name}</p>
          )}
        </div>

        {/* 거래처 타입 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            거래처 타입 <span className="text-red-500">*</span>
          </label>
          <select
            name="company_type"
            value={formData.company_type}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.company_type ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <option value="CUSTOMER">고객사</option>
            <option value="SUPPLIER">공급사</option>
            <option value="PARTNER">협력사</option>
          </select>
          {errors.company_type && (
            <p className="mt-1 text-sm text-red-500">{errors.company_type}</p>
          )}
        </div>

        {/* 사업자등록번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            사업자등록번호
          </label>
          <input
            type="text"
            name="business_number"
            value={formData.business_number || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 123-45-67890"
          />
        </div>

        {/* 담당자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            담당자
          </label>
          <input
            type="text"
            name="contact_person"
            value={formData.contact_person || ''}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: 홍길동"
          />
        </div>

        {/* 전화번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            전화번호
          </label>
          <input
            type="text"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.phone ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 02-1234-5678"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* 휴대폰번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            휴대폰번호
          </label>
          <input
            type="text"
            name="mobile"
            value={formData.mobile || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.mobile ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 010-1234-5678"
          />
          {errors.mobile && (
            <p className="mt-1 text-sm text-red-500">{errors.mobile}</p>
          )}
        </div>

        {/* 이메일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            이메일
          </label>
          <input
            type="email"
            name="email"
            value={formData.email || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: admin@company.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>

        {/* 결제조건 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            결제조건 (일)
          </label>
          <input
            type="number"
            name="payment_terms"
            value={formData.payment_terms ?? ''}
            onChange={handleChange}
            min="0"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.payment_terms ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="예: 30"
          />
          {errors.payment_terms && (
            <p className="mt-1 text-sm text-red-500">{errors.payment_terms}</p>
          )}
        </div>

        {/* 거래처 분류 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            거래처 분류
          </label>
          <select
            name="company_category"
            value={formData.company_category || ''}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.company_category ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <option value="">선택 안함</option>
            <option value="협력업체-원자재">협력업체 (원자재)</option>
            <option value="협력업체-외주">협력업체 (외주)</option>
            <option value="소모품업체">소모품업체</option>
            <option value="기타">기타</option>
          </select>
          {errors.company_category && (
            <p className="mt-1 text-sm text-red-500">{errors.company_category}</p>
          )}
        </div>
      </div>

      {/* 주소 - Full width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          주소
        </label>
        <input
          type="text"
          name="address"
          value={formData.address || ''}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="예: 서울특별시 강남구 테헤란로 123"
        />
      </div>

      {/* 사업자 정보 Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          사업자 정보 <span className="text-sm font-normal text-gray-500">(선택사항)</span>
        </h3>

        <div className="grid grid-cols-2 gap-6">
          {/* 업태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              업태
            </label>
            <input
              type="text"
              value={formData.business_info?.business_type || ''}
              onChange={(e) => handleBusinessInfoChange('business_type', e.target.value)}
              maxLength={100}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 제조업"
            />
          </div>

          {/* 종목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              종목
            </label>
            <input
              type="text"
              value={formData.business_info?.business_item || ''}
              onChange={(e) => handleBusinessInfoChange('business_item', e.target.value)}
              maxLength={100}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 자동차 부품"
            />
          </div>
        </div>

        {/* 주요품목 - Full width */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            주요품목
          </label>
          <textarea
            value={formData.business_info?.main_products || ''}
            onChange={(e) => handleBusinessInfoChange('main_products', e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
            placeholder="예: 브레이크 패드, 디스크 로터, 캘리퍼 부품"
          />
        </div>
      </div>

      {/* 비고 - Full width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          비고
        </label>
        <textarea
          name="remarks"
          value={formData.remarks || ''}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
          placeholder="세금계산서, 사급 관계 등 메모 입력"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              처리중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {company ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}