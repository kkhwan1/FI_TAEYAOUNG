'use client';

import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Search,
  Calendar,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useToastNotification } from '@/hooks/useToast';

interface ProductionTransaction {
  transaction_id: number;
  transaction_date: string;
  transaction_type: string;
  reference_number: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  notes: string | null;
  items: {
    item_code: string;
    item_name: string;
    spec: string;
    unit: string;
  };
  users: {
    username: string;
  };
  created_at: string;
}

export default function ProductionHistoryTable() {
  const [transactions, setTransactions] = useState<ProductionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const toast = useToastNotification();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory/production');
      const data = await response.json();

      if (data.success) {
        setTransactions(data.data.transactions || []);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        toast.error('조회 실패', extractErrorMessage(data.error) || '생산 내역을 불러올 수 없습니다');
      }
    } catch (error) {
      toast.error('오류 발생', '생산 내역을 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // TASK-022: Table sorting with useMemo optimization
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // Reset to no sorting
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) {
      return (
        <div className="inline-flex flex-col ml-1">
          <ChevronUp className="h-3 w-3 text-gray-400" />
          <ChevronDown className="h-3 w-3 text-gray-400 -mt-2" />
        </div>
      );
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  const sortedAndFilteredTransactions = useMemo(() => {
    // Filter first
    const filtered = transactions.filter(transaction => {
      const matchesSearch =
        transaction.items?.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.items?.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transaction.reference_number && transaction.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;

      return matchesSearch && matchesType;
    });

    // Sort if sortKey is set
    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      // Handle nested object paths (items.item_name, users.username)
      if (sortKey.includes('.')) {
        const keys = sortKey.split('.');
        aVal = keys.reduce((obj, key) => obj?.[key], a as any);
        bVal = keys.reduce((obj, key) => obj?.[key], b as any);
      } else {
        aVal = (a as any)[sortKey];
        bVal = (b as any)[sortKey];
      }

      // Handle null values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Type-specific comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'ko-KR');
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      return 0;
    });
  }, [transactions, searchTerm, typeFilter, sortKey, sortDirection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="품목명, 품목코드, 참조번호로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="거래유형 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="생산입고">생산입고</SelectItem>
            <SelectItem value="생산출고">생산출고</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchTransactions} variant="outline">
          새로고침
        </Button>
      </div>

      {/* Table */}
      {sortedAndFilteredTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">

          <p>생산 내역이 없습니다</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <button
                    onClick={() => handleSort('transaction_date')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    거래일자
                    {getSortIcon('transaction_date')}
                  </button>
                </TableHead>
                <TableHead className="w-[100px]">
                  <button
                    onClick={() => handleSort('transaction_type')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    거래유형
                    {getSortIcon('transaction_type')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('items.item_name')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    품목정보
                    {getSortIcon('items.item_name')}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('quantity')}
                    className="flex items-center ml-auto hover:text-foreground transition-colors"
                  >
                    수량
                    {getSortIcon('quantity')}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('unit_price')}
                    className="flex items-center ml-auto hover:text-foreground transition-colors"
                  >
                    단가
                    {getSortIcon('unit_price')}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('total_amount')}
                    className="flex items-center ml-auto hover:text-foreground transition-colors"
                  >
                    금액
                    {getSortIcon('total_amount')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('reference_number')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    참조번호
                    {getSortIcon('reference_number')}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('users.username')}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    작성자
                    {getSortIcon('users.username')}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredTransactions.map((transaction) => (
                <TableRow key={transaction.transaction_id}>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {(() => {
                          const date = transaction.created_at || transaction.transaction_date;
                          const d = new Date(date);
                          return (
                            <>
                              <span>
                                {d.toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                }).replace(/\. /g, '.').replace(/\.$/, '')}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">
                                {d.toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={transaction.transaction_type === '생산입고' ? 'default' : 'secondary'}
                    >
                      {transaction.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{transaction.items?.item_name ?? '(품목 정보 없음)'}</div>
                      <div className="text-xs text-muted-foreground">
                        [{transaction.items?.item_code ?? 'N/A'}] {transaction.items?.spec ?? ''}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.quantity.toLocaleString('ko-KR')} {transaction.items?.unit ?? ''}
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.unit_price.toLocaleString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {transaction.total_amount.toLocaleString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    {transaction.reference_number ? (
                      <div className="flex items-center gap-1 text-sm">
                        
                        {transaction.reference_number}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {transaction.users?.username ?? '(작성자 정보 없음)'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
