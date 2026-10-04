'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Check,
  Database,
  Globe,
  HelpCircle,
  KeyRound,
  Server,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  const [lang, setLang] = React.useState('en');

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('language');
      if (stored) setLang(stored);
    } catch {
      // safe fallback
    }
  }, []);

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    try {
      localStorage.setItem('language', newLang);
      toast.success(newLang === 'zh' ? '语言已切换为简体中文' : 'Language set to English (US)');
    } catch {
      // ignore
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="mx-auto max-w-4xl flex flex-col gap-6 pb-12">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Manager settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Control plane configuration, user authorization, and system preferences.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Node Management */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-5 text-primary" />
                eKuiper nodes
              </CardTitle>
              <CardDescription className="text-xs">
                Register edge clusters, inspect connection health, and switch active node.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link href="/nodes">Manage nodes</Link>
              </Button>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-5 text-primary" />
                Users & Roles
              </CardTitle>
              <CardDescription className="text-xs">
                Manage operator accounts, access roles, and audit security credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/users">Manage users</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Security Credentials */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-5 text-primary" />
                Password & Security
              </CardTitle>
              <CardDescription className="text-xs">
                Update account credentials and rotate access tokens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/change-password">Change password</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Documentation & Help */}
          <Card className="flex flex-col justify-between border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HelpCircle className="size-5 text-primary" />
                Documentation & Reference
              </CardTitle>
              <CardDescription className="text-xs">
                Architecture guides, streaming SQL syntax, and CLI operator manual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/help">Open help center</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Localization & Preferences */}
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-5 text-primary" />
              Language & Localization
            </CardTitle>
            <CardDescription className="text-xs">
              Select interface language. Settings are stored locally and synced with sub-components.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={lang === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLangChange('en')}
                className="gap-2 text-xs"
              >
                {lang === 'en' && <Check className="size-3.5" />}
                English (US)
              </Button>
              <Button
                variant={lang === 'zh' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLangChange('zh')}
                className="gap-2 text-xs"
              >
                {lang === 'zh' && <Check className="size-3.5" />}
                简体中文 (Chinese)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Persistence & Data Integrity */}
        <Card className="border-border/80 bg-card/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-5 text-primary" />
              Persistence Architecture
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Manager state is stored in central SQLite / PostgreSQL persistence and migrated automatically at startup.
              No ephemeral browser-only storage is used for cluster registration, preventing credential loss across container restarts.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppLayout>
  );
}
