'use client';
import { useParams } from 'next/navigation';
import { SqlResourceEditor } from '@/components/resources/sql-resource';
export default function EditTablePage() { const { name } = useParams<{ name: string }>(); return <SqlResourceEditor kind="table" name={decodeURIComponent(name)} />; }
