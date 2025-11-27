'use client';

import { useParams } from 'next/navigation';
import CoilProcessDetail from '@/components/process/CoilProcessDetail';

export default function CoilProcessDetailPage() {
  const params = useParams();
  const processId = parseInt(params?.id as string);

  return <CoilProcessDetail processId={processId} />;
}
