'use client';
import { useParams } from 'next/navigation';
import { SqlResourceDetail } from '@/components/resources/sql-resource';
export default function StreamPage() { const { name } = useParams<{ name: string }>(); return <SqlResourceDetail kind="stream" name={decodeURIComponent(name)} />; }
