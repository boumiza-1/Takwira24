import { useEffect, useState } from 'react'
import { Bell, Check, X, Users, Trophy, Clock3, CheckCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Persistent private in-app inbox; notifications survive logouts and are refreshed live.
export default function NotificationsPanel({ user, onOpenMatch, onAcceptInvite, onDecideRequest, onDecideChallenge, onRefresh }) {
  const [open,setOpen]=useState(false)
  const [items,setItems]=useState([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function reload() {
    if(!user) return
    const { data,error:readError }=await supabase.from('t24_notifications').select('*')
      .eq('user_id',user.id).order('created_at',{ascending:false}).limit(100)
    if(readError) setError(readError.message)
    else {setItems(data||[]);setError('')}
  }
  useEffect(()=>{
    if(!user){setItems([]);setOpen(false);return}
    reload()
    const channel=supabase.channel('t24-inbox-'+user.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'t24_notifications',filter:'user_id=eq.'+user.id},()=>{reload();onRefresh?.()})
      .subscribe()
    // Also recover notifications if a phone/browser was asleep while events were sent.
    const visibility=()=>{if(document.visibilityState==='visible'){reload();onRefresh?.()}}
    document.addEventListener('visibilitychange',visibility)
    const interval=setInterval(()=>{if(document.visibilityState==='visible')reload()},25000)
    return()=>{supabase.removeChannel(channel);document.removeEventListener('visibilitychange',visibility);clearInterval(interval)}
  },[user?.id])
  if(!user)return null
  const unread=items.filter(n=>!n.read_at).length
  const markRead=async notification=>{
    if(notification.read_at)return
    const {error:markError}=await supabase.from('t24_notifications').update({read_at:new Date().toISOString()}).eq('id',notification.id)
    if(!markError) setItems(previous=>previous.map(n=>n.id===notification.id?{...n,read_at:new Date().toISOString()}:n))
  }
  const allRead=async ()=>{
    const {error:markError}=await supabase.from('t24_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null)
    if(markError)setError(markError.message)
    else setItems(previous=>previous.map(n=>({...n,read_at:n.read_at||new Date().toISOString()})))
  }
  async function action(notification,kind,accept){
    setBusy(true);setError('')
    try{
      await markRead(notification)
      await (kind==='invitation'?onAcceptInvite(notification,accept)
        :kind==='team_request'?onDecideRequest(notification,accept)
        :onDecideChallenge(notification,accept))
      await reload()
    }catch(cause){setError(cause?.message||'ما نجّمش نكمل العملية.')}
    finally{setBusy(false)}
  }
  return <div className="t24-notification-root" dir="rtl">
    <button type="button" className="t24-notification-trigger" aria-label="الإشعارات" title="الإشعارات" onClick={()=>{setOpen(v=>!v);if(!open)reload()}}>
      <Bell size={20}/>{unread>0&&<span>{unread>99?'99+':unread}</span>}
    </button>
    {open&&<div className="t24-notifications-popover">
      <div className="t24-notifications-top"><div><small>TAKWIRA24</small><h3>🔔 الإشعارات {unread>0&&'('+unread+')'}</h3></div><button type="button" aria-label="إغلاق" onClick={()=>setOpen(false)}><X size={18}/></button></div>
      <div className="t24-notifications-tools"><span>دعوات الماتش، طلبات الفرق والتحدّيات</span><button type="button" onClick={allRead} disabled={!unread}>قرأت الكل <CheckCheck size={15}/></button></div>
      {error&&<div role="alert" className="auth-error">{error}</div>}
      <div className="t24-notifications-list">
        {items.length===0&&<div className="t24-empty"><Bell size={23}/> ما عندكش إشعارات توا</div>}
        {items.map(n=><article key={n.id} className={'t24-notice '+(!n.read_at?'t24-notice-new':'')}>
          <div className="t24-notice-icon">{n.kind.includes('challenge')?'⚔️':n.kind.includes('team')?'👥':'⚽'}</div>
          <div className="t24-notice-content"><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('fr-TN',{dateStyle:'short',timeStyle:'short'})}</small>
            {['invitation','team_request','challenge'].includes(n.kind)&&<div className="t24-notice-actions">
              <button type="button" disabled={busy} onClick={()=>action(n,n.kind,true)}><Check size={14}/> قبول</button>
              <button type="button" disabled={busy} onClick={()=>action(n,n.kind,false)}><X size={14}/> رفض</button>
            </div>}
            <button type="button" className="t24-notice-link" onClick={()=>{markRead(n);onOpenMatch?.(n.match_id);setOpen(false)}}>شوف الماتش</button>
          </div>
          {!n.read_at&&<i className="t24-unread-dot"/>}
        </article>)}
      </div>
    </div>}
  </div>
}
