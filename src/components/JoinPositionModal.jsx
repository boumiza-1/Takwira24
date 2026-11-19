import { useMemo,useState } from 'react'
import { Check, MapPin, ShieldCheck, Shirt, X } from 'lucide-react'
import './JoinPositionModal.css'
export default function JoinPositionModal({match,team,entries=[],lang='ar',busy=false,onClose,onSubmit}){
 const t=(ar,fr)=>lang==='fr'?fr:ar
 const n=Number(match.outfield_per_team)+1
 const total=n+Number(match.bench_per_team||0)
 const options=useMemo(()=>Array.from({length:total},(_,i)=>({
    slot:i,
    role:match.sport==='basketball'&&i<n?'🏀 '+t('لاعب','Joueur')+' '+(i+1):i===0?'🧤 '+t('حارس','Gardien'):i<n?'⚽ '+t('لاعب','Joueur')+' '+i:'🪑 '+t('بديل','Remplaçant')+' '+(i-n+1),
    occupied:entries.some(e=>e.match_id===match.id&&e.team===team&&Number(e.slot)===i)
 })),[entries,match.id,match.sport,team,total,n,lang])
 const [picked,setPicked]=useState(null)
 const available=options.filter(x=>!x.occupied)
 return <div className="s24-join-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
   <div className="s24-join-modal" role="dialog" aria-modal="true" aria-label={t('اختار المركز','Choisir mon poste')} dir={lang==='fr'?'ltr':'rtl'}>
     <div className="s24-join-head"><span>TAKWIRA24 · TEAM {team}</span><button type="button" aria-label="Fermer" onClick={onClose}><X size={19}/></button></div>
     <div className="s24-join-title"><span><Shirt size={24}/></span><div><h2>{t('وين تحب تلعب؟','Quel poste préfères-tu ?')}</h2><p>{match.title} · Team {team}</p></div></div>
     <p className="s24-join-note">{t('اختار مركز فارغ من التشكيلة، وبعد مسؤول الفريق يقبل طلبك. المركز يبقى غير محجوز حتى يوافق.','Choisis une place libre. Le capitaine doit accepter ta demande. La place n’est pas réservée avant acceptation.')}</p>
     <div className="s24-positions">{options.map(o=><button key={o.slot} type="button" className={'s24-position '+(picked===o.slot?'selected':'')} disabled={o.occupied||busy} onClick={()=>setPicked(o.slot)}><span>{o.role}</span><small>{o.occupied?t('معمّر','Occupé'):picked===o.slot?t('مختار','Choisi'):t('فارغ','Libre')}</small>{picked===o.slot&&<Check size={15}/>}</button>)}</div>
     {!available.length&&<p className="s24-join-error">{t('الفريق معمّر، ما فماش مراكز فارغة.','Cette équipe ne dispose d’aucune place libre.')}</p>}
     <div className="s24-join-actions"><button type="button" onClick={onClose}>{t('إلغاء','Annuler')}</button><button type="button" disabled={picked===null||busy||!available.some(x=>x.slot===picked)} onClick={()=>onSubmit(picked)}><ShieldCheck size={17}/>{t('ابعث طلب اللعب','Envoyer ma demande')}</button></div>
   </div>
 </div>
}