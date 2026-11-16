import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowLeft, Bell, CalendarDays, CheckCircle2, CirclePlus, Clock3, Compass, Filter, Flame, MapPin, Plus, Search, Settings2, ShieldCheck, Trophy, Users, X, Volleyball, Dribbble, Footprints, UserRound, ImagePlus, Camera, MapPinned, Pencil, Star
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const initialMatches = [
  { id: 1, sport: 'football', title: 'ماتش ودي — 5 ضد 5', venue: 'Foot Arena · سهلول', area: 'سوسة', date: 'اليوم', time: '19:30', filled: 7, total: 10, level: 'متوسط', host: 'Yassine K.', color: 'green' },
  { id: 2, sport: 'basketball', title: 'Basket تحت الأضواء', venue: 'ملعب القنطاوي', area: 'القنطاوي', date: 'اليوم', time: '20:00', filled: 3, total: 6, level: 'مفتوح', host: 'Mariem B.', color: 'orange' },
  { id: 3, sport: 'handball', title: 'Handball Challenge', venue: 'القاعة الأولمبية', area: 'سوسة', date: 'غدوة', time: '17:00', filled: 9, total: 12, level: 'متقدم', host: 'Ahmed T.', color: 'blue' },
]

const players = [
  { id: 1, name: 'Amine Boumiza', handle: '@amine.b', role: 'وسط ميدان', rating: '4.9', initials: 'AB', color: 'lime' },
  { id: 2, name: 'Yassine Khalfallah', handle: '@yass.k', role: 'مهاجم', rating: '4.8', initials: 'YK', color: 'violet' },
  { id: 3, name: 'Sami Ben Ali', handle: '@sami.10', role: 'حارس مرمى', rating: '4.7', initials: 'SA', color: 'orange' },
  { id: 4, name: 'Malek Trabelsi', handle: '@malek.t', role: 'مدافع', rating: '4.6', initials: 'MT', color: 'blue' },
]

const sportInfo = {
  football: { label: 'كرة القدم', short: 'Foot', icon: Footprints, tint: 'green' },
  handball: { label: 'كرة اليد', short: 'Hand', icon: Volleyball, tint: 'blue' },
  basketball: { label: 'كرة السلة', short: 'Basket', icon: Dribbble, tint: 'orange' },
  volleyball: { label: 'كرة الطائرة', short: 'Volley', icon: Volleyball, tint: 'purple' },
}
const Avatar = ({ initials, color = 'lime', small = false }) => <div className={`avatar avatar-${color} ${small ? 'avatar-small' : ''}`}>{initials}</div>

