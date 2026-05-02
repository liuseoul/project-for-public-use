export const runtime = 'edge'

// ── ONE-TIME BOOTSTRAP: create the super admin account ──────────
// Call once via POST with { "secret": "BOOTSTRAP_2026_DEHENG" }
// This route will be deleted after first use.

import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const BOOTSTRAP_SECRET = 'BOOTSTRAP_2026_DEHENG'
const SUPER_ADMIN_EMAIL = 'bjdeheng@163.com'
const SUPER_ADMIN_NAME  = '超级管理员'
const SUPER_ADMIN_PWD   = 'Deheng@2026!'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  if (body.secret !== BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Idempotent — skip if already exists
  const { data: existing } = await supabase
    .from('profiles').select('id').eq('email', SUPER_ADMIN_EMAIL).maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Super admin already exists', id: existing.id })
  }

  // Create Clerk user
  const clerk = await clerkClient()
  let clerkUser
  try {
    clerkUser = await clerk.users.createUser({
      emailAddress: [SUPER_ADMIN_EMAIL],
      password: SUPER_ADMIN_PWD,
      firstName: SUPER_ADMIN_NAME,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.errors?.[0]?.message || 'Clerk create failed' }, { status: 400 })
  }

  // Insert Supabase profile with is_super_admin = true
  const { error } = await supabase.from('profiles').insert({
    id:             clerkUser.id,
    name:           SUPER_ADMIN_NAME,
    email:          SUPER_ADMIN_EMAIL,
    role:           'admin',
    is_super_admin: true,
  })
  if (error) {
    await clerk.users.deleteUser(clerkUser.id).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: clerkUser.id, email: SUPER_ADMIN_EMAIL })
}
