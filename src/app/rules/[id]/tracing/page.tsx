import { redirect } from 'next/navigation';
export default async function RuleTraceRedirect({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/rules/${encodeURIComponent(id)}?tab=trace`); }
