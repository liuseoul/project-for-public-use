export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Called right after client-side signInWithPassword succeeds.
 * Receives the access token directly (avoids cookie-propagation timing issues).
 * Determines redirect target:
 *   - super-admin  → { redirect: 'super-admin' }
 *   - normal user  → { redirect: 'groups', groups: [...] }
 */
export async function POST(req: Request) {
  const { accessToken } = await req.json()

  if (!accessToken) {
    return NextResponse.json({ redirect: 'login' }, { status: 401 })
  }

  // Create a client authenticated with the user's own token — reliable immediately after login
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ redirect: 'login' }, { status: 401 })
  }

  // Check super-admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.is_super_admin) {
    return NextResponse.json({ redirect: 'super-admin' })
  }

  // Fetch group memberships
  const { data: membership } = await supabase
    .from('group_members')
    .select('role, groups(id, name, description, subdomain)')
    .eq('user_id', user.id)
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