function App() {
  const [sport, setSport] = useState('all')
  const [matches, setMatches] = useState(initialMatches)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [selectedPlayers, setSelectedPlayers] = useState([1, 2, 3])
  const [toast, setToast] = useState('')
  const [profile, setProfile] = useState(() => { try { return { name: 'Amine Boumiza', city: 'سوسة', sport: 'football', position: 'وسط ميدان', bio: 'نحب الرياضة واللعب الجماعي ⚽', ...JSON.parse(localStorage.getItem('takwira24-profile') || '{}') } } catch { return { name: 'Amine Boumiza', city: 'سوسة', sport: 'football', position: 'وسط ميدان', bio: 'نحب الرياضة واللعب الجماعي ⚽' } } })
  const [profileModal, setProfileModal] = useState(false)
  const [profileDraft, setProfileDraft] = useState(profile)
  const [form, setForm] = useState({ sport: 'football', title: '', venue: '', area: 'سوسة', date: '', time: '19:30', total: 10, level: 'متوسط' })

  useEffect(() => { localStorage.setItem('takwira24-profile', JSON.stringify(profile)) }, [profile])

  const visibleMatches = useMemo(() => matches.filter(m =>
    (sport === 'all' || m.sport === sport) &&
    (m.title + m.venue + m.area).toLowerCase().includes(query.toLowerCase())
  ), [matches, sport, query])

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }
  const togglePlayer = (id) => setSelectedPlayers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  async function createMatch(e) {
    e.preventDefault()
    const newMatch = {
      id: Date.now(), ...form, title: form.title || `ماتش ${sportInfo[form.sport].short}`,
      date: form.date || 'قريباً', filled: 1, host: profile.name, color: sportInfo[form.sport].tint
    }
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase.from('matches').insert({
          host_id: user.id, sport: form.sport, title: newMatch.title, venue: form.venue,
          area: form.area, starts_at: form.date && form.time ? new Date(`${form.date}T${form.time}`).toISOString() : null,
          total_players: Number(form.total), skill_level: form.level, status: 'open'
        }).select().single()
        if (error) { notify('ما نجّمش نحفظ الماتش. تأكد من إعدادات Supabase.'); return }
        newMatch.id = data.id
      }
    }
    setMatches(prev => [newMatch, ...prev])
    setModal(false)
    setActiveTab('home')
    notify('الماتش متاعك تضاف! كمّل كوّن التشكيلة ⚽')
    setForm({ sport: 'football', title: '', venue: '', area: 'سوسة', date: '', time: '19:30', total: 10, level: 'متوسط' })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark"><Footprints size={23}/></span><span>takwira<span className="brand-24">24</span><small>PLAY MORE. LIVE MORE.</small></span></a>
        <div className="side-label">القائمة الرئيسية</div>
        <button className={activeTab === 'home' ? 'side-link active' : 'side-link'} onClick={() => setActiveTab('home')}><Compass/> <span>اكتشف المباريات</span></button>
        <button className={activeTab === 'matches' ? 'side-link active' : 'side-link'} onClick={() => setActiveTab('matches')}><CalendarDays/> <span>مبارياتي</span><b className="side-count">2</b></button>
        <button className={activeTab === 'players' ? 'side-link active' : 'side-link'} onClick={() => setActiveTab('players')}><Users/> <span>اللاعبين</span></button>
        <button className={activeTab === 'profile' ? 'side-link active' : 'side-link'} onClick={() => setActiveTab('profile')}><UserRound/> <span>الملف الشخصي</span></button>
        <div className="side-promo"><div className="promo-ball">⚽</div><strong>اللعبة تحلى بالصحاب</strong><p>لمّ فريقك وخلي الباقي علينا.</p><button onClick={() => setModal(true)}>أنشئ ماتش <ArrowLeft size={15}/></button></div>
        <div className="sidebar-user"><Avatar initials={profile.name.split(" ").map(part => part[0]).slice(0,2).join("").toUpperCase() || "T24"}/><div><strong>{profile.name}</strong><small>لاعب هاوي</small></div><Settings2 size={17}/></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Footprints size={19}/></span> takwira<span className="brand-24">24</span></div>
          <div className="breadcrumb">الرئيسية <span>/</span> <b>{activeTab === 'home' ? 'اكتشف المباريات' : activeTab === 'players' ? 'اللاعبين' : activeTab === 'profile' ? 'الملف الشخصي' : 'مبارياتي'}</b></div>
          <div className="top-actions"><span className="online-pill"><i/> متصل الآن</span><button className="icon-button notification" onClick={() => notify('ما عندكش إشعارات جديدة')}><Bell size={19}/><i/></button><Avatar initials={profile.name.split(" ").map(part => part[0]).slice(0,2).join("").toUpperCase() || "T24"} small/></div>
        </header>

        {activeTab === 'home' && <>
          <section className="welcome-row"><div><div className="eyebrow"><Flame size={15}/> موسم اللعب مفتوح</div><h1>الماتش الجاي، <em>يبدأ من هنا.</em></h1><p>اكتشف ماتش قريب ليك، ولا كوّن فريقك والعب مع ناس تشبهلك.</p></div><button className="primary-button" onClick={() => setModal(true)}><Plus size={19}/> أنشئ ماتش</button></section>
          <section className="hero-card"><div className="hero-copy"><span className="hero-tag">TAKWIRA COMMUNITY</span><h2>موش لازم تعرف 10 لاعبين.<br/><em>إحنا نلمّوهملك.</em></h2><p>اختار البلاصة والوقت، وإبدا عمّر فريقك بلا تعب.</p><button onClick={() => setModal(true)}>إبدا كوّن فريقك <ArrowLeft size={16}/></button></div><div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-ball">⚽</div><div className="hero-sports-label">FOOTBALL · HANDBALL · BASKETBALL</div><div className="hero-stamp">LET'S<br/>PLAY!</div><span className="hero-spark spark-one">✳</span><span className="hero-spark spark-two">✳</span></div></section>
          <section className="stats-grid"><div className="stat-card"><span className="stat-icon lime-bg"><Activity/></span><div><strong>24</strong><small>ماتش هذا الأسبوع</small></div><span className="stat-trend">+12%</span></div><div className="stat-card"><span className="stat-icon blue-bg"><Users/></span><div><strong>186</strong><small>لاعب نشيط</small></div><span className="stat-trend">+8%</span></div><div className="stat-card"><span className="stat-icon orange-bg"><Trophy/></span><div><strong>42</strong><small>فريق تكوّن</small></div><span className="stat-trend">+16%</span></div></section>
          <section className="section-heading"><div><span className="eyebrow">FIND YOUR GAME</span><h2>ماتشات تستنّى فيك</h2></div><button className="text-button" onClick={() => setSport('all')}>شوف الكل <ArrowLeft size={15}/></button></section>
          <div className="filters-row"><div className="sport-filters"><button className={sport === 'all' ? 'sport-filter chosen' : 'sport-filter'} onClick={() => setSport('all')}>الكل</button>{Object.entries(sportInfo).map(([id, item]) => <button key={id} className={sport === id ? 'sport-filter chosen' : 'sport-filter'} onClick={() => setSport(id)}>{item.short}</button>)}</div><label className="search-box"><Search size={17}/><input placeholder="قلّب على ماتش أو بلاصة..." value={query} onChange={e => setQuery(e.target.value)}/><Filter size={16}/></label></div>
          <div className="match-grid">{visibleMatches.map(match => <MatchCard key={match.id} match={match} onJoin={() => notify('بعثنا طلب المشاركة لصاحب الماتش')} />)}{visibleMatches.length === 0 && <div className="empty-state">ما لقيناش ماتشات. جرّب تبدّل البحث.</div>}</div>
        </>}

        {activeTab === 'players' && <><section className="page-intro"><span className="eyebrow">THE COMMUNITY</span><h1>العب مع ناس جدد.</h1><p>اكتشف لاعبين وابعثلهم دعوة للماتش الجاي.</p></section><label className="search-box wide-search"><Search size={18}/><input placeholder="إبحث على لاعب..." value={query} onChange={e => setQuery(e.target.value)}/></label><div className="player-grid">{players.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => <div className="player-card" key={p.id}><Avatar initials={p.initials} color={p.color}/><div><strong>{p.name}</strong><small>{p.handle} · {p.role}</small></div><span className="player-rating">★ {p.rating}</span><button className="outline-button" onClick={() => notify('بعثنا دعوة للاعب '+p.name)}>دعوة للماتش</button></div>)}</div></>}

        {activeTab === 'profile' && <><section className="profile-cover"><div className="profile-cover-pattern"/><span>PLAYER PROFILE</span></section><div className="profile-head"><Avatar initials="AB"/><div><h1>{profile.name} <span className="verified"><ShieldCheck size={16}/></span></h1><p>@{profile.name.toLowerCase().replaceAll(' ', '.')} · {profile.city}، تونس</p><div className="profile-tags"><span>{profile.position}</span><span>{sportInfo[profile.sport]?.short || 'Foot'}</span><span>لاعب هاوي</span></div></div><button className="outline-button" onClick={() => { setProfileDraft(profile); setProfileModal(true) }}>تعديل الملف</button></div><div className="profile-bio"><span className="bio-sport-icon">{profile.sport === 'football' ? '⚽' : profile.sport === 'handball' ? '🤾' : profile.sport === 'basketball' ? '🏀' : '🏐'}</span><p>{profile.bio || 'أضف نبذة قصيرة على روحك الرياضية.'}</p><span><MapPinned size={14}/>{profile.city}</span></div><div className="profile-stats"><div><strong>12</strong><small>ماتش</small></div><div><strong>8</strong><small>أهداف</small></div><div><strong>6</strong><small>مساهمات</small></div><div><strong>4.9</strong><small>تقييم</small></div></div><div className="section-heading"><div><h2>آخر النشاطات</h2><p>صور وماتشات من رحلتك الرياضية</p></div><button className="outline-button" onClick={() => notify('إضافة الصور ستكون متاحة بعد ربط التخزين')}><ImagePlus size={16}/> أضف صورة</button></div><div className="activity-placeholder"><div>📸</div><strong>هوني تبدأ حكايتك الرياضية</strong><p>شارك أول صورة أو فيديو من التمارين والماتشات متاعك.</p></div></>}

        {activeTab === 'matches' && <><section className="page-intro"><span className="eyebrow">YOUR GAMES</span><h1>مبارياتك الكل.</h1><p>تابع الدعوات والماتشات اللي حضرتلهم.</p></section><div className="match-grid">{matches.slice(0,2).map(m => <MatchCard key={m.id} match={m} onJoin={() => notify('التفاصيل قريباً')}/>)}</div></>}
        <footer className="footer"><span>© 2026 Takwira24</span><span>اللعبة تجمعنا 💚</span><span className="demo-label">{isSupabaseConfigured ? 'SUPABASE CONNECTED' : 'PREVIEW MODE'}</span></footer>
      </main>

      {profileModal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setProfileModal(false)}><form className="create-modal profile-editor" onSubmit={e => { e.preventDefault(); setProfile(profileDraft); setProfileModal(false); notify('تحدّث الملف الشخصي بنجاح'); }}><div className="modal-head"><div><span className="eyebrow">YOUR PLAYER CARD</span><h2>كمّل ملفك الرياضي</h2><p>خلّي اللاعبين يعرفوا شكون إنت وشنوة تحب تلعب.</p></div><button type="button" className="icon-button" onClick={() => setProfileModal(false)}><X/></button></div><label className="field-label">الإسم الكامل<input required value={profileDraft.name} onChange={e => setProfileDraft({...profileDraft,name:e.target.value})} placeholder="إسمك"/></label><div className="form-two"><label className="field-label">المدينة<input value={profileDraft.city} onChange={e => setProfileDraft({...profileDraft,city:e.target.value})} placeholder="سوسة"/></label><label className="field-label">المركز الرياضي<input value={profileDraft.position} onChange={e => setProfileDraft({...profileDraft,position:e.target.value})} placeholder="مثلاً: مهاجم"/></label></div><label className="field-label">رياضتك المفضلة<select value={profileDraft.sport} onChange={e => setProfileDraft({...profileDraft,sport:e.target.value})}>{Object.entries(sportInfo).map(([id,item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><label className="field-label">نبذة عليك<textarea rows="3" value={profileDraft.bio} onChange={e => setProfileDraft({...profileDraft,bio:e.target.value})} placeholder="احكيلنا على روحك..."/></label><button className="primary-button submit-match" type="submit"><CheckCircle2 size={18}/> حفظ الملف الشخصي</button></form></div>}{modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(false)}><form className="create-modal" onSubmit={createMatch}><div className="modal-head"><div><span className="eyebrow">CREATE YOUR GAME</span><h2>كوّن الماتش متاعك</h2><p>إختار التفاصيل، وبعد لمّ اللاعبين.</p></div><button type="button" className="icon-button" onClick={() => setModal(false)}><X/></button></div><label className="field-label">نوع الرياضة</label><div className="modal-sports">{Object.entries(sportInfo).map(([id, item]) => <button type="button" key={id} className={form.sport === id ? 'modal-sport selected' : 'modal-sport'} onClick={() => setForm({...form, sport:id})}>{item.label}</button>)}</div><label className="field-label">إسم الماتش <input value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="مثلاً: ماتش صحاب الجمعة"/></label><div className="form-two"><label className="field-label">الملعب / القاعة<input required value={form.venue} onChange={e => setForm({...form,venue:e.target.value})} placeholder="إسم الملعب"/></label><label className="field-label">المدينة<input value={form.area} onChange={e => setForm({...form,area:e.target.value})} placeholder="سوسة"/></label></div><div className="form-two"><label className="field-label">التاريخ<input type="date" value={form.date} onChange={e => setForm({...form,date:e.target.value})}/></label><label className="field-label">الساعة<input type="time" required value={form.time} onChange={e => setForm({...form,time:e.target.value})}/></label></div><div className="form-two"><label className="field-label">عدد اللاعبين<select value={form.total} onChange={e => setForm({...form,total:Number(e.target.value)})}><option value="6">6 لاعبين</option><option value="10">10 لاعبين</option><option value="12">12 لاعب</option><option value="14">14 لاعب</option></select></label><label className="field-label">المستوى<select value={form.level} onChange={e => setForm({...form,level:e.target.value})}><option>مفتوح</option><option>مبتدئ</option><option>متوسط</option><option>متقدم</option></select></label></div><button className="primary-button submit-match" type="submit"><CirclePlus size={18}/> إنشاء الماتش ومواصلة التشكيلة</button></form></div>}
      {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
      <nav className="mobile-nav"><button className={activeTab==='home'?'selected':''} onClick={()=>setActiveTab('home')}><Compass/><span>اكتشف</span></button><button className={activeTab==='matches'?'selected':''} onClick={()=>setActiveTab('matches')}><CalendarDays/><span>مبارياتي</span></button><button className="mobile-create" onClick={()=>setModal(true)}><Plus/></button><button className={activeTab==='players'?'selected':''} onClick={()=>setActiveTab('players')}><Users/><span>اللاعبين</span></button><button className={activeTab==='profile'?'selected':''} onClick={()=>setActiveTab('profile')}><UserRound/><span>حسابي</span></button></nav>
    </div>
  )
}

function MatchCard({ match, onJoin }) {
  const info = sportInfo[match.sport] || sportInfo.football
  const Icon = info.icon
  return <article className="match-card"><div className={`match-visual visual-${info.tint}`}><div className="visual-top"><span className="match-sport"><Icon size={14}/>{info.label}</span><span className="match-open"><i/> مفتوح</span></div><div className="visual-ball">⚽</div><div className="visual-bottom"><span>{match.level}</span><span>TAKWIRA24</span></div></div><div className="match-body"><div className="match-title-row"><h3>{match.title}</h3><span className="match-date">{match.date}</span></div><div className="match-detail"><MapPin size={15}/>{match.venue} · {match.area}</div><div className="match-detail"><Clock3 size={15}/>{match.time}</div><div className="players-progress"><div className="progress-label"><span>اللاعبين</span><strong>{match.filled}/{match.total}</strong></div><div className="progress-track"><i style={{width:`${Math.min(100,match.filled/match.total*100)}%`}}/></div></div><div className="match-card-foot"><div className="host-mini"><Avatar initials={match.host.slice(0,2).toUpperCase()} small/><span>{match.host}</span></div><button onClick={onJoin}>نشارك <ArrowLeft size={15}/></button></div></div></article>
}

export default App
