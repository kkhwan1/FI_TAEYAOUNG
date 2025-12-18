'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scissors, Hammer, Flame, Paintbrush, X } from 'lucide-react';
import BlankingTab from './BlankingTab';
import ProcessTab from './ProcessTab';
import type { ProcessType, ProcessProductionRequest } from '@/types/processProduction';
import toast from 'react-hot-toast';

interface ProcessProductionTabsProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ProcessProductionTabs({ onSuccess, onCancel }: ProcessProductionTabsProps) {
  const [activeTab, setActiveTab] = useState<ProcessType>('BLANKING');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: ProcessProductionRequest) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/process-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || '생산등록 완료');
        if (result.warnings?.length > 0) {
          result.warnings.forEach((w: string) => toast(w, { duration: 4000 }));
        }
        // 성공 시 콜백 호출 (모달 닫기 및 데이터 새로고침)
        onSuccess?.();
      } else {
        toast.error(result.error || '생산등록 실패');
      }
    } catch {
      toast.error('생산등록 처리 중 오류 발생');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProcessType)}>
        <TabsList className="w-full grid grid-cols-4 bg-gray-100 p-1 rounded-t-lg">
          <TabsTrigger
            value="BLANKING"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow"
          >
            <Scissors className="w-4 h-4" />
            블랭킹
          </TabsTrigger>
          <TabsTrigger
            value="PRESS"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow"
          >
            <Hammer className="w-4 h-4" />
            프레스
          </TabsTrigger>
          <TabsTrigger
            value="WELD"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow"
          >
            <Flame className="w-4 h-4" />
            용접
          </TabsTrigger>
          <TabsTrigger
            value="PAINT"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow"
          >
            <Paintbrush className="w-4 h-4" />
            도장
          </TabsTrigger>
        </TabsList>

        <div className="p-6">
          <TabsContent value="BLANKING" className="mt-0">
            <BlankingTab onSubmit={handleSubmit} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="PRESS" className="mt-0">
            <ProcessTab
              processType="PRESS"
              title="프레스 생산등록"
              inputLabel="블랭크"
              outputLabel="성형품"
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="WELD" className="mt-0">
            <ProcessTab
              processType="WELD"
              title="용접 생산등록"
              inputLabel="성형품"
              outputLabel="용접품"
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="PAINT" className="mt-0">
            <ProcessTab
              processType="PAINT"
              title="도장 생산등록"
              inputLabel="용접품"
              outputLabel="완제품"
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
