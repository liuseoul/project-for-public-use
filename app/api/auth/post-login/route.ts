export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '@clerk/backend'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // Extract JWT from Authorization header (passed explicitly by the client)
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ redirect: 'login', _debug: 'no_token' }, { status: 401 })
  }

  let userId: string | null = null
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })
    userId = payload.sub
  } catch (e) {
    return NextResponse.json({ redirect: 'login', _debug: 'token_invalid', _err: String(e) }, { status: 401 })
  }

  if (!userId) {
    return NextResponse.json({ redirect: 'login', _debug: 'no_userid' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check super-admin flag
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .single()

  if (profile?.is_super_admin) {
    return NextResponse.json({ redirect: 'super-admin' })
  }

  // Temporary debug — remove after fixing
  if (!profile) {
    return NextResponse.json({ redirect: 'login', _debug: 'no_profile', _userId: userId }, { status: 401 })
  }

  // Fetch group memberships
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, groups(id, name, description, subdomain)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = (membership || []).map((m: any) => ({
    id:          m.groups?.id          || '',
    name:        m.groups?.name        || '',
    description: m.groups?.description || '',
    role:        m.role,
    subdomain:   m.groups?.subdomain   || null,
  })).filter((g: any) => g.id)

  return NextResponse.json({ redirect: 'groups', groups })
}
