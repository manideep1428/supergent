import { getSignInUrl, getSignUpUrl } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

function getSafeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return undefined;
  }

  return value;
}

export const GET = async (request: NextRequest) => {
  const returnTo = getSafeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const options = returnTo ? { returnTo } : undefined;
  const signInUrl =
    request.nextUrl.searchParams.get('screen_hint') === 'sign-up'
      ? await getSignUpUrl(options)
      : await getSignInUrl(options);

  return redirect(signInUrl);
};
