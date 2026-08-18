'use client';
import { useParams } from 'next/navigation';
import { RuleDesigner } from '@/components/rules/rule-designer';

export default function EditRulePage() {
  const { id } = useParams<{ id: string }>();
  return <RuleDesigner id={decodeURIComponent(id)} />;
}
