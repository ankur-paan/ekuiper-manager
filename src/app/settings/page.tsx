'use client';

import Link from 'next/link';
import { Database, KeyRound, Server, Settings, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <AppLayout title="Settings">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Manager settings</h2>
          <p className="mt-1 text-muted-foreground">
            Installation settings are deliberately small and predictable.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />eKuiper nodes</CardTitle>
              <CardDescription>Add nodes, check compatibility, and choose the default.</CardDescription>
            </CardHeader>
            <CardContent><Button asChild><Link href="/nodes">Manage nodes</Link></Button></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Users</CardTitle>
              <CardDescription>Add users and manage password resets.</CardDescription>
            </CardHeader>
            <CardContent><Button asChild variant="outline"><Link href="/users">Manage users</Link></Button></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Password</CardTitle>
              <CardDescription>Change your own Manager password.</CardDescription>
            </CardHeader>
            <CardContent><Button asChild variant="outline"><Link href="/change-password">Change password</Link></Button></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Persistence</CardTitle>
              <CardDescription>Manager state is stored centrally and migrated automatically at startup.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              No browser-only storage mode is used. Restarting the Manager does not lose users or node configuration.
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />eKuiper configuration</CardTitle>
            <CardDescription>
              Runtime configuration is changed only from values read from the selected eKuiper node. Unloaded defaults are never submitted.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppLayout>
  );
}
