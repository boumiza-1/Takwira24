import { useEffect, useState } from 'react'
import { X, UserRound, MapPin, Camera, ShieldCheck, Trophy, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Public-facing player card. Only moderator-approved media is visible.
export default function PlayerProfileModal({ player, onClose }) {
  const [photos,setPhotos]=useState([])
  const [stats,setStats]=useState({matches:0})
  const [loading,setLoading]=useState(true)
  const [selectedPhoto,setSelectedPhoto]=useState(null)
  useEffect(()=>{
    if(!player?.id) return
    let active=true
    setLoading(true)
    Promise.all([
      supabase.from('t24_media').select('id,kind,approved_url,caption,created_at')
        .eq('owner_id',player.id).eq('status','approved').order('created_at',{ascending:false}).limit(60),
      supabase.from('t24_lineup').select('id').eq('player_id',player.id).eq('status','confirmed')
    ]).then(([gallery,participations])=>{
      if(!active)return
      setPhotos((gallery.data||[]).filter(item=>Boolean(item.approved_url)))
      setStats({matches:participations.data?.length||0})
      setLoading(false)
    }).catch(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[player?.id])
  if(!player)return null
  return <div className="t24-public-profile-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <article className="t24-public-profile" role="dialog" aria-label={'Profil '+player.display_name}>
      <div className="t24-public-profile-cover"><button className="t24-public-close" type="button" onClick={onClose}><X size={22}/></button>
        <span>TAKWIRA24 • PLAYER CARD</span>
      </div>
      <div className="t24-public-profile-top">
        <div className="t24-public-avatar">{player.avatar_url?<img src={player.avatar_url} alt={'صورة '+player.display_name} loading="lazy"/>:<UserRound size={48}/>}</div>
        <div><small className="eyebrow">OFFICIAL PLAYER PROFILE</small><h2>{player.display_name}</h2>
          <span className="t24-public-id" dir="ltr">{player.public_id}</span>
          <p><MapPin size={15}/>{player.city||'تونس'} <span>•</span> {player.position||'لاعب'} <span>•</span> {player.sport==='handball'?'Handball':'Football'}</p></div>
      </div>
      <div className="t24-public-profile-stats"><div><Trophy size={20}/><strong>{stats.matches}</strong><small>مشاركة مؤكدة</small></div>
        <div><Camera size={20}/><strong>{photos.filter(i=>i.kind==='post').length}</strong><small>تصاور مقبولة</small></div>
        <div><ShieldCheck size={20}/><strong>✓</strong><small>حساب لاعب</small></div></div>
      <div className="t24-public-about"><h3>على اللاعب</h3><p>{player.bio||'هذا اللاعب ما زادش وصف على البروفيل متاعو.'}</p></div>
      <div className="t24-public-gallery"><h3><Camera size={19}/> تصاور اللاعب</h3>
        <p>كان التصاور اللي وافقت عليهم الإدارة يظهروا هنا، بعد الفحص والمراجعة.</p>
        {loading?<div className="t24-empty">جاري تحميل التصاور...</div>:
          photos.filter(item=>item.kind==='post').length===0?
          <div className="t24-public-no-photos"><Camera size={26}/><span>ما فماش تصاور منشورة ومقبولة توا</span></div>:
          <div className="t24-public-photo-grid">{photos.filter(item=>item.kind==='post').map(item=>
            <button type="button" className="t24-public-photo" key={item.id} onClick={()=>setSelectedPhoto(item.approved_url)}>
              <img src={item.approved_url} alt={item.caption||'صورة اللاعب'} loading="lazy"/>
              {item.caption&&<span>{item.caption}</span>}
            </button>)}</div>}
      </div>
      {selectedPhoto&&<div className="t24-photo-lightbox" onClick={()=>setSelectedPhoto(null)}><button onClick={()=>setSelectedPhoto(null)} aria-label="إغلاق"><X/></button><img src={selectedPhoto} alt="صورة اللاعب" /></div>}
    </article>
  </div>
}
