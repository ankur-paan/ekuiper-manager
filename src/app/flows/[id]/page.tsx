'use client';

import { useParams } from 'next/navigation';
import { FlowStudioPage } from '@/components/flow-studio/flow-studio-page';

export default function FlowDraftPage() {
  const { id } = useParams<{ id: string }>();
  return <FlowStudioPage flowId={decodeURIComponent(id)} />;
}
