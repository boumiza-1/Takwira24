import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Flag, Heart, LockKeyhole, MessageCircle, MessageSquare, RefreshCw, Send, ShieldAlert, ShieldCheck, Trash2, Users, Wifi, WifiOff, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './MatchCommunity.css'

export default function MatchCommunity({ match, entries=[], players=[], user, lang='ar', onPlayerOpen }) {
  const t=(ar,fr)=>lang==='fr'?fr:ar
  const [tab,setTab]=useState('comment')
  const [comments,setComments]=useState([])
  const [chat,setChat]=useState([])
  const [text,setText]=useState({comment:'',chat:''})
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [sending,setSending]=useState(false)
  const [loading,setLoading]=useState(true)
  const [connected,setConnected]=useState(false)
  const [moderator,setModerator]=useState(false)
  const [reports,setReports]=useState([])
  const [reporting,setReporting]=useState(null)
  const [reportText,setReportText]=useState('')
  const [unseen,setUnseen]=useState(0)
  const chatBottom=useRef(null)
  const currentTab=useRef(tab)
  const myId=user?.id
  const matchId=match?.id
  const participating=!!myId && (
    myId===match.host_id || myId===match.opponent_id ||
    entries.some(row=>row.match_id===match.id&&row.player_id===myId&&row.status==='confirmed')
  )
  const canComment=participating&&match.status!=='cancelled'
  const canChat=participating&&['open','full','postponed'].includes(match.status)
  const clock=time=>new Date(time).toLocaleTimeString(lang==='fr'?'fr-TN':'ar-TN',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Tunis'})
  const day=time=>new Date(time).toLocaleDateString(lang==='fr'?'fr-TN':'ar-TN',{day:'numeric',month:'short',timeZone:'Africa/Tunis'})
  const profileFor=id=>players.find(p=>p.id===id)
  const nameFor=m=>m.t24_profiles?.display_name||profileFor(m.author_id)?.display_name||t('لاعب Takwira24','Joueur Takwira24')
  const avatarFor=m=>m.t24_profiles?.avatar_url||profileFor(m.author_id)?.avatar_url
  const canSeeChat=participating||moderator

  useEffect(()=>{currentTab.current=tab;if(tab==='chat')setUnseen(0)},[tab])
  useEffect(()=>{if(tab==='chat'&&canSeeChat)chatBottom.current?.scrollIntoView({block:'end',behavior:'smooth'})},[chat.length,tab,canSeeChat])

  const fetchPosts=useCallback(async()=>{
    if(!matchId||!myId)return
    const fields='id,match_id,author_id,kind,body,is_hidden,created_at,t24_profiles!t24_match_messages_author_id_fkey(display_name,avatar_url,public_id)'
    const fetchKind=kind=>supabase.from('t24_match_messages').select(fields).eq('match_id',matchId)
      .eq('kind',kind).order('created_at',{ascending:false}).limit(kind==='chat'?150:100)
    const [posts,conversation]=await Promise.all([fetchKind('comment'),fetchKind('chat')])
    if(posts.error)throw posts.error
    if(conversation.error)throw conversation.error
    setComments((posts.data||[]).reverse())
    setChat((conversation.data||[]).reverse())
  },[matchId,myId])

  const fetchReports=useCallback(async()=>{
    if(!myId||!moderator||!matchId)return
    const {data,error:reportError}=await supabase.from('t24_match_message_reports')
      .select('id,message_id,reason,created_at,t24_match_messages!inner(match_id)').eq('t24_match_messages.match_id',matchId).is('resolved_at',null).order('created_at',{ascending:false}).limit(80)
    if(!reportError)setReports(data||[])
  },[myId,moderator,matchId])

  useEffect(()=>{
    let cancelled=false
    setComments([]);setChat([]);setError('');setConnected(false);setLoading(true);setUnseen(0);setModerator(false)
    if(!myId||!matchId){setLoading(false);return}
    async function init(){
      const {data:admin,error:roleError}=await supabase.from('t24_moderators').select('user_id').eq('user_id',myId).maybeSingle()
      if(!cancelled && !roleError)setModerator(Boolean(admin))
      try{await fetchPosts()}catch(e){if(!cancelled)setError(e.message||String(e))}
      if(!cancelled)setLoading(false)
    }
    init()
    const channel=supabase.channel('t24-community-'+matchId+'-'+myId)
      .on('postgres_changes',{event:'*',schema:'public',table:'t24_match_messages',filter:'match_id=eq.'+matchId},payload=>{
        if(payload.eventType==='INSERT'&&payload.new?.kind==='chat'&&payload.new.author_id!==myId&&currentTab.current!=='chat')setUnseen(n=>n+1)
        fetchPosts().catch(e=>{if(!cancelled)setError(e.message)})
      }).subscribe(status=>{if(!cancelled)setConnected(status==='SUBSCRIBED')})
    const onVisible=()=>{if(document.visibilityState==='visible')fetchPosts().catch(()=>{})}
    document.addEventListener('visibilitychange',onVisible)
    // Reconcile deletions and events missed on suspended mobile browsers.
    const interval=setInterval(()=>{if(document.visibilityState==='visible')fetchPosts().catch(()=>{})},20000)
    return()=>{cancelled=true;clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);supabase.removeChannel(channel)}
  },[myId,matchId,fetchPosts])
  useEffect(()=>{fetchReports()},[fetchReports])

  async function send(event){
    event?.preventDefault?.()
    const kind=tab
    const message=text[kind]?.trim()
    if(!myId||!participating||!message||sending||message.length>(kind==='chat'?400:1000))return
    if(kind==='chat'&&!canChat||kind==='comment'&&!canComment)return
    setSending(true);setError('');setSuccess('')
    try{
      const {error:postError}=await supabase.from('t24_match_messages').insert({
        match_id:matchId,author_id:myId,kind,body:message
      })
      if(postError)throw postError
      setText(prev=>({...prev,[kind]:''}))
      await fetchPosts()
      if(kind==='comment')setSuccess(t('تسجّل التعليق متاعك ✅','Commentaire publié ✅'))
    }catch(e){setError(e.message||t('ما نجّمناش نبعثوا الرسالة','Message non envoyé'))}
    finally{setSending(false)}
  }
  async function removePost(m){
    const isOwner=m.author_id===myId
    if(!isOwner&&!moderator)return
    if(!window.confirm(t('متأكّد تحب تنحّي الرسالة؟','Retirer ce message ?')))return
    setSending(true);setError('')
    try{
      const result=moderator?await supabase.from('t24_match_messages').update({is_hidden:true}).eq('id',m.id):await supabase.from('t24_match_messages').delete().eq('id',m.id)
      if(result.error)throw result.error
      if(moderator)await supabase.from('t24_match_message_reports').update({resolved_at:new Date().toISOString()}).eq('message_id',m.id)
      await fetchPosts();await fetchReports()
      setSuccess(t('الرسالة تنحّات.','Message retiré.'))
    }catch(e){setError(e.message)}
    finally{setSending(false)}
  }
  async function reportPost(e){
    e.preventDefault()
    if(!reporting||reportText.trim().length<3)return
    setSending(true);setError('');setSuccess('')
    try{
      const {error:reportError}=await supabase.from('t24_match_message_reports').insert({
        message_id:reporting.id,reporter_id:myId,reason:reportText.trim()
      })
      if(reportError)throw reportError
      setReporting(null);setReportText('')
      setSuccess(t('التبليغ وصل للإدارة.','Signalement envoyé à la modération.'))
    }catch(err){setError(err.message)}
    finally{setSending(false)}
  }
  const list=tab==='chat'?chat:comments
  const allowed=tab==='chat'?canChat:canComment
  return <section className="t24-community" dir={lang==='fr'?'ltr':'rtl'} aria-label={t('تعليقات ودردشة الماتش','Commentaires et chat du match')}>
    <div className="t24-community-header"><div><span className="t24-community-eyebrow">TAKWIRA24 · THE LOCKER ROOM</span>
      <h3><MessageCircle size={22}/>{t('مجتمع الماتش','Communauté du match')}</h3>
      <p>{t('علّق على الماتش وإحكي مباشرة مع اللاعبين.','Commente le match et discute en direct avec les joueurs.')}</p></div>
      <span className={'t24-community-connection '+(connected?'online':'')}>{connected?<Wifi size={15}/>:<WifiOff size={15}/>}
        {connected?t('متصل','Connecté'):t('جاري الربط','Connexion')}</span>
    </div>
    <div className="t24-community-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab==='comment'} className={tab==='comment'?'active':''} onClick={()=>setTab('comment')}><MessageSquare size={17}/>{t('التعليقات','Commentaires')}<b>{comments.length}</b></button>
      <button type="button" role="tab" aria-selected={tab==='chat'} className={tab==='chat'?'active':''} onClick={()=>setTab('chat')}><span className="t24-community-live-dot"/> LIVE CHAT {unseen>0&&<b className="t24-community-unseen">{unseen}</b>}</button>
      <button type="button" className="t24-community-reload" title={t('تحديث','Actualiser')} aria-label={t('تحديث','Actualiser')} onClick={()=>fetchPosts().catch(e=>setError(e.message))}><RefreshCw size={17}/></button>
    </div>
    {!myId?<div className="t24-community-locked"><LockKeyhole size={24}/><strong>{t('إعمل Login باش تشوف التعليقات','Connecte-toi pour consulter les commentaires')}</strong></div>:
      tab==='chat'&&!canSeeChat?<div className="t24-community-locked"><LockKeyhole size={27}/>
        <strong>{t('Live Chat خاص بلاعبين الماتش','Chat réservé aux joueurs du match')}</strong>
        <p>{t('لازم تكون مشارك ومقبول في التشكيلة باش تقرى وتكتب في الدردشة.','Il faut être confirmé dans la composition pour voir et écrire dans le chat.')}</p>
      </div>:<>
        <div className={'t24-community-feed '+(tab==='chat'?'chat':'comments')} aria-live="polite">
          {loading?<div className="t24-community-empty">{t('جاري تحميل الرسائل...','Chargement des messages...')}</div>:
          list.length===0?<div className="t24-community-empty"><MessageCircle size={30}/>
            <strong>{tab==='chat'?t('مازال ما فماش رسائل','Aucun message pour le moment'):t('مازال ما فماش تعليقات','Aucun commentaire pour le moment')}</strong>
            <small>{allowed?t('كون أول لاعب يكتب!','Sois le premier à participer !'):t('المشاركة متاحة للاعبين المؤكّدين','Réservé aux joueurs confirmés')}</small>
          </div>:list.map(m=><article key={m.id} className={'t24-community-item '+(m.author_id===myId?'mine':'')+(m.is_hidden?' hidden':'')}>
            <button type="button" className="t24-community-avatar" title={nameFor(m)} onClick={()=>{const p=profileFor(m.author_id);if(p)onPlayerOpen?.(p)}} disabled={!profileFor(m.author_id)}>
              {avatarFor(m)?<img src={avatarFor(m)} alt={nameFor(m)} loading="lazy"/>:<span>{nameFor(m).slice(0,2).toUpperCase()}</span>}
            </button>
            <div className="t24-community-item-main">
              <div className="t24-community-meta"><strong>{nameFor(m)}</strong>{m.author_id===myId&&<span className="t24-community-you">{t('إنت','Vous')}</span>}<small dir="ltr">{day(m.created_at)} · {clock(m.created_at)}</small></div>
              <p>{m.is_hidden?t('هذا المحتوى تنحّى من طرف الإدارة.','Contenu retiré par la modération.'):m.body}</p>
              {!m.is_hidden&&<div className="t24-community-item-actions">
                {(m.author_id===myId||moderator)&&<button type="button" disabled={sending} onClick={()=>removePost(m)}><Trash2 size={13}/>{t('حذف','Supprimer')}</button>}
                {m.author_id!==myId&&<button type="button" onClick={()=>{setReporting(m);setReportText('')}}><Flag size={13}/>{t('تبليغ','Signaler')}</button>}
              </div>}
            </div>
          </article>)}
          <span ref={chatBottom}/>
        </div>
        {allowed?<form className="t24-community-compose" onSubmit={send}>
          <label htmlFor={'t24-community-input-'+matchId}>{tab==='chat'?t('رسالة سريعة للاعبين','Message aux joueurs'):t('اكتب تعليقك على الماتش','Ton commentaire sur le match')}</label>
          <div className="t24-community-compose-row"><textarea id={'t24-community-input-'+matchId} value={text[tab]} maxLength={tab==='chat'?400:1000} rows={tab==='chat'?2:3} placeholder={tab==='chat'?t('شنوة الأخبار يا جماعة؟ ⚽','On se retrouve à quelle heure ? ⚽'):t('شنوة رأيك في الماتش؟','Ton avis sur la rencontre...')}
            onChange={e=>setText(prev=>({...prev,[tab]:e.target.value}))} onKeyDown={e=>{if(tab==='chat'&&e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e)}}}/>
            <button type="submit" disabled={!text[tab]?.trim()||sending} aria-label={t('ابعث','Envoyer')}><Send size={20}/><span>{t('ابعث','Envoyer')}</span></button></div>
          <small>{text[tab]?.length||0}/{tab==='chat'?400:1000} · {t('ممنوع السبّ والمحتوى المخالف','Respect et fair-play obligatoires')}</small>
        </form>:<div className="t24-community-readonly"><LockKeyhole size={17}/>{tab==='chat'?
          t('الدردشة مسكّرة بعد نهاية الماتش، تنجم تقرى الرسائل السابقة.','Le chat est fermé après le match. Les anciens messages restent consultables.'):
          t('التعليق متاح للمشاركين المؤكّدين فقط.','Seuls les participants confirmés peuvent commenter.')}</div>}
      </>}
    {error&&<p role="alert" className="auth-error t24-community-feedback">{error}</p>}
    {success&&<p role="status" className="auth-message t24-community-feedback">{success}</p>}
    {reporting&&<form className="t24-community-report" onSubmit={reportPost}>
      <div><strong><ShieldAlert size={18}/>{t('بلّغ على محتوى مخالف','Signaler un message')}</strong><button type="button" onClick={()=>setReporting(null)} aria-label="Fermer"><X size={17}/></button></div>
      <textarea required minLength={3} maxLength={500} value={reportText} onChange={e=>setReportText(e.target.value)} placeholder={t('اكتب سبب التبليغ...','Pourquoi ce message est-il inapproprié ?')}/>
      <button type="submit" disabled={sending||reportText.trim().length<3}><Flag size={15}/>{t('ابعث التبليغ','Envoyer le signalement')}</button>
    </form>}
    {moderator&&reports.length>0&&<div className="t24-community-mod"><h4><ShieldCheck size={17}/>{t('تبليغات تستنّى المراقبة','Signalements à examiner')} ({reports.length})</h4>
      {reports.map(rep=><div key={rep.id} className="t24-community-report-row"><span>{rep.reason}</span>
        <button type="button" disabled={sending} onClick={()=>{
          const m=[...comments,...chat].find(item=>item.id===rep.message_id)
          if(m)removePost(m)
          else setError(t('الرسالة موش ظاهرة في الماتش الحالي.','Message hors du match actuel.'))
        }}>{t('مراجعة / حذف','Examiner / retirer')}</button></div>)}
    </div>}
  </section>
}
