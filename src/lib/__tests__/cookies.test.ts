import { useSecureCookies } from '@/lib/cookies';

describe('cookie transport policy', () => {
  afterEach(() => jest.restoreAllMocks());

  function useEnvironment(origin: string) {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: 'production',
      MANAGER_ORIGIN: origin,
    });
  }

  it('allows the documented plain HTTP installation to keep its session', () => {
    useEnvironment('http://localhost:3000');
    expect(useSecureCookies()).toBe(false);
  });

  it('sets Secure when the public installation origin is HTTPS', () => {
    useEnvironment('https://manager.example.test');
    expect(useSecureCookies()).toBe(true);
  });

  it('fails secure for an invalid production origin', () => {
    useEnvironment('not a url');
    expect(useSecureCookies()).toBe(true);
  });
});
