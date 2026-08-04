import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase-server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/conta', request.url));
}
