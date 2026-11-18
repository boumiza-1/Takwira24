import { useEffect, useState } from 'react'
import { X, UserRound, MapPin, Camera, ShieldCheck, Trophy, Star, Medal } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function PlayerProfileModal({player,onClose,lang='ar'}){
  const t=(ar,fr)=>lang==='fr'?fr:ar
  const [photos,setPhotos]=useState([])
  const [stats,setStats]=useState({matches:0,average:null,votes:0})
  const [loading,setLoading]=useState(true)
  const [selectedPhoto,setSelectedPhoto]=useState(null)
  useEffect(()=>{
    if(!player?.id)return
    let active=true
    setLoading(true)
    Promise.all([
      supabase.from('t24_media').select('id,kind,approved_url,caption,created_at')
        .eq('owner_id',player.id).eq('status','approved').order('created_at',{ascending:false}).limit(75),
      supabase.from('t24_lineup').select('id,match_id').eq('player_id',player.id).eq('status','confirmed'),
      supabase.from('t24_votes').select('match_id,score').eq('player_id',player.id).limit(1000),
      supabase.from('t24_matches').select('id,season,status').eq('season','2026/2027').eq('status','completed').limit(250)
    ]).then(([gallery,participations,ratingList,seasonMatches])=>{
      if(!active)return
      const matchIds=new Set((seasonMatches.data||[]).map(m=>m.id))
      const played=new Set((participations.data||[]).filter(e=>matchIds.has(e.match_id)).map(e=>e.match_id))
      const scores=(ratingList.data||[]).filter(v=>played.has(v.match_id)).map(v=>Number(v.score))
      setPhotos((gallery.data||[]).filter(m=>Boolean(m.approved_url)))
      setStats({matches:played.size,average:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,votes:scores.length})
      setLoading(false)
    }).catch(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[player?.id])
  if(!player)return null
  return <div className="t24-public-profile-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <article className="t24-public-profile" dir={lang==='fr'?'ltr':'rtl'} role="dialog" aria-label={'Profil '+player.display_name}>
      <div className="t24-public-profile-cover"><button className="t24-public-close" type="button" onClick={onClose}><X size={22}/></button>
        <span>TAKWIRA24 • PLAYER CARD • 2026/2027</span></div>
      <div className="t24-public-profile-top">
        <div className="t24-public-avatar">{player.avatar_url?<img src={player.avatar_url} alt={'Photo '+player.display_name} loading="lazy"/>:<UserRound size={48}/>}</div>
        <div><small className="eyebrow">OFFICIAL PLAYER PROFILE</small><h2>{player.display_name}</h2>
          <span className="t24-public-id" dir="ltr">{player.public_id}</span>
          <p><MapPin size={15}/>{player.city||t('تونس','Tunisie')} <span>•</span> {player.position||t('لاعب','Joueur')} <span>•</span> {player.sport==='handball'?'Handball':'Football'}</p>
        </div>
      </div>
      <div className="t24-public-rating-hero">
        <div><small>⭐ RATING 2026/2027</small><strong>{stats.average===null?'—':stats.average.toFixed(1)} <span>/10</span></strong>
          <p>{stats.votes} {t('تقييمات من لاعبين','notes de coéquipiers')}</p></div>
        <div className="t24-public-star-line">{[1,2,3,4,5].map(i=><Star key={i} size={19}
            fill={stats.average!==null&&stats.average>=(i/5*10)?'#ffe176':'transparent'}
            color={stats.average===null?'#879b7b':'#ffdc68'}/>)}</div>
      </div>
      <div className="t24-public-profile-stats">
        <div><Trophy size={20}/><strong>{stats.matches}</strong><small>{t('ماتشات الموسم','Matchs de la saison')}</small></div>
        <div><Camera size={20}/><strong>{photos.filter(i=>i.kind==='post').length}</strong><small>{t('تصاور منشورة','Photos publiées')}</small></div>
        <div><Medal size={20}/><strong>{stats.votes}</strong><small>{t('أصوات اللاعبين','Votes reçus')}</small></div>
      </div>
      <div className="t24-public-about"><h3>{t('على اللاعب','À propos')}</h3><p>{player.bio||t('اللاعب ما زادش وصف على البروفيل.','Ce joueur n’a pas encore ajouté de description.')}</p></div>
      <div className="t24-public-gallery"><h3><Camera size={19}/>{t('تصاور اللاعب','Galerie du joueur')}</h3>
        <p>{t('التصاور المنشورة تنجم تظهر هنا مباشرة. تنجم تبلّغ على المحتوى المخالف.','Les photos publiées s’affichent directement ici. Le contenu abusif peut être signalé.')}</p>
        {loading?<div className="t24-empty">{t('جاري التحميل...','Chargement...')}</div>:
          photos.filter(item=>item.kind==='post').length===0?
          <div className="t24-public-no-photos"><Camera size={26}/><span>{t('ما فماش تصاور منشورة توا','Aucune photo publiée pour le moment')}</span></div>:
          <div className="t24-public-photo-grid">{photos.filter(item=>item.kind==='post').map(item=>
            <button type="button" className="t24-public-photo" key={item.id} onClick={()=>setSelectedPhoto(item.approved_url)}>
              <img src={item.approved_url} alt={item.caption||'Photo du joueur'} loading="lazy"/>
              {item.caption&&<span>{item.caption}</span>}
            </button>)}</div>}
      </div>
      {selectedPhoto&&<div className="t24-photo-lightbox" onClick={()=>setSelectedPhoto(null)}>
        <button type="button" onClick={()=>setSelectedPhoto(null)} aria-label="Fermer"><X/></button><img src={selectedPhoto} alt="Photo du joueur"/></div>}
    </article>
  </div>
}
