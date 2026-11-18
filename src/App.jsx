import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, Bell, CalendarDays, CheckCircle2, CirclePlus, Compass, ImagePlus, LogOut, MapPin, Plus, Search, Settings2, ShieldCheck, Trophy, Users, X, UserRound, Clock3, Camera, Pencil, RefreshCw } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import AuthModal from './components/AuthModal'
import './app-mobile.css'

const sports = {
  football: { label: 'كرة القدم', icon: '⚽', tint: 'green' },
  handball: { label: 'كرة اليد', icon: '🤾', tint: 'blue' },
  basketball: { label: 'كرة السلة', icon: '🏀', tint: 'orange' },
  volleyball: { label: 'كرة الطائرة', icon: '🏐', tint: 'purple' }
}
const emptyForm = { sport: 'football', title: '', venue: '', area: '', date: '', time: '19:30', total: 10, skill_level: 'مفتوح' }
const prettyDate = date => date ? new Date(date).toLocaleDateString('ar-TN', { day: 'numeric', month: 'short' }) : 'الوقت يتحدّد'
const prettyTime = date => date ? new Date(date).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' }) : '--:--'
const initials = name => (name || 'Takwira').split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()

function Avatar({ name, url, small = false }) {
  return <span className={'avatar t24-avatar' + (small ? ' avatar-small' : '')}>
    {url ? <img src={url} alt={name || 'صورة اللاعب'} onError={event => { event.currentTarget.style.display = 'none' }} /> : initials(name)}
  </span>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [profile, setProfile] = useState(null)
  const [players, setPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [lineup, setLineup] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [sport, setSport] = useState('all')
  const [query, setQuery] = useState('')
  const [newMatchOpen, setNewMatchOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const notice = message => { setToast(message); setTimeout(() => setToast(''), 3600) }
  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || 'لاعب جديد'
  const visible = useMemo(() => matches.filter(m =>
    (sport === 'all' || m.sport === sport) &&
    (m.title + ' ' + m.venue + ' ' + m.area).toLowerCase().includes(query.toLowerCase()) &&
    (activeTab !== 'matches' || m.host_id === user?.id || lineup.some(l => l.match_id === m.id && l.player_id === user?.id))
  ), [matches, sport, query, activeTab, user, lineup])

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message)
      setUser(data?.session?.user || null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function ensureProfile(current) {
    const { data: found, error: readError } = await supabase.from('t24_profiles').select('*').eq('id', current.id).maybeSingle()
    if (readError) throw readError
    if (found) return found
    const fallbackName = current.user_metadata?.display_name || current.user_metadata?.full_name || current.user_metadata?.name || current.email?.split('@')[0] || 'لاعب'
    const { data: created, error: createError } = await supabase.from('t24_profiles').insert({
      id: current.id, display_name: fallbackName, city: '', sport: 'football', position: '', bio: ''
    }).select().single()
    if (createError && createError.code === '23505') {
      const { data } = await supabase.from('t24_profiles').select('*').eq('id', current.id).single()
      return data
    }
    if (createError) throw createError
    return created
  }

  async function refreshData(current = user) {
    if (!current || !isSupabaseConfigured) return
    setLoading(true)
    try {
      const own = await ensureProfile(current)
      setProfile(own)
      const [peopleResult, gamesResult, lineupResult] = await Promise.all([
        supabase.from('t24_profiles').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('t24_matches').select('*').order('starts_at', { ascending: true, nullsFirst: false }).limit(150),
        supabase.from('t24_lineup').select('*').limit(500)
      ])
      for (const item of [peopleResult, gamesResult, lineupResult]) if (item.error) throw item.error
      setPlayers(peopleResult.data || [])
      setMatches(gamesResult.data || [])
      setLineup(lineupResult.data || [])
    } catch (cause) {
      setError(cause.message || 'صار مشكل في الاتصال بقاعدة البيانات.')
    } finally { setLoading(false) }
  }
  useEffect(() => {
    if (user) { setError(''); refreshData(user) }
    else { setProfile(null); setPlayers([]); setMatches([]); setLineup([]); setSelectedMatch(null) }
  }, [user?.id])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    const channel = supabase.channel('takwira24-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_matches' }, () => refreshData(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_lineup' }, () => refreshData(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_profiles' }, () => refreshData(user))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const requireLogin = action => {
    if (!user) { setAuthOpen(true); notice('سجّل الدخول باش تكمّل'); return false }
    if (action) action()
    return true
  }
  const openMatch = () => requireLogin(() => { setForm(emptyForm); setNewMatchOpen(true) })
  const openProfileEditor = () => requireLogin(() => { setDraft(profile || {}); setEditProfileOpen(true) })

  async function createMatch(event) {
    event.preventDefault()
    if (!requireLogin()) return
    setBusy(true)
    try {
      await ensureProfile(user)
      const starts = form.date && form.time ? new Date(form.date + 'T' + form.time).toISOString() : null
      if (starts && new Date(starts).getTime() < Date.now()) throw new Error('اختار تاريخ في المستقبل.')
      const { data, error: insertError } = await supabase.from('t24_matches').insert({
        host_id: user.id, sport: form.sport, title: form.title.trim() || 'ماتش ' + sports[form.sport].label,
        venue: form.venue.trim(), area: form.area.trim(), starts_at: starts,
        total_players: Number(form.total), skill_level: form.skill_level
      }).select().single()
      if (insertError) throw insertError
      setNewMatchOpen(false)
      setSelectedMatch(data.id)
      await refreshData(user)
      notice('الماتش تحفّظ في Supabase! ⚽')
    } catch (cause) { notice('ما نجّمش نحفظ الماتش: ' + cause.message) }
    finally { setBusy(false) }
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (!user) return
    setBusy(true)
    try {
      const payload = {
        id: user.id, display_name: (draft.display_name || '').trim() || 'لاعب',
        city: draft.city || '', sport: draft.sport || 'football',
        position: draft.position || '', bio: draft.bio || '',
        avatar_url: draft.avatar_url || null, updated_at: new Date().toISOString()
      }
      const { data, error: updateError } = await supabase.from('t24_profiles').upsert(payload).select().single()
      if (updateError) throw updateError
      setProfile(data); setEditProfileOpen(false)
      await refreshData(user)
      notice('تسجّل الـProfile متاعك بنجاح')
    } catch (cause) { notice('ما نجّمش نحفظ الملف: ' + cause.message) }
    finally { setBusy(false) }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0]
    if (!file || !user) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 3*1024*1024) {
      notice('اختار JPG أو PNG أو WebP أقل من 3MB'); return
    }
    setBusy(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = user.id + '/avatar-' + Date.now() + '.' + ext
      const { error: uploadError } = await supabase.storage.from('t24-avatars').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('t24-avatars').getPublicUrl(path)
      setDraft(prev => ({ ...prev, avatar_url: data.publicUrl }))
      notice('التصويرة تحمّلت، إضغط حفظ الملف')
    } catch (cause) { notice('مشكلة تحميل التصويرة: ' + cause.message) }
    finally { setBusy(false) }
  }

  async function joinMatch(match) {
    if (!requireLogin()) return
    const existing = lineup.find(l => l.match_id === match.id && l.player_id === user.id)
    if (existing) { setSelectedMatch(match.id); notice('إنت موجود في التشكيلة بالفعل'); return }
    if (lineup.filter(l => l.match_id === match.id && l.status === 'confirmed').length >= match.total_players) {
      notice('التشكيلة كاملة'); return
    }
    setBusy(true)
    try {
      const { error: joinError } = await supabase.from('t24_lineup').insert({match_id:match.id, player_id:user.id, team:'A', slot:0, status:'confirmed'})
      if (joinError) throw joinError
      setSelectedMatch(match.id)
      await refreshData(user)
      notice('دخلت للتشكيلة بنجاح!')
    } catch (cause) { notice('تعذّرت المشاركة: ' + cause.message) }
    finally { setBusy(false) }
  }

  async function invitePlayer(player) {
    const game = matches.find(m => m.id === selectedMatch)
    if (!game || game.host_id !== user?.id) { notice('كان منظّم الماتش ينجم يبعث الدعوات'); return }
    if (lineup.some(l => l.match_id === game.id && l.player_id === player.id)) { notice('اللاعب موجود في التشكيلة'); return }
    setBusy(true)
    try {
      const { error: inviteError } = await supabase.from('t24_lineup').insert({
        match_id: game.id, player_id: player.id, team:'A', slot:0, status:'invited'
      })
      if (inviteError) throw inviteError
      await refreshData(user)
      notice('دعوة مبعوثة لـ ' + player.display_name)
    } catch (cause) { notice('خطأ في الدعوة: ' + cause.message) }
    finally { setBusy(false) }
  }

  async function respondInvite(entry, accept) {
    setBusy(true)
    try {
      const { error: updateError } = await supabase.from('t24_lineup').update({status:accept?'confirmed':'declined'}).eq('id',entry.id).eq('player_id',user.id)
      if (updateError) throw updateError
      await refreshData(user)
      notice(accept ? 'قبلت الدعوة!' : 'رفضت الدعوة')
    } catch(cause) { notice(cause.message) }
    finally { setBusy(false) }
  }

  async function changeLineupSlot(entry, team, slot) {
    if (!user || !selectedMatch) return
    const game = matches.find(m => m.id === selectedMatch)
    if (game?.host_id !== user.id && entry.player_id !== user.id) return
    setBusy(true)
    try {
      const { error: slotError } = await supabase.from('t24_lineup').update({team,slot}).eq('id',entry.id)
      if (slotError) throw slotError
      await refreshData(user)
    } catch(cause) { notice('ما نجّمش نبدّل المركز: '+cause.message) }
    finally { setBusy(false) }
  }

  const currentMatch = matches.find(m => m.id === selectedMatch)
  const participants = lineup.filter(l => l.match_id === selectedMatch && l.status !== 'declined')
  const findPlayer = id => players.find(p => p.id === id)
  const avatarOf = id => findPlayer(id)?.avatar_url
  const nameOf = id => findPlayer(id)?.display_name || 'لاعب'
  const ownInvitations = lineup.filter(l => l.player_id === user?.id && l.status === 'invited')

  if (!authReady) return <div className="t24-loading">⚽ جاري تحميل Takwira24...</div>

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#" className="brand" onClick={e => { e.preventDefault(); setActiveTab('home') }}><span className="brand-mark">⚽</span><span>takwira<span className="brand-24">24</span><small>PLAY MORE. LIVE MORE.</small></span></a>
      <div className="side-label">القائمة الرئيسية</div>
      {[['home',Compass,'اكتشف الماتشات'],['matches',CalendarDays,'مبارياتي'],['players',Users,'اللاعبين'],['profile',UserRound,'حسابي']].map(([tab,Icon,label])=>
        <button key={tab} className={'side-link ' + (activeTab===tab?'active':'')} onClick={()=>setActiveTab(tab)}><Icon/><span>{label}</span></button>)}
      <div className="side-promo"><div className="promo-ball">⚽</div><strong>اللعبة تحلى بالصحاب</strong><p>لمّ فريقك، كوّن ماتش، وشجّع صحابك.</p><button onClick={openMatch}>أنشئ ماتش <ArrowLeft size={15}/></button></div>
      <button className="sidebar-user t24-account-button" onClick={()=>user?setActiveTab('profile'):setAuthOpen(true)}>
        <Avatar name={displayName} url={profile?.avatar_url}/><span><strong>{user?displayName:'سجّل الدخول'}</strong><small>{user?'حساب لاعب':'إنشاء حساب جديد'}</small></span><Settings2 size={17}/>
      </button>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark">⚽</span> takwira<span className="brand-24">24</span></div>
        <div className="breadcrumb">الرئيسية / <b>{activeTab==='home'?'اكتشف الماتشات':activeTab==='players'?'اللاعبين':activeTab==='profile'?'حسابي':'مبارياتي'}</b></div>
        <div className="top-actions">
          {user ? <><button className="t24-header-account" onClick={()=>setActiveTab('profile')}><Avatar name={displayName} url={profile?.avatar_url} small/><span>{displayName}</span></button><button className="icon-button" title="خروج" onClick={()=>supabase.auth.signOut()}><LogOut size={19}/></button></> :
            <button className="t24-login-button" onClick={()=>setAuthOpen(true)}>دخول / حساب جديد</button>}
        </div>
      </header>

      {!isSupabaseConfigured && <div className="t24-warning">قاعدة البيانات موش مهيّأة في نسخة النشر. يلزم إضافة إعدادات Supabase.</div>}
      {error && <div className="t24-warning">{error} <button onClick={()=>user&&refreshData(user)}><RefreshCw size={15}/> إعادة المحاولة</button></div>}

      {activeTab==='home' && <>
        <section className="welcome-row"><div><div className="eyebrow">TAKWIRA24 ⚽</div><h1>الماتش الجاي، <em>يبدأ من هنا.</em></h1><p>ماتشوات حقيقية، لاعبين مسجّلين، وتشكيلات تتبدّل لايف.</p></div><button className="primary-button" onClick={openMatch}><Plus size={20}/> أنشئ ماتش</button></section>
        <section className="hero-card"><div className="hero-copy"><span className="hero-tag">TAKWIRA COMMUNITY</span><h2>موش لازم تعرف 10 لاعبين.<br/><em>إحنا نلمّوهملك.</em></h2><p>اختار البلاصة والوقت، وبعد دعّي صحابك.</p><button onClick={openMatch}>إبدأ كوّن فريقك <ArrowLeft size={16}/></button></div><div className="hero-art"><div className="hero-ball">⚽</div></div></section>
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-icon lime-bg"><Activity/></span><div><strong>{matches.length}</strong><small>ماتش موجود</small></div></div>
          <div className="stat-card"><span className="stat-icon blue-bg"><Users/></span><div><strong>{players.length}</strong><small>لاعب مسجّل</small></div></div>
          <div className="stat-card"><span className="stat-icon orange-bg"><Trophy/></span><div><strong>{lineup.filter(l=>l.status==='confirmed').length}</strong><small>مشاركات مؤكّدة</small></div></div>
        </div>
      </>}

      {(activeTab==='home'||activeTab==='matches') && <>
        <div className="section-heading"><div><span className="eyebrow">FIND YOUR GAME</span><h2>{activeTab==='matches'?'ماتشاتي ودعواتي':'ماتشات تستنّى فيك'}</h2></div>{user&&<button className="outline-button" onClick={()=>refreshData(user)}><RefreshCw size={15}/> تحديث</button>}</div>
        <div className="filters-row"><div className="sport-filters"><button className={'sport-filter '+(sport==='all'?'chosen':'')} onClick={()=>setSport('all')}>الكل</button>{Object.entries(sports).map(([id,s])=><button key={id} className={'sport-filter '+(sport===id?'chosen':'')} onClick={()=>setSport(id)}>{s.icon} {s.label}</button>)}</div><label className="search-box"><Search size={17}/><input placeholder="قلّب على ماتش أو مدينة..." value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
        {activeTab==='matches'&&ownInvitations.length>0&&<div className="t24-invites">{ownInvitations.map(entry=><div className="t24-invite" key={entry.id}><span>📩 دعوة للماتش: {matches.find(m=>m.id===entry.match_id)?.title || 'ماتش'}</span><button onClick={()=>respondInvite(entry,true)} disabled={busy}>قبول</button><button onClick={()=>respondInvite(entry,false)} disabled={busy}>رفض</button></div>)}</div>}
        {!user?<div className="t24-empty">🔐 اعمل Login باش تشوف الماتشات الحقيقية وتشارك.<button className="primary-button" onClick={()=>setAuthOpen(true)}>تسجيل الدخول / إنشاء حساب</button></div>:
          loading&&matches.length===0?<div className="t24-empty">جاري جلب الماتشات...</div>:
          visible.length===0?<div className="t24-empty">ما فمّاش ماتشات توّا. كون أوّل واحد يعمل ماتش! <button className="primary-button" onClick={openMatch}>أنشئ ماتش</button></div>:
          <div className="match-grid">{visible.map(m=><article key={m.id} className="match-card">
            <div className={'match-visual visual-'+sports[m.sport]?.tint}><div className="visual-top"><span className="match-sport">{sports[m.sport]?.icon} {sports[m.sport]?.label}</span><span className="match-open">{m.status==='open'?'مفتوح':m.status}</span></div><div className="visual-ball">{sports[m.sport]?.icon}</div></div>
            <div className="match-body"><div className="match-title-row"><h3>{m.title}</h3><span className="match-date">{prettyDate(m.starts_at)}</span></div><div className="match-detail"><MapPin size={15}/>{m.venue} · {m.area}</div><div className="match-detail"><Clock3 size={15}/>{prettyTime(m.starts_at)}</div>
              <div className="players-progress"><div className="progress-label"><span>اللاعبين</span><strong>{lineup.filter(l=>l.match_id===m.id&&l.status==='confirmed').length}/{m.total_players}</strong></div><div className="progress-track"><i style={{width:Math.min(100,lineup.filter(l=>l.match_id===m.id&&l.status==='confirmed').length/m.total_players*100)+'%'}}/></div></div>
              <div className="match-card-foot"><div className="host-mini"><Avatar small name={nameOf(m.host_id)} url={avatarOf(m.host_id)}/><span>{nameOf(m.host_id)}</span></div><button onClick={()=>setSelectedMatch(m.id)}>التيران / التفاصيل</button><button onClick={()=>joinMatch(m)} disabled={busy}>نشارك</button></div>
            </div>
          </article>)}</div>}
      </>}

      {activeTab==='players'&&<><section className="page-intro"><span className="eyebrow">PLAYERS</span><h1>لاعبين Takwira24</h1><p>هوني يظهروا الحسابات الحقيقية، موش أسامي تجريبية.</p></section><label className="search-box wide-search"><Search size={17}/><input placeholder="إبحث على لاعب..." value={query} onChange={e=>setQuery(e.target.value)}/></label>{!user?<div className="t24-empty">سجّل الدخول باش تشوف اللاعبين.</div>:<div className="player-grid">{players.filter(p=>p.display_name.toLowerCase().includes(query.toLowerCase())).map(p=><div className="player-card" key={p.id}><Avatar name={p.display_name} url={p.avatar_url}/><div><strong>{p.display_name}</strong><small>{p.city || 'تونس'} · {p.position || sports[p.sport]?.label}</small></div><button className="outline-button" onClick={()=>{setActiveTab('matches');notice('اختار ماتش من ماتشاتك وافتح التشكيلة باش تدعّي اللاعب')}}>دعوة</button></div>)}</div>}</>}

      {activeTab==='profile'&&<><section className="profile-cover"><div className="profile-cover-pattern"/><span>MY PLAYER PROFILE</span></section>{!user?<div className="t24-empty">إعمل حساب باش تعمل بطاقة لاعب متاعك.<button className="primary-button" onClick={()=>setAuthOpen(true)}>إنشاء حساب / دخول</button></div>:
        <><div className="profile-head"><Avatar name={displayName} url={profile?.avatar_url}/><div><h1>{displayName} <ShieldCheck size={17}/></h1><p>{user.email || 'Facebook account'} · {profile?.city || 'تونس'}</p><div className="profile-tags"><span>{profile?.position || 'لاعب'}</span><span>{sports[profile?.sport]?.label || 'Foot'}</span></div></div><button className="outline-button" onClick={openProfileEditor}><Pencil size={16}/> تعديل الملف</button></div>
        <div className="profile-bio"><span className="bio-sport-icon">{sports[profile?.sport]?.icon || '⚽'}</span><p>{profile?.bio || 'أضف نبذة على روحك الرياضية.'}</p></div>
        <div className="profile-stats"><div><strong>{lineup.filter(l=>l.player_id===user.id&&l.status==='confirmed').length}</strong><small>ماتش شاركت فيه</small></div><div><strong>{matches.filter(m=>m.host_id===user.id).length}</strong><small>ماتش نظّمتو</small></div></div>
        <button className="outline-button" onClick={openProfileEditor}><ImagePlus size={16}/> إضافة / تغيير صورة الـProfile</button></>}</>}
      <footer className="footer"><span>© 2026 Takwira24</span><span>اللعبة تجمعنا 💚</span><span>{isSupabaseConfigured?'SUPABASE':'CONFIGURATION REQUIRED'}</span></footer>
    </main>

    {authOpen && <AuthModal onClose={()=>setAuthOpen(false)}/>}
    {passwordRecovery && <div className="modal-backdrop"><form className="create-modal" onSubmit={async e=>{e.preventDefault();setBusy(true);const {error:passwordError}=await supabase.auth.updateUser({password:e.target.password.value});setBusy(false);if(passwordError)notice(passwordError.message);else{setPasswordRecovery(false);notice('تبدّلت كلمة السر بنجاح')}}}><div className="modal-head"><h2>كلمة سر جديدة</h2><button type="button" className="icon-button" onClick={()=>setPasswordRecovery(false)}><X/></button></div><label className="field-label">كلمة السر<input type="password" minLength="6" name="password" required /></label><button className="primary-button" disabled={busy}>تأكيد</button></form></div>}

    {newMatchOpen&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setNewMatchOpen(false)}><form className="create-modal" onSubmit={createMatch}><div className="modal-head"><div><span className="eyebrow">CREATE MATCH</span><h2>كوّن الماتش متاعك</h2></div><button type="button" className="icon-button" onClick={()=>setNewMatchOpen(false)}><X/></button></div><label className="field-label">الرياضة<select value={form.sport} onChange={e=>setForm({...form,sport:e.target.value})}>{Object.entries(sports).map(([id,s])=><option key={id} value={id}>{s.label}</option>)}</select></label><label className="field-label">إسم الماتش<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="ماتش صحاب الجمعة"/></label><div className="form-two"><label className="field-label">الملعب<input required value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})}/></label><label className="field-label">المدينة<input required value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/></label></div><div className="form-two"><label className="field-label">التاريخ<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label className="field-label">الساعة<input type="time" required value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label></div><div className="form-two"><label className="field-label">عدد اللاعبين<select value={form.total} onChange={e=>setForm({...form,total:+e.target.value})}>{[6,10,12,14,18,22].map(n=><option key={n} value={n}>{n} لاعبين</option>)}</select></label><label className="field-label">المستوى<select value={form.skill_level} onChange={e=>setForm({...form,skill_level:e.target.value})}>{['مفتوح','مبتدئ','متوسط','متقدم'].map(s=><option key={s}>{s}</option>)}</select></label></div><button className="primary-button submit-match" disabled={busy}><CirclePlus size={18}/> {busy?'جاري الحفظ':'إنشاء الماتش'}</button></form></div>}

    {editProfileOpen&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setEditProfileOpen(false)}><form className="create-modal profile-editor" onSubmit={saveProfile}><div className="modal-head"><div><span className="eyebrow">PLAYER PROFILE</span><h2>بطاقة اللاعب</h2></div><button type="button" className="icon-button" onClick={()=>setEditProfileOpen(false)}><X/></button></div><div className="t24-avatar-upload"><Avatar name={draft.display_name} url={draft.avatar_url}/><label className="outline-button"><Camera size={16}/> غيّر التصويرة<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} hidden /></label></div><label className="field-label">الإسم<input required value={draft.display_name||''} onChange={e=>setDraft({...draft,display_name:e.target.value})}/></label><div className="form-two"><label className="field-label">المدينة<input value={draft.city||''} onChange={e=>setDraft({...draft,city:e.target.value})}/></label><label className="field-label">المركز<input value={draft.position||''} onChange={e=>setDraft({...draft,position:e.target.value})}/></label></div><label className="field-label">الرياضة<select value={draft.sport||'football'} onChange={e=>setDraft({...draft,sport:e.target.value})}>{Object.entries(sports).map(([id,s])=><option key={id} value={id}>{s.label}</option>)}</select></label><label className="field-label">نبذة عليك<textarea rows="3" value={draft.bio||''} onChange={e=>setDraft({...draft,bio:e.target.value})}/></label><button className="primary-button submit-match" disabled={busy}><CheckCircle2 size={18}/> حفظ الملف</button></form></div>}

    {currentMatch&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelectedMatch(null)}><div className="create-modal t24-lineup-modal"><div className="modal-head"><div><span className="eyebrow">MATCH LINEUP</span><h2>{currentMatch.title}</h2><p>{currentMatch.venue} · {currentMatch.area} · {prettyDate(currentMatch.starts_at)}</p></div><button className="icon-button" onClick={()=>setSelectedMatch(null)}><X/></button></div>
      <div className="t24-field"><div className="t24-center-line"/><div className="t24-center-circle"/>{['A','B'].map(team=><div className="t24-team" key={team}><strong>فريق {team}</strong><div className="t24-squad">{participants.filter(e=>e.team===team&&e.status==='confirmed').map(entry=><div className="t24-squad-player" key={entry.id}><Avatar small name={nameOf(entry.player_id)} url={avatarOf(entry.player_id)}/><span>{nameOf(entry.player_id)}</span></div>)}</div></div>)}</div>
      <div className="t24-participants"><h3>تشكيلة الماتش ({participants.length}/{currentMatch.total_players})</h3>{participants.map(entry=><div key={entry.id} className="t24-roster-row"><Avatar small name={nameOf(entry.player_id)} url={avatarOf(entry.player_id)}/><span>{nameOf(entry.player_id)}<small>{entry.status==='invited'?' • دعوة في الانتظار':''}</small></span>{(currentMatch.host_id===user?.id||entry.player_id===user?.id)&&<select value={entry.team||'A'} onChange={e=>changeLineupSlot(entry,e.target.value,entry.slot||0)}><option value="A">فريق A</option><option value="B">فريق B</option></select>}</div>)}</div>
      {currentMatch.host_id===user?.id&&<div className="t24-invite-picker"><h3>دعّي لاعب مسجّل</h3><div className="t24-invite-list">{players.filter(p=>p.id!==user.id&&!participants.some(l=>l.player_id===p.id)).map(p=><button disabled={busy} key={p.id} onClick={()=>invitePlayer(p)}><Avatar small name={p.display_name} url={p.avatar_url}/>{p.display_name}<Plus size={16}/></button>)}</div></div>}
      <button className="primary-button submit-match" onClick={()=>joinMatch(currentMatch)} disabled={busy}>نشارك في الماتش</button>
    </div></div>}
    {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    <nav className="mobile-nav">{[['home',Compass,'اكتشف'],['matches',CalendarDays,'مبارياتي'],['new',Plus,''],['players',Users,'اللاعبين'],['profile',UserRound,'حسابي']].map(([tab,Icon,label])=><button key={tab} className={(tab===activeTab?'selected ':'')+(tab==='new'?'mobile-create':'')} onClick={()=>tab==='new'?openMatch():setActiveTab(tab)}><Icon/><span>{label}</span></button>)}</nav>
  </div>
}
