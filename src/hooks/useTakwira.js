import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function toMatch(row, people = []) {
  const date = row.starts_at ? new Date(row.starts_at) : null
  const host = people.find(p => p.id === row.host_id)
  const occupied = row.match_players?.length ?? 0
  return {
    id: row.id, sport: row.sport, title: row.title, venue: row.venue, area: row.area,
    date: date ? date.toLocaleDateString('fr-TN', { day: '2-digit', month: 'short' }) : 'قريباً',
    time: date ? date.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
    filled: occupied, total: row.total_players, level: row.skill_level,
    host: host?.display_name || 'لاعب Takwira', hostId: row.host_id,
    joined: false, status: row.status
  }
}

export function useTakwira() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [posts, setPosts] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSession(null)
      return
    }
    let alive = true
    supabase.auth.getSession().then(({ data, error: issue }) => {
      if (!alive) return
      if (issue) setError(issue.message)
      setSession(data.session)
    }).catch(issue => {
      if (alive) { setError(issue.message); setSession(null) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  const refresh = useCallback(async (currentUser = session?.user) => {
    if (!isSupabaseConfigured || !currentUser) return
    const [p, m, photos] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, city, position, preferred_sport, bio, avatar_url').order('created_at', { ascending: false }).limit(60),
      supabase.from('matches').select('id,host_id,sport,title,venue,area,starts_at,total_players,skill_level,status,match_players(player_id)').order('starts_at', { ascending: true, nullsFirst: false }).limit(80),
      supabase.from('posts').select('id,author_id,media_url,caption,created_at').order('created_at', { ascending: false }).limit(60)
    ])
    if (p.error || m.error || photos.error) {
      throw p.error || m.error || photos.error
    }
    const profiles = p.data || []
    setPlayers(profiles)
    setMatches((m.data || []).map(row => ({
      ...toMatch(row, profiles),
      joined: (row.match_players || []).some(item => item.player_id === currentUser.id)
    })))
    setPosts(photos.data || [])
  }, [session?.user])

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) {
      setProfile(null); setMatches([]); setPlayers([]); setPosts([])
      return
    }
    let cancelled = false
    const user = session.user
    async function init() {
      try {
        const { data: saved, error: readError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (readError) throw readError
        let current = saved
        if (!current) {
          const meta = user.user_metadata || {}
          const newProfile = {
            id: user.id,
            display_name: meta.display_name || meta.full_name || meta.name || user.email?.split('@')[0] || 'لاعب جديد'
          }
          const { data, error: insertError } = await supabase.from('profiles').upsert(newProfile, { onConflict: 'id', ignoreDuplicates: true }).select().maybeSingle()
          if (insertError) throw insertError
          current = data || (await supabase.from('profiles').select('*').eq('id', user.id).single()).data
        }
        if (!cancelled) {
          setProfile(current)
          await refresh(user)
        }
      } catch (issue) { if (!cancelled) setError(issue.message || 'تعذّر الاتصال بقاعدة البيانات') }
    }
    init()
    return () => { cancelled = true }
  }, [session?.user?.id, refresh])

  async function saveProfile(changes) {
    if (!session?.user) throw new Error('يلزمك تدخل لحسابك')
    setBusy(true)
    try {
      const values = {
        id: session.user.id,
        display_name: changes.name.trim(),
        city: changes.city.trim(),
        position: changes.position.trim(),
        preferred_sport: changes.sport,
        bio: changes.bio.trim(),
        ...(changes.avatar_url ? { avatar_url: changes.avatar_url } : {})
      }
      const { data, error: issue } = await supabase.from('profiles').upsert(values, { onConflict: 'id' }).select().single()
      if (issue) throw issue
      setProfile(data)
      await refresh()
      return data
    } finally { setBusy(false) }
  }

  async function uploadFile(file, bucket) {
    if (!session?.user) throw new Error('يلزمك تدخل لحسابك')
    if (!file?.type?.startsWith('image/')) throw new Error('اختار صورة فقط')
    if (file.size > 5 * 1024 * 1024) throw new Error('الصورة يلزم تكون أقل من 5MB')
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg'
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: issue } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false })
    if (issue) throw issue
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  async function uploadAvatar(file) {
    const avatar_url = await uploadFile(file, 'avatars')
    const current = profile || {}
    await saveProfile({
      name: current.display_name || 'لاعب جديد', city: current.city || '', position: current.position || '',
      sport: current.preferred_sport || 'football', bio: current.bio || '', avatar_url
    })
    return avatar_url
  }

  async function publishPhoto(file, caption = '') {
    const media_url = await uploadFile(file, 'player-media')
    const { error: issue } = await supabase.from('posts').insert({
      author_id: session.user.id, media_url, media_type: 'image', caption: caption.trim()
    })
    if (issue) throw issue
    await refresh()
    return media_url
  }

  async function createMatch(form) {
    if (!session?.user) throw new Error('يلزمك تدخل لحسابك باش تنشئ ماتش')
    if (!form.date) throw new Error('حدّد تاريخ الماتش')
    if (!form.time) throw new Error('حدّد الساعة')
    if (!form.venue.trim()) throw new Error('حدّد الملعب')
    setBusy(true)
    try {
      const { error: issue } = await supabase.from('matches').insert({
        host_id: session.user.id, sport: form.sport,
        title: form.title.trim() || 'ماتش جديد', venue: form.venue.trim(), area: form.area.trim(),
        starts_at: new Date(`${form.date}T${form.time}`).toISOString(),
        total_players: Number(form.total), skill_level: form.level, status: 'open'
      })
      if (issue) throw issue
      await refresh()
    } finally { setBusy(false) }
  }

  async function joinMatch(matchId) {
    if (!session?.user) throw new Error('يلزمك تدخل لحسابك باش تشارك')
    const { error: issue } = await supabase.from('match_players').insert({
      match_id: matchId, player_id: session.user.id, confirmed: true
    })
    if (issue) {
      if (issue.code === '23505') throw new Error('إنت مسجّل في الماتش هذا')
      throw issue
    }
    await refresh()
  }

  async function signOut() {
    if (!isSupabaseConfigured) return
    const { error: issue } = await supabase.auth.signOut()
    if (issue) throw issue
  }

  return {
    configured: isSupabaseConfigured, session, user: session?.user || null,
    loading: session === undefined, profile, matches, players, posts, busy, error,
    refresh, saveProfile, uploadAvatar, publishPhoto, createMatch, joinMatch, signOut
  }
}
