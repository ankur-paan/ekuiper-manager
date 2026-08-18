import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import { withTransaction } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireUser(request, { owner: true });
    const { id } = await params;
    if (id === actor.id) {
      throw new ApiError(400, 'You cannot delete your own account', 'CANNOT_DELETE_SELF');
    }

    await withTransaction(async (client) => {
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const target = await client.query<{ role: 'OWNER' | 'USER' }>(
        'SELECT role FROM users WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!target.rows[0]) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
      if (target.rows[0].role === 'OWNER') {
        const owners = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM users
            WHERE role = 'OWNER' AND disabled_at IS NULL`,
        );
        if (Number(owners.rows[0].count) <= 1) {
          throw new ApiError(409, 'The last owner cannot be deleted', 'LAST_OWNER');
        }
      }
      await client.query('DELETE FROM users WHERE id = $1', [id]);
    });

    recordAuditSafely({
      actorId: actor.id,
      action: 'user.delete',
      resourceType: 'user',
      resourceId: id,
      success: true,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
