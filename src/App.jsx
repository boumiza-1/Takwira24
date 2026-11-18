import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, Bell, CalendarDays, CheckCircle2, CirclePlus, Compass, ImagePlus, LogOut, MapPin, Plus, Search, Settings2, ShieldCheck, Trophy, Users, X, UserRound, Clock3, Camera, Pencil, RefreshCw } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import AuthModal from './components/AuthModal'
import MediaModeration from './components/MediaModeration'
import FormationPitch from './components/FormationPitch'
import PlayerSearchModal from './components/PlayerSearchModal'
import PlayerProfileModal from './components/PlayerProfileModal'
import NotificationsPanel from './components/NotificationsPanel'
import './app-mobile.css'

const sports = {
  football: { label: 'كرة القدم', icon: '⚽', tint: 'green' },
  handball: { label: 'كرة اليد', icon: '🤾', tint: 'blue' },
  basketball: { label: 'كرة السلة', icon: '🏀', tint: 'orange' },
  volleyball: { label: 'كرة الطائرة', icon: '🏐', tint: 'purple' }
}
const emptyForm = { sport: 'football', title: '', venue: '', area: '', date: '', time: '19:30', outfield_per_team: 6, bench_per_team: 0, skill_level: 'مفتوح' }
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
  const [targetSlot, setTargetSlot] = useState(null)
  const [challenges, setChallenges] = useState([])
  const [joinRequests,setJoinRequests] = useState([])
  const [viewedPlayer,setViewedPlayer] = useState(null)
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
      const [peopleResult, gamesResult, lineupResult, challengesResult, joinRequestsResult] = await Promise.all([
        supabase.from('t24_profiles').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('t24_matches').select('*').order('starts_at', { ascending: true, nullsFirst: false }).limit(150),
        supabase.from('t24_lineup').select('*').limit(500),
        supabase.from('t24_challenges').select('*').order('created_at',{ascending:false}).limit(200),
        supabase.from('t24_team_requests').select('*').order('created_at',{ascending:false}).limit(250)
      ])
      for (const item of [peopleResult, gamesResult, lineupResult, challengesResult, joinRequestsResult]) if (item.error) throw item.error
      // Include every captain/invited player even if outside the latest 200 public profiles.
      // Without this, searched players could appear as anonymous placeholders on other devices.
      const people = peopleResult.data || []
      const allIds = [...new Set([
        current.id, ...(gamesResult.data || []).flatMap(m=>[m.host_id,m.opponent_id]),
        ...(lineupResult.data || []).map(row=>row.player_id),
        ...(challengesResult.data || []).map(row=>row.challenger_id),
        ...(joinRequestsResult.data || []).map(row=>row.player_id)
      ].filter(Boolean))]
      const notLoaded = allIds.filter(id=>!people.some(p=>p.id===id))
      const batches=[]
      for(let i=0;i<notLoaded.length;i+=100) batches.push(notLoaded.slice(i,i+100))
      const extraResults=await Promise.all(batches.map(ids=>supabase.from('t24_profiles').select('*').in('id',ids)))
      for(const result of extraResults) if(result.error) throw result.error
      setPlayers([...new Map([...people,...extraResults.flatMap(x=>x.data||[])].map(p=>[p.id,p])).values()])
      setMatches(gamesResult.data || [])
      setLineup(lineupResult.data || [])
      setChallenges(challengesResult.data || [])
      setJoinRequests(joinRequestsResult.data||[])
    } catch (cause) {
      setError(cause.message || 'صار مشكل في الاتصال بقاعدة البيانات.')
    } finally { setLoading(false) }
  }
  useEffect(() => {
    if (user) { setError(''); refreshData(user) }
    else { setProfile(null); setPlayers([]); setMatches([]); setLineup([]); setChallenges([]); setJoinRequests([]); setSelectedMatch(null); setViewedPlayer(null) }
  }, [user?.id])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    const channel = supabase.channel('takwira24-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_matches' }, () => refreshData(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_lineup' }, () => refreshData(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_profiles' }, () => refreshData(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_challenges' }, () => refreshData(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 't24_team_requests' }, () => refreshData(user))
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
        outfield_per_team: Number(form.outfield_per_team), bench_per_team: Number(form.bench_per_team),
        total_players: 2*(Number(form.outfield_per_team)+1+Number(form.bench_per_team)), skill_level: form.skill_level
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

  function freePitchSlot(matchId) {
    const game = matches.find(m => m.id === matchId)
    if (!game) return null
    const perTeam = Number(game.outfield_per_team || 6) + 1 + Number(game.bench_per_team || 0)
    const occupied = lineup.filter(l => l.match_id === matchId && l.status !== 'declined')
    for (const team of ['A','B']) for(let slot = 0; slot < perTeam; slot++) {
      if (!occupied.some(l => l.team === team && l.slot === slot)) return { team, slot }
    }
    return null
  }

  // Every participant must be invited by their own team captain.
  async function joinMatch(match) {
    if (!requireLogin()) return
    setSelectedMatch(match.id)
    if (match.host_id === user.id) {
      notice('إنت مسؤول فريق A. إضغط على بلاصة فالتيران ودعّي لاعب بالاسم أو ID.')
    } else if (match.opponent_id === user.id) {
      notice('إنت مسؤول فريق B. إضغط على بلاصة في فريقك ودعّي أصحابك.')
    } else {
      notice(match.opponent_id ? 'الماتش عندو زوز مسؤولين. يلزم مسؤول الفريق يدعّيك.' : 'إبعث طلب تحدّي باش تولّي مسؤول فريق B، وبعد القبول كوّن فريقك.')
    }
  }


  // Player asks to join a specific existing team; captain decides who receives a spot.
  async function requestToJoinTeam(match,team) {
    if(!requireLogin())return
    if(match.host_id===user.id || match.opponent_id===user.id){
      notice('إنت مسؤول على فريق في الماتش هذا.');return
    }
    if(team==='B'&&!match.opponent_id){notice('Team B مازال ما عندوش مسؤول.');return}
    if(lineup.some(l=>l.match_id===match.id&&l.player_id===user.id)){
      notice('إنت عندك بلاصة أو دعوة موجودة في الماتش.');return
    }
    const old=joinRequests.find(q=>q.match_id===match.id&&q.player_id===user.id)
    if(old){notice(old.status==='pending'?'طلبك مازال يستنّى المسؤول':'عندك طلب سابق للماتش هذا.');return}
    setBusy(true)
    try{
      await ensureProfile(user)
      const {error:requestError}=await supabase.from('t24_team_requests')
        .insert({match_id:match.id,player_id:user.id,team,status:'pending'})
      if(requestError)throw requestError
      await refreshData(user)
      notice('طلب اللعب في Team '+team+' تبعث للمسؤول. باش توصلك الإجابة في الإشعارات.')
    }catch(cause){notice('تعذّر بعث طلب الانضمام: '+cause.message)}
    finally{setBusy(false)}
  }

  async function decideTeamRequest(request,accept) {
    if(!user)throw Error('Login required')
    setBusy(true)
    try{
      const {data,error:decisionError}=await supabase.from('t24_team_requests')
        .update({status:accept?'accepted':'declined'})
        .eq('id',request.id).eq('status','pending')
        .select('id').maybeSingle()
      if(decisionError)throw decisionError
      if(!data)throw Error('الطلب تقبل/ترفض قبل، أو الصلاحية موش متاحة.')
      await refreshData(user)
      notice(accept?'قبلت اللاعب، تضاف آليًا لأوّل مركز فارغ في الفريق ✅':'ترفض طلب الانضمام ❌')
    }finally{setBusy(false)}
  }

  async function notificationAction(notification,accept) {
    if(!user)return
    if(notification.kind==='invitation'){
      // Use fresh row rather than a potentially stale in-memory invitation.
      const {data,error:lookupError}=await supabase.from('t24_lineup').select('*')
        .eq('match_id',notification.match_id).eq('player_id',user.id).eq('status','invited').maybeSingle()
      if(lookupError)throw lookupError
      if(!data)throw Error('الدعوة هاذي تمّ الردّ عليها أو تنحّات.')
      await respondInvite(data,accept)
      return
    }
    if(notification.kind==='team_request'){
      const {data,error:lookupError}=await supabase.from('t24_team_requests').select('*')
        .eq('match_id',notification.match_id).eq('status','pending')
        .order('created_at',{ascending:true})
      if(lookupError)throw lookupError
      const candidate=(data||[]).find(q=>(q.team==='A'&&matches.find(m=>m.id===q.match_id)?.host_id===user.id)
        ||(q.team==='B'&&matches.find(m=>m.id===q.match_id)?.opponent_id===user.id))
      if(!candidate)throw Error('افتح الماتش وشوف الطلبات الجديدة باش تختار اللاعب.')
      await decideTeamRequest(candidate,accept)
      return
    }
    if(notification.kind==='challenge'){
      const {data,error:lookupError}=await supabase.from('t24_challenges').select('*')
        .eq('match_id',notification.match_id).eq('status','pending').order('created_at',{ascending:true})
      if(lookupError)throw lookupError
      if(!(data||[]).length)throw Error('ما عادش فما تحدّي معلّق.')
      await respondChallenge(data[0],accept)
    }
  }

  async function requestChallenge(match) {
    if (!requireLogin()) return
    if (match.host_id===user.id || match.opponent_id) return
    setBusy(true)
    try {
      await ensureProfile(user)
      const { error: challengeError }=await supabase.from('t24_challenges').insert({match_id:match.id,challenger_id:user.id,status:'pending'})
      if(challengeError) throw challengeError
      await refreshData(user)
      notice('طلب التحدّي تبعث! تستنّى قبول مسؤول فريق A.')
    } catch(cause){notice('ما نجّمش نبعث التحدّي: '+cause.message)}
    finally{setBusy(false)}
  }

  async function respondChallenge(challenge,accept) {
    setBusy(true)
    try {
      const {error:responseError}=await supabase.from('t24_challenges').update({status:accept?'accepted':'declined'})
        .eq('id',challenge.id).eq('status','pending')
      if(responseError) throw responseError
      await refreshData(user)
      notice(accept?'تمّ قبول التحدّي. مسؤول B ينجم توا يكوّن فريقو.':'ترفض طلب التحدّي.')
    } catch(cause){notice('خطأ في طلب التحدّي: '+cause.message)}
    finally{setBusy(false)}
  }

  async function removeInvitation(row) {
    const game=matches.find(m=>m.id===row.match_id)
    const isCaptain=(row.team==='A'&&game?.host_id===user?.id)||(row.team==='B'&&game?.opponent_id===user?.id)
    if(!isCaptain) return
    setBusy(true)
    try {
      const {error:deleteError}=await supabase.from('t24_lineup').delete().eq('id',row.id)
      if(deleteError) throw deleteError
      await refreshData(user)
      notice('تفرّغ المركز، تنجم تختار لاعب آخر.')
      setTargetSlot({team:row.team,slot:row.slot})
    } catch(cause){notice('ما نجّمش ننحّي الدعوة: '+cause.message)}
    finally{setBusy(false)}
  }

  async function invitePlayer(player,preferredSlot) {
    const game=matches.find(m=>m.id===selectedMatch)
    if(!user||!game||!preferredSlot) return
    const isCaptain=(preferredSlot.team==='A'&&game.host_id===user.id)||
      (preferredSlot.team==='B'&&game.opponent_id===user.id)
    if(!isCaptain){notice('فقط المسؤول على الفريق هذا ينجم يبعث الدعوات.');return}
    if(lineup.some(l=>l.match_id===game.id&&l.player_id===player.id)){
      notice('اللاعب هذا عندو دعوة في الماتش.');return
    }
    if(lineup.some(l=>l.match_id===game.id&&l.team===preferredSlot.team&&l.slot===preferredSlot.slot)){
      notice('المركز هذا معمّر، انحّي الدعوة القديمة قبل.');return
    }
    setBusy(true)
    try{
      const {error:inviteError}=await supabase.from('t24_lineup').insert({
        match_id:game.id,player_id:player.id,team:preferredSlot.team,slot:preferredSlot.slot,status:'invited'
      })
      if(inviteError) throw inviteError
      setTargetSlot(null)
      await refreshData(user)
      notice('الدعوة تبعثت. صورة اللاعب تظهر شفّافة حتى يوافق.')
    }catch(cause){notice('فشل إرسال الدعوة: '+cause.message)}
    finally{setBusy(false)}
  }

  async function respondInvite(entry,accept) {
    if(entry.player_id!==user?.id) return
    setBusy(true)
    try {
      const {error:responseError}=await supabase.from('t24_lineup')
        .update({status:accept?'confirmed':'declined'})
        .eq('id',entry.id).eq('player_id',user.id).eq('status','invited')
      if(responseError) throw responseError
      await refreshData(user)
      notice(accept?'قبلت الدعوة! تصويرة حسابك ولات واضحة في التيران.':'ترفضت الدعوة، المركز يولي أحمر عند المسؤول.')
    }catch(cause){notice(cause.message)}
    finally{setBusy(false)}
  }

  async function changeLineupSlot(entry, team, slot) {
    if (!user || !selectedMatch) return
    const game = matches.find(m => m.id === selectedMatch)
    const isCaptain=(entry.team==='A'&&game?.host_id===user.id)||(entry.team==='B'&&game?.opponent_id===user.id)
    if (!isCaptain) return
    const capacity = Number(game.outfield_per_team||6)+1+Number(game.bench_per_team||0)
    const taken = lineup.filter(l => l.match_id === selectedMatch && l.id !== entry.id && l.team === team && l.status !== 'declined').map(l=>l.slot)
    const safeSlot = taken.includes(slot) ? Array.from({length:capacity},(_,i)=>i).find(i=>!taken.includes(i)) : slot
    if (safeSlot === undefined) { notice('الفريق هذا معمّر'); return }
    setBusy(true)
    try {
      const { error: slotError } = await supabase.from('t24_lineup').update({team,slot:safeSlot}).eq('id',entry.id)
      if (slotError) throw slotError
      await refreshData(user)
    } catch(cause) { notice('ما نجّمش نبدّل المركز: '+cause.message) }
    finally { setBusy(false) }
  }

  const currentMatch = matches.find(m => m.id === selectedMatch)
  const participants = lineup.filter(l => l.match_id === selectedMatch)
  const findPlayer = id => players.find(p => p.id === id)
  const avatarOf = id => findPlayer(id)?.avatar_url
  const nameOf = id => findPlayer(id)?.display_name || 'لاعب'
  const ownInvitations = lineup.filter(l => l.player_id === user?.id && l.status === 'invited')
  const ownChallenges = challenges.filter(c=>c.challenger_id===user?.id)
  const ownJoinRequests=joinRequests.filter(q=>q.player_id===user?.id)
  const activeTeamRequests=joinRequests.filter(q=>q.match_id===selectedMatch&&q.status==='pending')
  const currentChallenges = challenges.filter(c=>c.match_id===selectedMatch)
  const canManageTeam = (game,team)=>Boolean(user&&game&&((team==='A'&&game.host_id===user.id)||(team==='B'&&game.opponent_id===user.id)))

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
          <NotificationsPanel user={user} onRefresh={()=>refreshData(user)}
            onOpenMatch={matchId=>{setSelectedMatch(matchId);setActiveTab('matches')}}
            onAcceptInvite={(notification,accept)=>notificationAction(notification,accept)}
            onDecideRequest={(notification,accept)=>notificationAction(notification,accept)}
            onDecideChallenge={(notification,accept)=>notificationAction(notification,accept)}/>
          {user ? <><button className="t24-header-account" onClick={()=>setActiveTab('profile')}><Avatar name={displayName} url={profile?.avatar_url} small/><span>{displayName}</span></button><button className="icon-button" title="خروج" onClick={()=>supabase.auth.signOut()}><LogOut size={19}/></button></> :
            <button className="t24-login-button" onClick={()=>setAuthOpen(true)}>دخول / حساب جديد</button>}
        </div>
      </header>

      {!isSupabaseConfigured && <div className="t24-warning">قاعدة البيانات موش مهيّأة في نسخة النشر. يلزم إضافة إعدادات Supabase.</div>}
      {error && <div className="t24-warning">{error} <button onClick={()=>user&&refreshData(user)}><RefreshCw size={15}/> إعادة المحاولة</button></div>}

      {activeTab==='home' && <>
        <section className="welcome-row"><div><div className="eyebrow">TAKWIRA24 ⚽</div><h1>الماتش الجاي، <em>يبدأ من هنا.</em></h1><p>ماتشوات حقيقية، لاعبين مسجّلين، وتشكيلات تتبدّل لايف.</p></div><button className="primary-button" onClick={openMatch}><Plus size={20}/> أنشئ ماتش</button></section>
        <section className="hero-card"><div className="hero-copy"><span className="hero-tag">TAKWIRA COMMUNITY</span><h2>موش لازم تعرف 10 لاعبين.<br/><em>إحنا نلمّوهملك.</em></h2><p>اختار البلاصة والوقت، وبعد دعّي صحابك.</p><button onClick={openMatch}>إبدأ كوّن فريقك <ArrowLeft size={16}/></button></div><div className="hero-art t24-sport-cover"><div className="t24-cover-glow"/><div className="t24-cover-football">⚽</div><div className="t24-cover-handball">🤾</div></div></section>
        <div className="t24-sports-covers"><div className="t24-sport-tile t24-sport-foot" onClick={()=>setSport("football")} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&setSport("football")}><span>⚽</span><div><strong>FOOTBALL</strong><small>تيران gazon وتشكيلات حقيقية</small></div></div><div className="t24-sport-tile t24-sport-hand" onClick={()=>setSport("handball")} role="button" tabIndex={0} onKeyDown={e=>e.key==="Enter"&&setSport("handball")}><span>🤾</span><div><strong>HANDBALL</strong><small>ماتشات وأصحاب وتشكيلات</small></div></div></div>
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
              <div className="match-card-foot"><div className="host-mini"><Avatar small name={nameOf(m.host_id)} url={avatarOf(m.host_id)}/><span>{nameOf(m.host_id)}</span></div><button onClick={()=>setSelectedMatch(m.id)}>التيران / التفاصيل</button>{user&&m.host_id!==user.id&&m.opponent_id!==user.id&&
              <button onClick={()=>requestToJoinTeam(m,'A')} disabled={busy||Boolean(ownJoinRequests.find(q=>q.match_id===m.id))}>🤝 {ownJoinRequests.some(q=>q.match_id===m.id&&q.team==='A')?'طلب Team A مبعوث':'نلعب مع Team A'}</button>}
              {user&&m.opponent_id&&m.opponent_id!==user.id&&m.host_id!==user.id&&
              <button onClick={()=>requestToJoinTeam(m,'B')} disabled={busy||Boolean(ownJoinRequests.find(q=>q.match_id===m.id))}>🤝 {ownJoinRequests.some(q=>q.match_id===m.id&&q.team==='B')?'طلب Team B مبعوث':'نلعب مع Team B'}</button>}{!m.opponent_id && m.host_id!==user?.id && <button onClick={()=>requestChallenge(m)} disabled={busy||ownChallenges.some(c=>c.match_id===m.id&&c.status==='pending')}>{ownChallenges.some(c=>c.match_id===m.id&&c.status==='pending')?'طلبك قيد الانتظار':'⚔️ نطلب تحدّي'}</button>}{m.opponent_id===user?.id&&<button onClick={()=>setSelectedMatch(m.id)}>مسؤول Team B</button>}</div>
            </div>
          </article>)}</div>}
      </>}

      {activeTab==='players'&&<><section className="page-intro"><span className="eyebrow">PLAYERS</span><h1>لاعبين Takwira24</h1><p>هوني يظهروا الحسابات الحقيقية، موش أسامي تجريبية.</p></section><label className="search-box wide-search"><Search size={17}/><input placeholder="إبحث على Firas أو اسم اللاعب أو Player ID..." value={query} onChange={e=>setQuery(e.target.value)}/></label>{!user?<div className="t24-empty">سجّل الدخول باش تشوف اللاعبين.</div>:<div className="player-grid">{players.filter(p=>(p.display_name||'').toLowerCase().includes(query.toLowerCase())||(p.public_id||'').toLowerCase().includes(query.toLowerCase())).map(p=><div className="player-card" key={p.id}><Avatar name={p.display_name} url={p.avatar_url}/><div><strong>{p.display_name}</strong><small>{p.city || 'تونس'} · {p.position || sports[p.sport]?.label}</small><small className="t24-id" dir="ltr">{p.public_id}</small></div><button type="button" className="outline-button" onClick={()=>setViewedPlayer(p)}>شوف البروفيل والتصاور</button></div>)}</div>}</>}

      {activeTab==='profile'&&<><section className="profile-cover"><div className="profile-cover-pattern"/><span>MY PLAYER PROFILE</span></section>{!user?<div className="t24-empty">إعمل حساب باش تعمل بطاقة لاعب متاعك.<button className="primary-button" onClick={()=>setAuthOpen(true)}>إنشاء حساب / دخول</button></div>:
        <><div className="profile-head"><Avatar name={displayName} url={profile?.avatar_url}/><div><h1>{displayName} <ShieldCheck size={17}/></h1><p>{user.email || user.phone || 'حساب لاعب'} · {profile?.city || 'تونس'}</p><div className="t24-player-id"><strong>PLAYER ID</strong><code dir="ltr">{profile?.public_id || '...'}</code><button type="button" onClick={()=>navigator.clipboard?.writeText(profile?.public_id||'')}>نسخ ID</button></div><div className="profile-tags"><span>{profile?.position || 'لاعب'}</span><span>{sports[profile?.sport]?.label || 'Foot'}</span></div></div><button className="outline-button" onClick={openProfileEditor}><Pencil size={16}/> تعديل الملف</button></div>
        <div className="profile-bio"><span className="bio-sport-icon">{sports[profile?.sport]?.icon || '⚽'}</span><p>{profile?.bio || 'أضف نبذة على روحك الرياضية.'}</p></div>
        <div className="profile-stats"><div><strong>{lineup.filter(l=>l.player_id===user.id&&l.status==='confirmed').length}</strong><small>ماتش شاركت فيه</small></div><div><strong>{matches.filter(m=>m.host_id===user.id).length}</strong><small>ماتش نظّمتو</small></div></div>
        <MediaModeration user={user} onProfileChanged={()=>refreshData(user)}/>
        <button className="outline-button" type="button" onClick={()=>setViewedPlayer(profile)}>👀 شوف البروفيل متاعي كيما يظهر للناس</button></>}</>}
      <footer className="footer"><span>© 2026 Takwira24</span><span>اللعبة تجمعنا 💚</span><span>{isSupabaseConfigured?'SUPABASE':'CONFIGURATION REQUIRED'}</span></footer>
    </main>

    {viewedPlayer&&<PlayerProfileModal player={viewedPlayer} onClose={()=>setViewedPlayer(null)}/>}
    {authOpen && <AuthModal onClose={()=>setAuthOpen(false)}/>}
    {passwordRecovery && <div className="modal-backdrop"><form className="create-modal" onSubmit={async e=>{e.preventDefault();setBusy(true);const {error:passwordError}=await supabase.auth.updateUser({password:e.target.password.value});setBusy(false);if(passwordError)notice(passwordError.message);else{setPasswordRecovery(false);notice('تبدّلت كلمة السر بنجاح')}}}><div className="modal-head"><h2>كلمة سر جديدة</h2><button type="button" className="icon-button" onClick={()=>setPasswordRecovery(false)}><X/></button></div><label className="field-label">كلمة السر<input type="password" minLength="6" name="password" required /></label><button className="primary-button" disabled={busy}>تأكيد</button></form></div>}

    {newMatchOpen&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setNewMatchOpen(false)}>
      <form className="create-modal t24-create-match-modal" onSubmit={createMatch}>
        <div className="modal-head"><div><span className="eyebrow">CREATE MATCH</span><h2>كوّن الماتش والتشكيلة</h2><p>إختار اللاعبين والبدلاء، وشوف التيران يتبدّل قدّامك.</p></div><button type="button" className="icon-button" onClick={()=>setNewMatchOpen(false)}><X/></button></div>
        <label className="field-label">الرياضة<select value={form.sport} onChange={e=>setForm({...form,sport:e.target.value})}>{Object.entries(sports).map(([id,z])=><option key={id} value={id}>{z.label}</option>)}</select></label>
        <label className="field-label">إسم الماتش<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="ماتش صحاب الجمعة"/></label>
        <div className="form-two"><label className="field-label">الملعب<input required value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})}/></label><label className="field-label">المدينة<input required value={form.area} onChange={e=>setForm({...form,area:e.target.value})}/></label></div>
        <div className="form-two"><label className="field-label">التاريخ<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label className="field-label">الساعة<input type="time" required value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label></div>
        <label className="field-label">المستوى<select value={form.skill_level} onChange={e=>setForm({...form,skill_level:e.target.value})}>{['مفتوح','مبتدئ','متوسط','متقدم'].map(v=><option key={v}>{v}</option>)}</select></label>
        <div className="t24-formation-choice"><strong>⚽ Formation — الأساسيين في كل فريق</strong><div>{[6,7,8].map(n=><button key={n} className={Number(form.outfield_per_team)===n?'selected':''} type="button" onClick={()=>setForm({...form,outfield_per_team:n})}>{n} + Gardien</button>)}</div></div>
        <div className="t24-formation-choice"><strong>🪑 Banc des remplaçants لكل فريق</strong><div>{[0,2,3].map(n=><button key={n} className={Number(form.bench_per_team)===n?'selected':''} type="button" onClick={()=>setForm({...form,bench_per_team:n})}>{n} بدلاء</button>)}</div></div>
        <FormationPitch outfield={form.outfield_per_team} bench={form.bench_per_team} sport={form.sport}/>
        <button className="primary-button submit-match" disabled={busy}><CirclePlus size={18}/>{busy?'جاري الحفظ':'إنشاء الماتش والتشكيلة'}</button>
      </form>
    </div>}

    {editProfileOpen&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setEditProfileOpen(false)}><form className="create-modal profile-editor" onSubmit={saveProfile}><div className="modal-head"><div><span className="eyebrow">PLAYER PROFILE</span><h2>بطاقة اللاعب</h2></div><button type="button" className="icon-button" onClick={()=>setEditProfileOpen(false)}><X/></button></div><div className="t24-avatar-upload"><Avatar name={draft.display_name} url={profile?.avatar_url}/><small>رفع التصويرة يتمّ من قسم المراجعة في ملفك، وما تظهر كان بعد موافقة الإدارة.</small></div><label className="field-label">الإسم<input required value={draft.display_name||''} onChange={e=>setDraft({...draft,display_name:e.target.value})}/></label><div className="form-two"><label className="field-label">المدينة<input value={draft.city||''} onChange={e=>setDraft({...draft,city:e.target.value})}/></label><label className="field-label">المركز<input value={draft.position||''} onChange={e=>setDraft({...draft,position:e.target.value})}/></label></div><label className="field-label">الرياضة<select value={draft.sport||'football'} onChange={e=>setDraft({...draft,sport:e.target.value})}>{Object.entries(sports).map(([id,s])=><option key={id} value={id}>{s.label}</option>)}</select></label><label className="field-label">نبذة عليك<textarea rows="3" value={draft.bio||''} onChange={e=>setDraft({...draft,bio:e.target.value})}/></label><button className="primary-button submit-match" disabled={busy}><CheckCircle2 size={18}/> حفظ الملف</button></form></div>}

    {currentMatch&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelectedMatch(null)}>
      <div className="create-modal t24-lineup-modal">
        <div className="modal-head"><div><span className="eyebrow">MATCH FORMATION</span><h2>{currentMatch.title}</h2><p>{currentMatch.venue} · {currentMatch.area} · {prettyDate(currentMatch.starts_at)}</p></div><button className="icon-button" onClick={()=>{setSelectedMatch(null);setTargetSlot(null)}}><X/></button></div>
        <div className="t24-captain-labels"><div><b>TEAM A</b><span><Avatar name={nameOf(currentMatch.host_id)} url={avatarOf(currentMatch.host_id)} small/>{nameOf(currentMatch.host_id)}</span></div>
          <div><b>TEAM B</b><span>{currentMatch.opponent_id?<><Avatar name={nameOf(currentMatch.opponent_id)} url={avatarOf(currentMatch.opponent_id)} small/>{nameOf(currentMatch.opponent_id)}</>:'⚔️ يستنّى مسؤول المنافس'}</span></div>
        </div>
        {currentMatch.host_id===user?.id&& !currentMatch.opponent_id&&<div className="t24-challenge-inbox"><h3>⚔️ طلبات التحدّي</h3>
          {currentChallenges.filter(c=>c.status==='pending').length===0&&<p>ما فماش طلب تحدّي توا.</p>}
          {currentChallenges.filter(c=>c.status==='pending').map(c=><div className="t24-challenge-row" key={c.id}>
            <Avatar name={nameOf(c.challenger_id)} url={avatarOf(c.challenger_id)} small/>
            <div><strong>{nameOf(c.challenger_id)}</strong><small dir="ltr">{players.find(p=>p.id===c.challenger_id)?.public_id}</small></div>
            <button disabled={busy} onClick={()=>respondChallenge(c,true)}>قبول</button><button disabled={busy} onClick={()=>respondChallenge(c,false)}>رفض</button>
          </div>)}
        </div>}
        {currentMatch.host_id!==user?.id&&!currentMatch.opponent_id&&<div className="t24-challenge-inbox"><h3>⚔️ تحدّي مسؤول فريق A</h3>
          {ownChallenges.some(c=>c.match_id===currentMatch.id&&c.status==='pending')?<p>طلبك تبعث، نستناو مسؤول الفريق يقبلو.</p>:
          <button type="button" className="primary-button" disabled={busy} onClick={()=>requestChallenge(currentMatch)}>ابعث طلب مقابلة ضد Team A</button>}
        </div>}
        {user&&(canManageTeam(currentMatch,'A')||canManageTeam(currentMatch,'B'))&&
          <div className="t24-challenge-inbox"><h3>🤝 طلبات اللعب مع فريقك</h3>
            {activeTeamRequests.filter(q=>canManageTeam(currentMatch,q.team)).length===0&&<p>ما فماش طلبات جديدة في فريقك توا.</p>}
            {activeTeamRequests.filter(q=>canManageTeam(currentMatch,q.team)).map(q=><div className="t24-challenge-row" key={q.id}>
              <button type="button" className="t24-player-open" onClick={()=>setViewedPlayer(players.find(p=>p.id===q.player_id))}>
                <Avatar name={nameOf(q.player_id)} url={avatarOf(q.player_id)} small/></button>
              <div><strong>{nameOf(q.player_id)}</strong><small>طالب يدخل Team {q.team}</small></div>
              <button disabled={busy} onClick={()=>decideTeamRequest(q,true)}>قبول في الفريق</button>
              <button disabled={busy} onClick={()=>decideTeamRequest(q,false)}>رفض</button>
            </div>)}
          </div>}
        {user&&currentMatch.host_id!==user.id&&currentMatch.opponent_id!==user.id&&<div className="t24-team-join-actions">
          <h3>تحب تلعب مع فريق ولا ضدّو؟</h3>
          <div><button type="button" disabled={busy||Boolean(ownJoinRequests.find(q=>q.match_id===currentMatch.id))}
              onClick={()=>requestToJoinTeam(currentMatch,'A')}>🤝 نلعب مع Team A</button>
            {currentMatch.opponent_id&&<button type="button" disabled={busy||Boolean(ownJoinRequests.find(q=>q.match_id===currentMatch.id))}
              onClick={()=>requestToJoinTeam(currentMatch,'B')}>🤝 نلعب مع Team B</button>}
            {!currentMatch.opponent_id&&<button type="button" disabled={busy||ownChallenges.some(c=>c.match_id===currentMatch.id)}
              onClick={()=>requestChallenge(currentMatch)}>⚔️ نطلب تحدّي ضد Team A</button>}</div>
          {ownJoinRequests.filter(q=>q.match_id===currentMatch.id).map(q=><p key={q.id}>طلب اللعب مع Team {q.team}: {q.status==='pending'?'⏳ يستنّى المسؤول':q.status==='accepted'?'✅ مقبول':'❌ مرفوض'}</p>)}
        </div>}
        <FormationPitch outfield={currentMatch.outfield_per_team||6} bench={currentMatch.bench_per_team||0} sport={currentMatch.sport}
          entries={participants} players={players} busy={busy}
          canEdit={canManageTeam(currentMatch,'A')||canManageTeam(currentMatch,'B')}
          onSelectSlot={(team,slot,row)=>{
            if(!canManageTeam(currentMatch,team)){notice('فقط المسؤول على Team '+team+' يختار لاعبيه.');return}
            if(row){
              if(row.status==='declined'){
                if(window.confirm('اللاعب رفض الدعوة. تحب تنحّيه وتبدّلو؟')) removeInvitation(row)
              } else notice('موجود '+nameOf(row.player_id)+' — '+(row.status==='invited'?'دعوة في الانتظار':'تمّت الموافقة'))
              return
            }
            setTargetSlot({team,slot})
          }}/>
        <div className="t24-participants"><h3>التشكيلة ({participants.filter(x=>x.status==='confirmed').length}/{currentMatch.total_players} موافقين)</h3>
          {participants.map(entry=><div key={entry.id} className={'t24-roster-row t24-roster-'+entry.status}>
            <Avatar small name={nameOf(entry.player_id)} url={avatarOf(entry.player_id)}/>
            <span>{nameOf(entry.player_id)}<small>{entry.status==='invited'?' • ⏳ يستنّى الموافقة':entry.status==='declined'?' • ❌ رفض الدعوة':' • ✅ موافق'}</small></span>
            {canManageTeam(currentMatch,entry.team)&&<>
              <select value={entry.slot} disabled={busy||entry.status==='declined'} aria-label="المركز" onChange={e=>changeLineupSlot(entry,entry.team,Number(e.target.value))}>
                {Array.from({length:Number(currentMatch.outfield_per_team||6)+1+Number(currentMatch.bench_per_team||0)},(_,i)=><option key={i} value={i}>{i===0?'GK':i<=Number(currentMatch.outfield_per_team||6)?'P'+i:'Banc '+(i-Number(currentMatch.outfield_per_team||6)-1)}</option>)}
              </select>
              <button type="button" disabled={busy} onClick={()=>removeInvitation(entry)}>بدّل</button>
            </>}
          </div>)}
        </div>
        <p className="t24-auth-tip">🔎 إضغط على دائرة فارغة في فريقك: تنجم تختار لاعب بالاسم أو Player ID وتبعثلو دعوة.</p>
      </div>
    </div>}
    {targetSlot && currentMatch && <PlayerSearchModal slot={targetSlot} busy={busy} onClose={()=>setTargetSlot(null)}
      excludeIds={lineup.filter(l=>l.match_id===currentMatch.id).map(l=>l.player_id)}
      onInvite={(player,slot)=>invitePlayer(player,slot)}/>}
    {toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    <nav className="mobile-nav">{[['home',Compass,'اكتشف'],['matches',CalendarDays,'مبارياتي'],['new',Plus,''],['players',Users,'اللاعبين'],['profile',UserRound,'حسابي']].map(([tab,Icon,label])=><button key={tab} className={(tab===activeTab?'selected ':'')+(tab==='new'?'mobile-create':'')} onClick={()=>tab==='new'?openMatch():setActiveTab(tab)}><Icon/><span>{label}</span></button>)}</nav>
  </div>
}
