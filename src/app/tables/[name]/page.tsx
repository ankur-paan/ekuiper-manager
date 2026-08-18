'use client';
import { useParams } from 'next/navigation';
import { SqlResourceDetail } from '@/components/resources/sql-resource';
export default function TablePage() { const { name } = useParams<{ name: string }>(); return <SqlResourceDetail kind="table" name={decodeURIComponent(name)} />; }
