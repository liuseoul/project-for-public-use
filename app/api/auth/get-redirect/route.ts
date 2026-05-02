export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()
  const { userId, email } = body as { userId?: string; email?: string }

  if (!userId && !email) return NextResponse.json({ url: '/login' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let uid = userId || null

  // If we only have email, look up the profile id
  if (!uid && email) {
    const { data: profileByEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()
    uid = profileByEmail?.id || null
  }

  if (!uid) return NextResponse.json({ url: '/login' })

  // Check super-admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', uid)
    .single()

  if (profile?.is_super_admin) {
    return NextResponse.json({ url: '/super-admin', uid })
  }

  // Get first group membership
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups(subdomain)')
    .eq('user_id', uid)
    .limit(1)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subdomain = (membership as any)?.groups?.subdomain
  if (subdomain) return NextResponse.json({ url: `/${subdomain}/projects`, uid })

  // Profile exists but no group assigned yet — self-registered user awaiting admin
  return NextResponse.json({ url: '/pending', uid })
}
