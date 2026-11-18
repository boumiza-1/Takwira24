import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, CheckCircle2, Clock3, Send, Star, Trophy, Users, Flag, BarChart3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './MatchResults.css'

const text=(fr,ar,lang)=>lang==='fr'?fr:ar
function Avatar({player}){
  return <span className="t24-results-avatar">{player?.avatar_url?<img src={player.avatar_url} alt={player.display_name||'Joueur'}/>:
    <span>{(player?.display_name||'⚽').slice(0,2)}</span>}</span>
}
function avg(scores) {
  return scores.length ? scores.reduce((total,n)=>total+n,0)/scores.length:null
}

export default function MatchResults({match,entries=[],players=[],user,lang='ar',onChanged}) {
  const t=(fr,ar)=>text(fr,ar,lang)
  const [scoreA,setScoreA]=useState('0')
  const [scoreB,setScoreB]=useState('0')
  const [votes,setVotes]=useState([])
  const [chosen,setChosen]=useState({})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [feedback,setFeedback]=useState('')
  const [showConfirm,setShowConfirm]=useState(false)
  const captain=Boolean(user?.id&&match.host_id===user.id)
  const ended=match.status==='completed'
  const postponed=match.status==='postponed'
  const cancelled=match.status==='cancelled'
  const confirmed=entries.filter(e=>e.match_id===match.id&&e.status==='confirmed')
  const canVote=ended&&Boolean(user&&confirmed.some(e=>e.player_id===user.id))
  const playerOf=id=>players.find(p=>p.id===id)||{id,display_name:t('Joueur','لاعب')}
  const myVotes=votes.filter(v=>v.voter_id===user?.id)
  const rated=useMemo(()=>{
    return confirmed.map(e=>{
      const all=votes.filter(v=>v.player_id===e.player_id).map(v=>v.score)
      return {...e,player:playerOf(e.player_id),average:avg(all),count:all.length}
    }).sort((a,b)=>(b.average??-1)-(a.average??-1)||b.count-a.count)
  },[confirmed,votes,players,lang])
  const mvp=rated.find(r=>r.count>0)
  const reload=useCallback(async()=>{
    if(!match?.id||!user)return
    const {data,error:voteError}=await supabase.from('t24_votes').select('*').eq('match_id',match.id).limit(400)
    if(voteError){setError(voteError.message);return}
    setVotes(data||[])
  },[match?.id,user?.id])
  useEffect(()=>{reload()},[reload])
  useEffect(()=>{setScoreA(match.score_a===null?'0':String(match.score_a||0));setScoreB(match.score_b===null?'0':String(match.score_b||0))},[match.id,match.score_a,match.score_b])
  useEffect(()=>{
    if(!user||!match?.id)return
    const channel=supabase.channel('t24-votes-'+match.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'t24_votes',filter:'match_id=eq.'+match.id},()=>reload()).subscribe()
    return()=>{supabase.removeChannel(channel)}
  },[match?.id,user?.id,reload])

  async function changeStatus(status){
    if(!captain||busy)return
    if(status==='completed'&&!showConfirm){setShowConfirm(true);return}
    setBusy(true);setError('');setFeedback('')
    try {
      if(status==='completed'){
        const sa=Number(scoreA),sb=Number(scoreB)
        if(!Number.isInteger(sa)||!Number.isInteger(sb)||sa<0||sb<0||sa>99||sb>99)throw Error(t('Score invalide (0–99).','النتيجة لازم تكون بين 0 و99'))
      }
      const payload={status}
      if(status==='completed'){payload.score_a=Number(scoreA);payload.score_b=Number(scoreB)}
      const {data,error:updateError}=await supabase.from('t24_matches').update(payload)
        .eq('id',match.id).eq('host_id',user.id)
        .select('id,status').single()
      if(updateError)throw updateError
      if(!data)throw Error(t('Modification impossible','تعذّر تغيير الحالة'))
      setShowConfirm(false)
      setFeedback(status==='completed'?t('Match terminé. Les votes sont ouverts !','الماتش وفّى. التصويت تحلّ!'):status==='postponed'?t('Match reporté.','تأجّل الماتش.'):t('Match annulé.','تلغى الماتش.'))
      onChanged?.()
    }catch(cause){setError(cause.message)}
    finally{setBusy(false)}
  }

  async function submitVote(playerId){
    if(!canVote||busy||playerId===user.id||myVotes.some(v=>v.player_id===playerId))return
    const score=Number(chosen[playerId])
    if(!Number.isInteger(score)||score<3||score>9){setError(t('Choisis une note de 3 à 9.','اختار تقييم بين 3 و9'));return}
    setBusy(true);setError('');setFeedback('')
    try{
      const {error:insertError}=await supabase.from('t24_votes').insert({
        match_id:match.id,voter_id:user.id,player_id:playerId,score
      })
      if(insertError)throw insertError
      setFeedback(t('Votre note a été enregistrée. Merci !','تمّ تسجيل تصويتك. يعطيك الصحة!'))
      await reload();onChanged?.()
    }catch(cause){setError(cause.message)}
    finally{setBusy(false)}
  }

  return <section className="t24-results-panel" dir={lang==='fr'?'ltr':'rtl'}>
    <div className="t24-results-head"><div><span className="eyebrow">FINAL WHISTLE • 2026/2027</span>
      <h3><Trophy size={21}/>{t('Résultat & notes des joueurs','نتيجة الماتش وتقييم اللاعبين')}</h3>
      <p>{t('À la fin du match, les joueurs se notent entre eux de 3 à 9/10.','بعد نهاية الماتش، اللاعبين يقيّموا بعضهم من 3 إلى 9 على 10.')}</p></div>
      <span className={'t24-results-state '+(ended?'finished':postponed?'postponed':'')}>
        {ended?t('Terminé','وفّى'):postponed?t('Reporté','مؤجّل'):cancelled?t('Annulé','ملغى'):t('En préparation','قيد التحضير')}
      </span>
    </div>

    {captain&&match.status!=='completed'&&match.status!=='cancelled'&&<div className="t24-results-admin">
      <h4><Flag size={16}/>{t('Gestionnaire du match','مسؤول الماتش')}</h4>
      <p>{t('Le créateur du match est le seul à pouvoir publier le résultat final ou reporter la rencontre.','منظّم الماتش وحدو ينجم يسجّل النتيجة النهائية أو يأجّل الماتش.')}</p>
      <div className="t24-score-entry">
        <label>Team A <input type="number" min="0" max="99" inputMode="numeric" value={scoreA} onChange={e=>setScoreA(e.target.value)}/></label>
        <b>:</b>
        <label>Team B <input type="number" min="0" max="99" inputMode="numeric" value={scoreB} onChange={e=>setScoreB(e.target.value)}/></label>
      </div>
      <div className="t24-results-admin-actions">
        <button type="button" className="t24-finish-button" disabled={busy} onClick={()=>changeStatus('completed')}><CheckCircle2 size={16}/>{t('Terminer & publier le score','إغلاق الماتش ونشر النتيجة')}</button>
        <button type="button" disabled={busy} onClick={()=>changeStatus('postponed')}><Clock3 size={16}/>{t('Reporter','تأجيل')}</button>
        <button type="button" disabled={busy} onClick={()=>changeStatus('cancelled')}><Flag size={16}/>{t('Annuler','إلغاء')}</button>
      </div>
      {showConfirm&&<div className="t24-close-confirm">
        <strong>{t('Confirmer le résultat définitif ?','تأكّد من النتيجة النهائية؟')}</strong>
        <p>{t('Après validation, le résultat et les compositions seront verrouillés. Les notes seront ouvertes.','بعد التأكيد، النتيجة والتشكيلات يتسكروا، ويتحلّ التصويت.')}</p>
        <div><button type="button" disabled={busy} onClick={()=>changeStatus('completed')}>{t('Confirmer','تأكيد')}</button><button type="button" onClick={()=>setShowConfirm(false)}>{t('Retour','رجوع')}</button></div>
      </div>}
    </div>}

    {(ended||postponed||cancelled)&&<div className="t24-final-score">
      {ended?<><div><strong>TEAM A</strong><span>{match.score_a}</span></div><b>—</b><div><strong>TEAM B</strong><span>{match.score_b}</span></div></>:
      <p>{postponed?t('La rencontre a été reportée.','المقابلة تأجّلت.'):t('La rencontre a été annulée.','المقابلة تلغت.')}</p>}
    </div>}

    {ended&&<div className="t24-voting-zone">
      <div className="t24-vote-top"><h4><Star size={18}/>{t('Vote des participants','تصويت المشاركين')}</h4><span>{votes.length} {t('notes','تقييمات')}</span></div>
      {canVote?<p>{t('Évalue les autres joueurs. Tu ne peux pas te noter toi-même et chaque note est définitive.','قيّم زملاءك. ما تنجمش تصوّت لروحك، وكل تقييم يتسجّل مرّة واحدة.')}</p>:
       <p>{t('Seuls les joueurs confirmés peuvent voter.','التصويت متاح كان للاعبين اللي شاركوا ومؤكّدين.')}</p>}
      <div className="t24-rating-list">{rated.map(item=>{
        const hasVoted=myVotes.some(v=>v.player_id===item.player_id)
        return <article key={item.player_id} className="t24-rating-card">
          <Avatar player={item.player}/>
          <div className="t24-rating-info"><strong>{item.player.display_name}</strong><small>Team {item.team} • {item.slot===0?'Gardien':'Joueur'}</small>
            <span><Star size={14} fill="currentColor"/> {item.average===null?'—':item.average.toFixed(1)+'/10'} <small>({item.count} votes)</small></span></div>
          {canVote&&item.player_id!==user.id&&<div className="t24-rating-action">
            {hasVoted?<span className="t24-vote-done"><CheckCircle2 size={15}/>{t('Noté','Voté')}</span>:
            <><select aria-label={t('Note','التقييم')} value={chosen[item.player_id]??''} onChange={e=>setChosen(prev=>({...prev,[item.player_id]:e.target.value}))}>
              <option value="">{t('Note /10','التقييم /10')}</option>
              {[3,4,5,6,7,8,9].map(n=><option key={n} value={n}>{n}/10</option>)}
            </select>
            <button type="button" disabled={busy||!chosen[item.player_id]} onClick={()=>submitVote(item.player_id)}><Send size={14}/>{t('Voter','صوّت')}</button></>}
          </div>}
        </article>
      })}</div>
      {mvp&&<div className="t24-mvp-banner">
        <div><span>⭐ MVP • MAN OF THE MATCH</span><h4>{t('Meilleur joueur du match','أفضل لاعب في الماتش')}</h4>
          <strong>{mvp.player.display_name}</strong><p><Star size={17} fill="currentColor"/> {mvp.average.toFixed(1)}/10 · {mvp.count} {t('votes','تقييمات')}</p>
          <small>{t('Classement provisoire basé sur les votes reçus.','الترتيب حسب التصويتات الموجودة، وينجم يتبدّل مع التصويتات الجديدة.')}</small></div>
        <Avatar player={mvp.player}/>
      </div>}
      <div className="t24-match-analytics">
        <h4><BarChart3 size={18}/>{t('Statistiques après-match','إحصائيات بعد الماتش')}</h4>
        <div><span><Users size={15}/>{confirmed.length} {t('joueurs confirmés','لاعبين مؤكّدين')}</span>
          <span><Star size={15}/>{votes.length} {t('votes reçus','تقييمات مسجّلة')}</span>
          <span><Trophy size={15}/>{t('Saison','الموسم')} {match.season||'2026/2027'}</span></div>
      </div>
    </div>}
    {error&&<p role="alert" className="auth-error">{error}</p>}
    {feedback&&<p role="status" className="auth-message">{feedback}</p>}
  </section>
}
