export const runtime = 'edge'

// Called after Clerk signup completes to persist the profile in Supabase.

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { clerkUserId, name, email, affiliation } = body as {
    clerkUserId: string
    name: string
    email: string
    affiliation?: string
  }

  if (!clerkUserId || !name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Idempotent — upsert so duplicate calls don't fail
  const { error } = await supabase.from('profiles').upsert({
    id:          clerkUserId,
    name:        name.trim(),
    email:       email.trim().toLowerCase(),
    affiliation: affiliation?.trim() || null,
    role:        'member',
    is_super_admin: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
