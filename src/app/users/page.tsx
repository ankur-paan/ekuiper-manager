'use client';

import * as React from 'react';
import { Copy, KeyRound, MoreHorizontal, Plus, Shield, Trash2, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { ConfirmDialog } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserRecord {
  id: string;
  username: string;
  role: 'OWNER' | 'USER';
  mustChangePassword: boolean;
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

async function getError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.error?.message ?? `Request failed (${response.status})`;
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState('');
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [role, setRole] = React.useState<'OWNER' | 'USER'>('USER');
  const [saving, setSaving] = React.useState(false);
  const [temporaryPassword, setTemporaryPassword] = React.useState('');
  const [resetUser, setResetUser] = React.useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = React.useState<UserRecord | null>(null);

  const load = React.useCallback(async () => {
    const sessionResponse = await fetch('/api/auth/session', { cache: 'no-store' });
    const session = sessionResponse.ok ? await sessionResponse.json() : null;
    setCurrentUserId(session?.user?.id ?? '');
    if (session?.user?.role !== 'OWNER') {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    const response = await fetch('/api/users', { cache: 'no-store' });
    if (!response.ok) throw new Error(await getError(response));
    setUsers((await response.json()).users);
  }, []);

  React.useEffect(() => { void load().catch((reason) => toast.error(reason.message)); }, [load]);

  const createUser = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, role }),
      });
      if (!response.ok) throw new Error(await getError(response));
      const payload = await response.json();
      setTemporaryPassword(payload.temporaryPassword);
      setAddOpen(false);
      setUsername('');
      setRole('USER');
      await load();
      toast.success('User added');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetUser) return;
    const response = await fetch(`/api/users/${encodeURIComponent(resetUser.id)}/reset-password`, { method: 'POST' });
    if (!response.ok) toast.error(await getError(response));
    else {
      setTemporaryPassword((await response.json()).temporaryPassword);
      setResetUser(null);
      await load();
      toast.success('Password reset');
    }
  };

  const removeUser = async () => {
    if (!deleteUser) return;
    const response = await fetch(`/api/users/${encodeURIComponent(deleteUser.id)}`, { method: 'DELETE' });
    if (!response.ok) toast.error(await getError(response));
    else {
      setDeleteUser(null);
      await load();
      toast.success('User deleted');
    }
  };

  if (allowed === false) {
    return (
      <AppLayout title="Users">
        <Card className="mx-auto max-w-xl">
          <CardHeader><CardTitle>Owner access required</CardTitle><CardDescription>Only an owner can add, reset, or delete Manager users.</CardDescription></CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Users">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Manager users</h2>
            <p className="mt-1 text-muted-foreground">Simple local accounts for this installation.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add user</Button>
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Accounts</CardTitle><CardDescription>Resetting a password signs the user out everywhere.</CardDescription></CardHeader>
          <CardContent className="divide-y p-0">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-4 px-6 py-4" data-testid="user-row">
                <span className="rounded-full bg-muted p-2"><UserRound className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{user.username}</p>
                    <Badge variant={user.role === 'OWNER' ? 'default' : 'secondary'}>{user.role === 'OWNER' ? 'Owner' : 'User'}</Badge>
                    {user.mustChangePassword && <Badge variant="outline">Password change required</Badge>}
                    {user.id === currentUserId && <span className="text-xs text-muted-foreground">You</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Last sign in: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${user.username}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setResetUser(user)}><KeyRound className="mr-2 h-4 w-4" />Reset password</DropdownMenuItem>
                    {user.id !== currentUserId && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onSelect={() => setDeleteUser(user)}><Trash2 className="mr-2 h-4 w-4" />Delete user</DropdownMenuItem></>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add user</DialogTitle><DialogDescription>A temporary password is generated and shown once.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="new-username">Username</Label><Input id="new-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="operator" autoFocus /></div>
            <div className="space-y-2"><Label htmlFor="new-role">Role</Label><select id="new-role" value={role} onChange={(event) => setRole(event.target.value as 'OWNER' | 'USER')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="USER">User — operate eKuiper</option><option value="OWNER">Owner — also manage users and nodes</option></select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button data-testid="confirm-add-user" onClick={() => void createUser()} disabled={saving || !username}>{saving ? 'Adding…' : 'Add user'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(temporaryPassword)} onOpenChange={(open) => !open && setTemporaryPassword('')}>
        <DialogContent>
          <DialogHeader><DialogTitle>Temporary password</DialogTitle><DialogDescription>Copy this now. It will not be shown again, and the user must change it after signing in.</DialogDescription></DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted p-3"><code className="min-w-0 flex-1 break-all text-sm">{temporaryPassword}</code><Button variant="outline" size="icon" aria-label="Copy temporary password" onClick={() => { void navigator.clipboard.writeText(temporaryPassword); toast.success('Copied'); }}><Copy className="h-4 w-4" /></Button></div>
          <DialogFooter><Button onClick={() => setTemporaryPassword('')}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={Boolean(resetUser)} onOpenChange={(open) => !open && setResetUser(null)} title="Reset password?" description={`Reset ${resetUser?.username ?? 'this user'}'s password and revoke all active sessions?`} confirmLabel="Reset password" onConfirm={resetPassword} />
      <ConfirmDialog open={Boolean(deleteUser)} onOpenChange={(open) => !open && setDeleteUser(null)} title="Delete user?" description={`Permanently delete ${deleteUser?.username ?? 'this user'} and revoke all sessions?`} confirmLabel="Delete user" variant="danger" onConfirm={removeUser} />
    </AppLayout>
  );
}
