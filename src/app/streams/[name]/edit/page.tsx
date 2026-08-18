'use client';
import { useParams } from 'next/navigation';
import { SqlResourceEditor } from '@/components/resources/sql-resource';
export default function EditStreamPage() { const { name } = useParams<{ name: string }>(); return <SqlResourceEditor kind="stream" name={decodeURIComponent(name)} />; }
