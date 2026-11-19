import { useMemo } from 'react'
import { ArrowUpRight, Compass, MapPin, ShieldCheck, Sparkles, Target, Users, Zap } from 'lucide-react'
import { CITIES } from './StadiumMobileHome'
import './SmartMatchFinder.css'

const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim()
const sameCity=(a,b)=>{
  const left=norm(a),right=norm(b)
  if(!left||!right)return false
  if(left===right)return true
  const city=CITIES.find(c=>[norm(c[0]),norm(c[1]),norm(c[2]),...c[3].split(';').map(norm)].includes(left))
  return Boolean(city&&[norm(city[0]),norm(city[1]),norm(city[2]),...city[3].split(';').map(norm)].includes(right))
}
const isKeeper=profile=>/(gardien|goalkeeper|keeper|^gk$|حارس|gard)/i.test(profile?.position||'')
const skills=['مفتوح','مبتدئ','متوسط','متقدم']
const available=(match,lineup)=>{
 const max=Number(match.outfield_per_team||6)+1+Number(match.bench_per_team||0)
 const current=lineup.filter(l=>l.match_id===match.id)
 const sides=['A',...(match.opponent_id?['B']:[])]
 return sides.flatMap(team=>Array.from({length:max},(_,i)=>({team,slot:i})))
  .filter(s=>!current.some(l=>l.team===s.team&&Number(l.slot)===s.slot))
}

export default function SmartMatchFinder({matches=[],lineup=[],user,profile,lang='ar',onOpenMatch,onProfile}) {
 const t=(ar,fr)=>lang==='fr'?fr:ar
 const ownSports=profile?.sports?.length?profile.sports:[profile?.sport].filter(Boolean)
 const recommendations=useMemo(()=>{
  if(!user||!profile)return []
  const now=Date.now()
  return matches.filter(m=>['open','full'].includes(m.status)&&m.starts_at&&new Date(m.starts_at).getTime()>now)
   .filter(m=>m.host_id!==user.id&&m.opponent_id!==user.id&&!lineup.some(l=>l.match_id===m.id&&l.player_id===user.id))
   .map(m=>{
     const slots=available(m,lineup)
     const city=sameCity(m.area,profile.city)
     const sport=ownSports.includes(m.sport)
     const skill=profile.skill_level==='مفتوح'||m.skill_level==='مفتوح'||profile.skill_level===m.skill_level
     const keeper=isKeeper(profile)&&m.sport!=='basketball'
     const relevant=slots.filter(s=>keeper?s.slot===0:(s.slot>0&&s.slot<=Number(m.outfield_per_team||6)||(m.sport==='basketball'&&s.slot===0)))
     const matchScore=(city?28:0)+(sport?45:0)+(skill?10:0)+(relevant.length?20:slots.length?8:0)
     return {match:m,city,sport,skill,slots:slots.length,roleFree:relevant.length>0,score:matchScore}
   }).filter(x=>x.sport||x.city)
   .sort((a,b)=>b.score-a.score||new Date(a.match.starts_at)-new Date(b.match.starts_at))
   .slice(0,3)
 },[matches,lineup,user?.id,profile?.city,profile?.position,profile?.skill_level,JSON.stringify(ownSports)])
 const configured=Boolean(profile?.city?.trim()&&ownSports.length)
 return <section className="t24-smart-finder" dir={lang==='fr'?'ltr':'rtl'} aria-label="Smart Match Finder">
   <header className="t24-smart-head"><div><span><Sparkles size={15}/> TAKWIRA IQ · SMART MATCH FINDER</span>
     <h2>{t('ماتشات تناسبك إنت','Des matchs qui te correspondent')}</h2>
     <p>{t('اقتراحات حسب الرياضة، المدينة، مستواك والمركز. من الماتشات الموجودة فعلًا.','Suggestions basées sur tes sports, ta ville, ton niveau et ton poste, à partir des matchs réels.')}</p></div><span className="t24-smart-mark"><Target size={25}/></span></header>
   {!user?<div className="t24-smart-empty"><Compass size={25}/><strong>{t('اعمل Login باش نلقاولك الماتشات المناسبة','Connecte-toi pour recevoir des suggestions adaptées')}</strong></div>:
   !configured?<div className="t24-smart-empty"><MapPin size={25}/><strong>{t('كمّل مدينتك ورياضتك في البروفيل','Complète ta ville et tes sports dans ton profil')}</strong>
     <button type="button" onClick={onProfile}>{t('بروفيل متاعي','Mon profil')} <ArrowUpRight size={16}/></button></div>:
   recommendations.length===0?<div className="t24-smart-empty"><Compass size={25}/><strong>{t('ما فماش ماتشات مناسبة حاليًا','Aucun match correspondant pour le moment')}</strong>
     <small>{t('جرّب تلقى ماتشات أخرى من البحث حسب المدينة، أو أنشئ ماتش.','Utilise la recherche par ville ou crée ton propre match.')}</small></div>:
   <div className="t24-smart-grid">{recommendations.map(rec=><article key={rec.match.id} className="t24-smart-card">
     <div className="t24-smart-card-top"><span>{rec.match.sport==='football'?'⚽':rec.match.sport==='basketball'?'🏀':rec.match.sport==='handball'?'🤾':'🏐'} {rec.match.sport.toUpperCase()}</span>
       <b>{rec.roleFree?t('مركز مناسب فارغ','Poste adapté libre'):rec.slots>0?t('بلايص فارغة','Places libres'):t('قائمة انتظار','Liste d’attente')}</b></div>
     <h3>{rec.match.title}</h3>
     <p><MapPin size={14}/>{rec.match.area||'Tunisie'} · {rec.match.venue}</p>
     <div className="t24-smart-reasons">{rec.city&&<span><MapPin size={13}/>{t('في مدينتك','Dans ta ville')}</span>}
       {rec.sport&&<span><Zap size={13}/>{t('رياضتك','Ton sport')}</span>}
       {rec.skill&&<span><ShieldCheck size={13}/>{t('المستوى مناسب','Niveau adapté')}</span>}
       <span><Users size={13}/>{rec.slots} {t('بلاصة فارغة','places libres')}</span></div>
     <button type="button" onClick={()=>onOpenMatch(rec.match.id)}>{t('شوف الماتش والتشكيلة','Voir le match et la composition')} <ArrowUpRight size={16}/></button>
   </article>)}</div>}
   <p className="t24-smart-disclaimer">{t('الاقتراحات تقريبية ومبنية على المعلومات اللي حطّيتهم إنت؛ ما نضمنوش توفّر اللاعب أو قبول المسؤول.','Suggestions indicatives selon ton profil et les matchs chargés. Elles ne garantissent ni disponibilité ni acceptation.')}</p>
 </section>
}
