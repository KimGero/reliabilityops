import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import type { Organization, OrgRole } from '../types/index.js'

export interface OrgContext {
  orgId:    string
  orgName:  string
  orgSlug:  string
  role:     OrgRole
  canWrite: boolean   // admin or owner
  isOwner:  boolean
}

export function useOrganization() {
  const [ctx,     setCtx]     = useState<OrgContext | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('organization_users')
        .select('role, organizations(id, name, slug)')
        .eq('user_id', user.id)
        .single()

      if (data) {
        const org = data.organizations as unknown as Organization
        setCtx({
          orgId:    org.id,
          orgName:  org.name,
          orgSlug:  org.slug,
          role:     data.role as OrgRole,
          canWrite: data.role !== 'viewer',
          isOwner:  data.role === 'owner',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  return { ctx, loading }
}
