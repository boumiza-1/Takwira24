import { useEffect, useState } from 'react'
import { Search, X, UserRound, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Searches the database, not the first page of the locally loaded player list.
// Query builders (rather than raw .or() strings) safely encode names and IDs.
export default function PlayerSearchModal({ slot, onClose, onInvite, busy = false, excludeIds = [] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (!query.trim()) { setResults([]); setLoading(false); return () => { active=false } }
    const timer = setTimeout(async () => {
      if (!active) return
      setLoading(true)
      setError('')
      const word = query.trim().slice(0,60)
      const [byName, byId] = await Promise.all([
        supabase.from('t24_profiles')
          .select('id,public_id,display_name,avatar_url,city,sport')
          .ilike('display_name', '%' + word + '%').limit(12),
        supabase.from('t24_profiles')
          .select('id,public_id,display_name,avatar_url,city,sport')
          .ilike('public_id', '%' + word + '%').limit(12)
      ])
      if (!active) return
      if (byName.error || byId.error) setError((byName.error||byId.error).message)
      else {
        const all = [...(byId.data||[]),...(byName.data||[])]
        setResults([...new Map(all.map(p=>[p.id,p])).values()].slice(0,16))
      }
      setLoading(false)
    },300)
    return () => {active=false;clearTimeout(timer)}
  }, [query])

  const chosen = slot && (slot.slot===0 ? 'Gardien' : 'Position ' + slot.slot)
  return <div className="t24-search-overlay" role="dialog" aria-modal="true" aria-label="البحث على لاعب">
    <div className="t24-player-search">
      <div className="t24-search-title">
        <div><span className="eyebrow">PLAYER SEARCH</span><h3>اختار لاعب للتشكيلة</h3>
        <small>Team {slot?.team} • {chosen} • دعوة تحتاج موافقة اللاعب</small></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={19}/></button>
      </div>
      <label className="t24-player-search-box"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)}
        placeholder="إبحث بإسم اللاعب أو ID مثل TK-..."
        autoFocus dir="auto" maxLength="60"/></label>
      <p className="t24-search-hint"><ShieldCheck size={15}/> النتيجة تظهر بالتصويرة المقبولة والـID. ما يتمش تثبيت اللاعب قبل ما يوافق.</p>
      {error&&<div className="auth-error">{error}</div>}
      <div className="t24-player-search-results">
        {!query.trim()&&<div className="t24-empty">اكتب الاسم أو ID متاع اللاعب باش تبدأ البحث</div>}
        {loading&&<div className="t24-empty">قاعدين نقلّبوا على اللاعبين...</div>}
        {!loading&&query.trim()&&results.length===0&&!error&&<div className="t24-empty">ما لقيناش لاعب بالإسم أو ID هذا.</div>}
        {!loading&&results.map(p=><div key={p.id} className="t24-search-result">
          <div className="t24-search-avatar">{p.avatar_url?<img src={p.avatar_url} alt={p.display_name||'لاعب'}/>:<UserRound size={22}/>}</div>
          <div className="t24-search-person"><strong>{p.display_name}</strong><small dir="ltr">{p.public_id}</small><small>{p.city||'تونس'}</small></div>
          <button type="button" className="t24-invite-btn" disabled={busy||excludeIds.includes(p.id)} onClick={()=>onInvite(p,slot)}>
            <Send size={14}/>{excludeIds.includes(p.id)?'مسجّل':'دعوة'}
          </button>
        </div>)}
      </div>
    </div>
  </div>
}
