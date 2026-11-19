import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, Check, Clock3, Crown, ShieldCheck, Users, UserRoundX, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './AutoSubstitute.css'

const ROLES = [
 {value:'any',ar:'أي مركز',fr:'Tous les postes'},
 {value:'keeper',ar:'حارس مرمى',fr:'Gardien'},
 {value:'field',ar:'لاعب أساسي',fr:'Titulaire'},
 {value:'bench',ar:'بديل',fr:'Remplaçant'}
]
const roleAllowed=(role,slot,match)=>{
 if(role==='keeper')return match.sport!=='basketball'&&slot===0
 if(role==='field')return slot>=1&&slot<=Number(match.outfield_per_team)||(match.sport==='basketball'&&slot===0)
 if(role==='bench')return slot>Number(match.outfield_per_team)
 return true
}
export default function AutoSubstitute({match,entries=[],user,lang='ar',onChanged,onOpenProfile}){
 const t=(ar,fr)=>lang==='fr'?fr:ar
 const [waitlist,setWaitlist]=useState([])
 const [team,setTeam]=useState('A')
 const [role,setRole]=useState('any')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [loaded,setLoaded]=useState(false)
 const reload=useCallback(async()=>{
  if(!user?.id||!match?.id)return
  const {data,error:queryError}=await supabase.from('t24_waitlist')
    .select('id,match_id,player_id,team,preferred_role,status,offered_slot,offered_at,created_at')
    .eq('match_id',match.id).order('created_at',{ascending:true}).limit(100)
  if(queryError){setError(queryError.message);return}
  setWaitlist(data||[]);setLoaded(true)
 },[match?.id,user?.id])
 useEffect(()=>{
  setWaitlist([]);setLoaded(false)
  if(!user?.id||!match?.id)return
  reload()
  const channel=supabase.channel('t24-waitlist-'+match.id+'-'+user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'t24_waitlist',filter:'match_id=eq.'+match.id},()=>{
      reload();onChanged?.()
   }).subscribe()
  const visibility=()=>{if(document.visibilityState==='visible')reload()}
  document.addEventListener('visibilitychange',visibility)
  return()=>{supabase.removeChannel(channel);document.removeEventListener('visibilitychange',visibility)}
 },[reload])
 const current=waitlist.find(w=>w.player_id===user?.id)
 const captainA=match.host_id===user?.id
 const captainB=match.opponent_id===user?.id
 const isCaptain=captainA||captainB
 const ownLineup=entries.find(e=>e.match_id===match.id&&e.player_id===user?.id&&e.status==='confirmed')
 const max=Number(match.outfield_per_team)+1+Number(match.bench_per_team||0)
 const sides=['A',...(match.opponent_id?['B']:[])]
 const empty=side=>Array.from({length:max},(_,i)=>i).filter(slot=>
  !entries.some(e=>e.match_id===match.id&&e.team===side&&Number(e.slot)===slot)
 )
 const free=empty(team).filter(slot=>roleAllowed(role,slot,match))
 const waitable=match.status==='open'&&!isCaptain&&!ownLineup&&!current
 const roleOptions=ROLES.filter(item=>!(item.value==='keeper'&&match.sport==='basketball'))
 const describeSlot=slot=>slot===null||slot===undefined?'—':(slot===0&&match.sport!=='basketball'?'Gardien':slot>Number(match.outfield_per_team)?'Banc '+(slot-Number(match.outfield_per_team)):'P'+(match.sport==='basketball'?slot+1:slot))
 async function addToWaitlist(){
  if(!waitable||free.length)return
  setBusy(true);setError('');setMessage('')
  try{
   const {error:insertError}=await supabase.from('t24_waitlist').insert({
      match_id:match.id,player_id:user.id,team,preferred_role:role,status:'waiting'
   })
   if(insertError)throw insertError
   setMessage(t('تحطّيت في قائمة الانتظار. وقت يتفرغ مركز مناسب توصلك دعوة.','Tu es sur la liste d’attente. Une invitation arrivera lorsqu’un poste se libérera.'))
   await reload();onChanged?.()
  }catch(cause){setError(cause.message||'Erreur')}finally{setBusy(false)}
 }
 async function leaveWaitlist(){
  if(!current||!['waiting','offered'].includes(current.status))return
  setBusy(true);setError('');setMessage('')
  try{
   const {error:deleteError}=await supabase.from('t24_waitlist').delete().eq('id',current.id).eq('player_id',user.id)
   if(deleteError)throw deleteError
   setMessage(t('تنحّيت من قائمة الانتظار.','Tu as quitté la liste d’attente.'))
   await reload();onChanged?.()
  }catch(cause){setError(cause.message||'Erreur')}finally{setBusy(false)}
 }
 async function respondOffer(accept){
  if(!current||current.status!=='offered')return
  setBusy(true);setError('');setMessage('')
  try{
    const {data,error:updateError}=await supabase.from('t24_waitlist')
     .update({status:accept?'requested':'declined'})
     .eq('id',current.id).eq('player_id',user.id).eq('status','offered').select('id').maybeSingle()
    if(updateError)throw updateError
    if(!data)throw Error(t('الدعوة موش متاحة توا.','Offre déjà traitée ou indisponible.'))
    setMessage(accept?t('قبلت العرض! طلبك توا عند مسؤول الفريق للموافقة.','Offre acceptée ! Le capitaine doit maintenant confirmer ton inscription.'):
     t('رفضت العرض. باش تتحوّل الدعوة للاعب اللي بعدك.','Offre refusée. Le prochain joueur peut être invité.'))
    await reload();onChanged?.()
  }catch(cause){setError(cause.message||'Erreur')}finally{setBusy(false)}
 }
 async function withdraw(){
  if(!ownLineup||match.status!=='open')return
  if(!window.confirm(t('متأكّد تحب تعتذر وتفرّغ بلاصتك؟','Confirmer ton désistement et libérer ta place ?')))return
  setBusy(true);setError('');setMessage('')
  try{
   const {data,error:deleteError}=await supabase.from('t24_lineup').delete()
      .eq('id',ownLineup.id).eq('player_id',user.id).select('id').maybeSingle()
   if(deleteError)throw deleteError
   if(!data)throw Error(t('ما نجّمناش نخرّجوك من التشكيلة','Désistement impossible'))
   setMessage(t('تفرّغت بلاصتك، والبديل اللي في الانتظار توصله دعوة.','Place libérée. Le remplaçant en attente recevra une invitation.'))
   await reload();onChanged?.()
  }catch(cause){setError(cause.message||'Erreur')}finally{setBusy(false)}
 }
 return <section className="t24-auto-sub" dir={lang==='fr'?'ltr':'rtl'}>
   <div className="t24-auto-head"><div><span><BellRing size={16}/> TAKWIRA24 · SMART SUBSTITUTE</span>
     <h3>{t('البديل الذكي','Remplaçant intelligent')}</h3>
     <p>{t('قائمة انتظار اختيارية، والدعوة توصل وقت بلاصة تتفرغ. مسؤول الفريق يؤكّد الدخول.','Liste d’attente volontaire : notification dès qu’un poste se libère, avec validation par le capitaine.')}</p>
   </div><span className="t24-auto-icon"><Users size={23}/></span></div>
   <div className="t24-auto-rosters">{sides.map(side=><div key={side}><b>TEAM {side}</b><strong>{empty(side).length}</strong><small>{t('بلايص فارغة','places libres')}</small>
     {isCaptain&&<span>{waitlist.filter(w=>w.team===side&&w.status==='waiting').length} {t('في الانتظار','en attente')}</span>}
   </div>)}</div>
   {!user?<p className="t24-auto-muted">{t('اعمل Login باش تدخل قائمة الانتظار.','Connecte-toi pour accéder à la liste d’attente.')}</p>:
   <>
   {ownLineup&&match.status==='open'&&<div className="t24-auto-withdraw"><span><Check size={17}/>{t('إنت لاعب مؤكّد في التشكيلة','Tu es confirmé dans la composition')}</span>
     <button type="button" disabled={busy} onClick={withdraw}><UserRoundX size={16}/>{t('نعتذر / نحرّر بلاصتي','Je me désiste')}</button>
   </div>}
   {current&&<div className={'t24-auto-status t24-auto-'+current.status}>
     <strong>{current.status==='waiting'?t('⏳ إنت في قائمة الانتظار','⏳ Tu es en liste d’attente'):
      current.status==='offered'?t('🎯 بلاصة تفرغت ليك!','🎯 Une place est disponible pour toi !'):
      current.status==='requested'?t('📩 طلبك عند المسؤول','📩 En attente de validation du capitaine'):
      current.status==='placed'?t('✅ تأكّدت في التشكيلة','✅ Place confirmée'):
      t('❌ العرض ترفض','❌ Offre refusée')}</strong>
     <p>TEAM {current.team} · {current.status==='waiting'?roleOptions.find(x=>x.value===current.preferred_role)?.[lang==='fr'?'fr':'ar']:describeSlot(current.offered_slot)}</p>
     {current.status==='offered'&&<div className="t24-auto-actions"><button type="button" disabled={busy} onClick={()=>respondOffer(true)}><Check size={17}/>{t('نقبل البلاصة','Accepter le poste')}</button><button type="button" disabled={busy} onClick={()=>respondOffer(false)}><X size={17}/>{t('نرفض','Refuser')}</button></div>}
     {['waiting','offered'].includes(current.status)&&<button type="button" className="t24-auto-leave" disabled={busy} onClick={leaveWaitlist}>{t('نخرج من قائمة الانتظار','Quitter la liste d’attente')}</button>}
   </div>}
   {waitable&&<div className="t24-auto-register"><div className="t24-auto-inputs"><label>{t('الفريق','Équipe')}<select value={team} onChange={e=>setTeam(e.target.value)}>{sides.map(side=><option key={side} value={side}>Team {side}</option>)}</select></label>
      <label>{t('المركز المطلوب','Poste souhaité')}<select value={role} onChange={e=>setRole(e.target.value)}>{roleOptions.map(item=><option key={item.value} value={item.value}>{item[lang==='fr'?'fr':'ar']}</option>)}</select></label></div>
      {free.length>0?<p className="t24-auto-muted">{t('فما مركز فارغ يناسبك! إبعث طلب اللعب المباشر فوق قبل قائمة الانتظار.','Un poste adapté est libre ! Demande à rejoindre directement l’équipe.')}</p>:
       <button type="button" disabled={busy} onClick={addToWaitlist}><BellRing size={18}/>{t('حطّني في قائمة الانتظار','Rejoindre la liste d’attente')}</button>}
   </div>}
   {isCaptain&&<div className="t24-auto-captain"><Crown size={16}/>{t('كي لاعب يعتذر، التطبيق يبعث أوتوماتيكيًا عرض لأقدم بديل مناسب. لازم البديل يقبل، وبعد المسؤول يأكّد.','En cas de désistement, la première personne éligible reçoit automatiquement une offre. L’acceptation du capitaine reste obligatoire.')}</div>}
   </>}
   {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="auth-message" role="status">{message}</p>}
 </section>
}
