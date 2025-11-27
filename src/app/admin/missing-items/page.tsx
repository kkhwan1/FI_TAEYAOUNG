'use client';

import { useState } from 'react';

interface CheckResult {
  success: boolean;
  summary: {
    total: number;
    itemsNotInDB: number;
    itemsWithoutBOM: number;
    itemsWithoutTemplate: number;
    itemsComplete: number;
  };
  details: {
    itemsNotInDB: Array<{ code: string; name: string }>;
    itemsWithoutBOM: Array<{ code: string; name: string; item_id: number }>;
    itemsWithoutTemplate: Array<{ code: string; name: string; item_id: number; bom_ids: number[] }>;
    itemsComplete: Array<{ code: string; name: string; item_id: number }>;
  };
}

interface AddResult {
  success: boolean;
  message?: string;
  summary: {
    total: number;
    itemsAdded: number;
    bomsAdded: number;
    templatesAdded: number;
    errors: number;
  };
  details: {
    itemsAdded: Array<{ code: string; name: string; item_id: number }>;
    bomsAdded: Array<{ code: string; bom_id: number }>;
    templatesAdded: Array<{ code: string; template_id: number }>;
    errors: Array<{ code: string; error: string }>;
  };
}

export default function MissingItemsPage() {
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [addResult, setAddResult] = useState<AddResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/add-missing-items');
      const data = await response.json();
      setCheckResult(data);
      setAddResult(null);
    } catch (error) {
      console.error('확인 중 오류:', error);
      alert('확인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!confirm('인알파코리아 누락 품목 20개를 DB에 추가하시겠습니까?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/add-missing-items', {
        method: 'POST',
      });
      const data = await response.json();
      setAddResult(data);

      // 추가 후 다시 확인
      if (data.success) {
        setTimeout(handleCheck, 1000);
      }
    } catch (error) {
      console.error('추가 중 오류:', error);
      alert('추가 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">인알파코리아 누락 품목 관리</h1>

      <div className="mb-6 space-x-4">
        <button
          onClick={handleCheck}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? '확인 중...' : '현재 상태 확인'}
        </button>
        <button
          onClick={handleAdd}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {loading ? '추가 중...' : '누락 품목 추가'}
        </button>
      </div>

      {checkResult && (
        <div className="mb-6 p-4 bg-white rounded shadow">
          <h2 className="text-xl font-semibold mb-4">현재 상태</h2>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-red-100 rounded">
              <div className="text-sm text-gray-600">Items 없음</div>
              <div className="text-2xl font-bold">{checkResult.summary.itemsNotInDB}</div>
            </div>
            <div className="p-4 bg-yellow-100 rounded">
              <div className="text-sm text-gray-600">BOM 없음</div>
              <div className="text-2xl font-bold">{checkResult.summary.itemsWithoutBOM}</div>
            </div>
            <div className="p-4 bg-orange-100 rounded">
              <div className="text-sm text-gray-600">템플릿 없음</div>
              <div className="text-2xl font-bold">{checkResult.summary.itemsWithoutTemplate}</div>
            </div>
            <div className="p-4 bg-green-100 rounded">
              <div className="text-sm text-gray-600">완료</div>
              <div className="text-2xl font-bold">{checkResult.summary.itemsComplete}</div>
            </div>
          </div>

          {checkResult.details.itemsNotInDB.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-red-700">Items 테이블에 없는 품번</h3>
              <ul className="list-disc list-inside space-y-1">
                {checkResult.details.itemsNotInDB.map((item) => (
                  <li key={item.code} className="text-sm">
                    {item.code} - {item.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkResult.details.itemsWithoutBOM.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-yellow-700">BOM 등록 안된 품번</h3>
              <ul className="list-disc list-inside space-y-1">
                {checkResult.details.itemsWithoutBOM.map((item) => (
                  <li key={item.code} className="text-sm">
                    {item.code} - {item.name} (item_id: {item.item_id})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkResult.details.itemsWithoutTemplate.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-orange-700">템플릿 매핑 안된 품번</h3>
              <ul className="list-disc list-inside space-y-1">
                {checkResult.details.itemsWithoutTemplate.map((item) => (
                  <li key={item.code} className="text-sm">
                    {item.code} - {item.name} (item_id: {item.item_id})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checkResult.details.itemsComplete.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2 text-green-700">완료된 품번</h3>
              <ul className="list-disc list-inside space-y-1">
                {checkResult.details.itemsComplete.map((item) => (
                  <li key={item.code} className="text-sm">
                    {item.code} - {item.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {addResult && (
        <div className="mb-6 p-4 bg-white rounded shadow">
          <h2 className="text-xl font-semibold mb-4">
            추가 결과 {addResult.success ? '✅' : '❌'}
          </h2>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-blue-100 rounded">
              <div className="text-sm text-gray-600">Items 추가</div>
              <div className="text-2xl font-bold">{addResult.summary.itemsAdded}</div>
            </div>
            <div className="p-4 bg-purple-100 rounded">
              <div className="text-sm text-gray-600">BOM 추가</div>
              <div className="text-2xl font-bold">{addResult.summary.bomsAdded}</div>
            </div>
            <div className="p-4 bg-indigo-100 rounded">
              <div className="text-sm text-gray-600">템플릿 추가</div>
              <div className="text-2xl font-bold">{addResult.summary.templatesAdded}</div>
            </div>
            <div className="p-4 bg-red-100 rounded">
              <div className="text-sm text-gray-600">오류</div>
              <div className="text-2xl font-bold">{addResult.summary.errors}</div>
            </div>
          </div>

          {addResult.details.itemsAdded.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-blue-700">추가된 Items</h3>
              <ul className="list-disc list-inside space-y-1">
                {addResult.details.itemsAdded.map((item) => (
                  <li key={item.code} className="text-sm">
                    {item.code} - {item.name} (item_id: {item.item_id})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {addResult.details.errors.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-red-700">오류 발생</h3>
              <ul className="list-disc list-inside space-y-1">
                {addResult.details.errors.map((error) => (
                  <li key={error.code} className="text-sm">
                    {error.code}: {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {addResult.message && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 rounded">
              {addResult.message}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="text-lg font-semibold mb-3">사용 방법</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>"현재 상태 확인" 버튼을 클릭하여 누락된 품목 현황 파악</li>
          <li>"누락 품목 추가" 버튼을 클릭하여 자동으로 DB에 추가</li>
          <li>추가 후 자동으로 다시 확인하여 결과 확인</li>
          <li>모든 품목이 "완료" 상태가 되면 작업 완료</li>
        </ol>
        <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-500 text-sm">
          <p className="font-semibold">주의사항:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>BOM 자재 구성(child_item_id)은 임시로 자기 자신으로 설정됩니다</li>
            <li>실제 자재 구성은 BOM 관리 화면에서 별도로 입력해야 합니다</li>
            <li>품목 단가(unit_price)는 0으로 초기화되므로 추후 업데이트 필요</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
