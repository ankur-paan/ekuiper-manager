import { redirect } from 'next/navigation';
export default async function RuleStatusRedirect({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/rules/${encodeURIComponent(id)}?tab=status`); }
