'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthStatus {
  setupRequired: boolean;
  authenticated: boolean;
  user?: { mustChangePassword: boolean } | null;
}

function errorMessage(payload: unknown): string {
  return (payload as { error?: { message?: string } })?.error?.message ?? 'The request failed';
}

export default function WelcomePage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<AuthStatus | null>(null);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/auth/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Manager database is not ready');
        return response.json();
      })
      .then((value: AuthStatus) => {
        if (value.authenticated) {
          router.replace(value.user?.mustChangePassword ? '/change-password' : '/dashboard');
        } else {
          setStatus(value);
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Manager is not ready'));
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!status) return;
    if (status.setupRequired && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(status.setupRequired ? '/api/auth/bootstrap' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      router.replace(payload.user?.mustChangePassword ? '/change-password' : '/dashboard');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
            <Workflow className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">eKuiper Manager</h1>
            <p className="text-sm text-muted-foreground">A focused workspace for your eKuiper nodes</p>
          </div>
        </div>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{status?.setupRequired ? 'Create the owner account' : 'Sign in'}</CardTitle>
            <CardDescription>
              {status?.setupRequired
                ? 'This account controls nodes and can add other users.'
                : 'Use your Manager account to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={!status || submitting}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={status?.setupRequired ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={!status || submitting}
                  minLength={status?.setupRequired ? 12 : undefined}
                  required
                />
                {status?.setupRequired && (
                  <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
                )}
              </div>
              {status?.setupRequired && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
              )}
              {error && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={!status || submitting}>
                {submitting ? 'Please wait…' : status?.setupRequired ? 'Complete setup' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Credentials remain in this installation.
        </p>
      </div>
    </main>
  );
}
