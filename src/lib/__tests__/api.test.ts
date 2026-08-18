import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  normalizeUsername,
  readJsonObject,
  readBoundedJsonObject,
  requireUser,
  validateUsername,
} from '@/lib/api';

jest.mock('@/lib/auth/session', () => ({ getAuthenticatedUser: jest.fn() }));
const mockedGetUser = jest.mocked(getAuthenticatedUser);

describe('Manager API validation', () => {
  it('normalizes usernames consistently', () => {
    expect(normalizeUsername('Plant.Operator')).toBe('plant.operator');
  });

  it.each(['ab', 'with space', 'name/segment', 'a'.repeat(65), 42])(
    'rejects invalid username %s',
    (username) => expect(() => validateUsername(username)).toThrow(),
  );

  it('accepts a conservative local username', () => {
    expect(validateUsername(' plant.operator-1 ')).toBe('plant.operator-1');
  });

  it('requires exact same-origin mutations', () => {
    const accepted = new NextRequest('http://manager.test/api/action', {
      headers: { origin: 'http://manager.test' },
    });
    expect(() => assertSameOrigin(accepted)).not.toThrow();
    const rejected = new NextRequest('http://manager.test/api/action', {
      headers: { origin: 'https://other.test' },
    });
    expect(() => assertSameOrigin(rejected)).toThrow(/origin/i);
  });

  it('reads only JSON objects', async () => {
    const valid = new Request('http://manager.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ value: 1 }),
    });
    await expect(readJsonObject(valid)).resolves.toEqual({ value: 1 });
    const array = new Request('http://manager.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '[]',
    });
    await expect(readJsonObject(array)).rejects.toMatchObject({ status: 400 });
    const text = new Request('http://manager.test', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    await expect(readJsonObject(text)).rejects.toMatchObject({ status: 415 });
  });

  it('enforces session, owner, and forced-password rules', async () => {
    const request = new NextRequest('http://manager.test/api/private');
    mockedGetUser.mockResolvedValueOnce(null);
    await expect(requireUser(request)).rejects.toMatchObject({ status: 401 });
    mockedGetUser.mockResolvedValueOnce({ id: '1', username: 'user', role: 'USER', mustChangePassword: false });
    await expect(requireUser(request, { owner: true })).rejects.toMatchObject({ status: 403 });
    mockedGetUser.mockResolvedValueOnce({ id: '1', username: 'owner', role: 'OWNER', mustChangePassword: true });
    await expect(requireUser(request)).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    mockedGetUser.mockResolvedValueOnce({ id: '1', username: 'owner', role: 'OWNER', mustChangePassword: true });
    await expect(requireUser(request, { allowPasswordChange: true })).resolves.toMatchObject({ id: '1' });
  });

  it('formats expected API errors without exposing internals', async () => {
    const expected = apiErrorResponse(new ApiError(409, 'Conflict', 'CONFLICT'));
    expect(expected.status).toBe(409);
    await expect(expected.json()).resolves.toEqual({ error: { code: 'CONFLICT', message: 'Conflict' } });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const unexpected = apiErrorResponse(new Error('database credentials leaked'));
    expect(unexpected.status).toBe(500);
    await expect(unexpected.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed' },
    });
    consoleSpy.mockRestore();
  });
});

describe('readBoundedJsonObject', () => {
  test('accepts a small JSON object', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'ok' }),
    });
    await expect(readBoundedJsonObject(request, 100)).resolves.toEqual({ value: 'ok' });
  });

  test('rejects a streamed body beyond the byte limit', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'too large' }),
    });
    await expect(readBoundedJsonObject(request, 5)).rejects.toMatchObject({
      status: 413,
      code: 'REQUEST_TOO_LARGE',
    });
  });
});
