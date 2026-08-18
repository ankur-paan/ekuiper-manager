'use client';
import { useParams } from 'next/navigation';
import { RuleWorkspace } from '@/components/rules/rule-manager';
export default function RulePage() { const { id } = useParams<{ id: string }>(); return <RuleWorkspace id={decodeURIComponent(id)} />; }
