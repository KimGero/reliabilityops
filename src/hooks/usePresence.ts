// ─── Fix imports ─────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import type { PresenceUser } from '../types/index.js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getLocalUserId, getLocalUserName, setLocalUserName } from '../lib/utils.js'

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [channel, setChannel]         = useState<RealtimeChannel | null>(null)
  const [userName, setUserNameState]  = useState(getLocalUserName)

  const updateName = useCallback((name: string) => {
    setLocalUserName(name)
    setUserNameState(name)
    channel?.track({ user_id: getLocalUserId(), user_name: name, online_at: new Date().toISOString() })
  }, [channel])

  useEffect(() => {
    const userId = getLocalUserId()
    const ch = supabase.channel('dashboard-presence', {
      config: { presence: { key: userId } },
    })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PresenceUser>()
      const users = Object.values(state).flat()
        .map((p: unknown) => p as PresenceUser)  // ← Fixed: explicit type cast
        .map(p => ({ user_id: p.user_id, user_name: p.user_name, online_at: p.online_at }))
        .reduce<PresenceUser[]>((acc, u) => {
          if (!acc.find(x => x.user_id === u.user_id)) acc.push(u)
          return acc
        }, [])
        .sort((a, b) => new Date(a.online_at).getTime() - new Date(b.online_at).getTime())
      setOnlineUsers(users)
    })
    .subscribe((status: string) => {  // ← Fixed: explicit type
      if (status === 'SUBSCRIBED') {
        ch.track({ user_id: userId, user_name: getLocalUserName(), online_at: new Date().toISOString() })
      }
    })

    setChannel(ch)
    return () => { ch.untrack(); supabase.removeChannel(ch) }
  }, [])

  return { onlineUsers, userName, updateName }
}