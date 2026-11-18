import { useCallback, useEffect, useState } from 'react'
import { Camera, ImagePlus, ShieldAlert, ShieldCheck, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const translations=(lang,ar,fr)=>lang==='fr'?fr:ar
const extFor=file=>file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
function validateImage(file) {
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('JPG / PNG / WebP uniquement')
  if(file.size>3*1024*1024) throw Error('Taille maximale : 3 Mo')
}

export default function MediaModeration({user,onProfileChanged,lang='ar'}) {
  const t=(ar,fr)=>translations(lang,ar,fr)
  const [media,setMedia]=useState([])
  const [admin,setAdmin]=useState(false)
  const [reports,setReports]=useState([])
  const [previews,setPreviews]=useState({})
  const [caption,setCaption]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [reportId,setReportId]=useState(null)
  const [reportText,setReportText]=useState('')
  const [reason,setReason]=useState('')

  const refresh=useCallback(async()=>{
    if(!user)return
    const [role,imgs]=await Promise.all([
      supabase.from('t24_moderators').select('user_id').eq('user_id',user.id).maybeSingle(),
      supabase.from('t24_media').select('*').order('created_at',{ascending:false}).limit(250)
    ])
    if(role.error||imgs.error){setError((role.error||imgs.error).message);return}
    setAdmin(Boolean(role.data))
    setMedia(imgs.data||[])
    const old=(imgs.data||[]).filter(m=>m.status==='pending' && (m.owner_id===user.id||role.data))
    const signed=await Promise.all(old.map(async m=>{
      const {data}=await supabase.storage.from('t24-pending').createSignedUrl(m.storage_path,300)
      return [m.id,data?.signedUrl||null]
    }))
    setPreviews(Object.fromEntries(signed))
    if(role.data){
      const {data, error:reportError}=await supabase.from('t24_media_reports').select('*')
        .eq('status','open').order('created_at',{ascending:false}).limit(80)
      if(!reportError)setReports(data||[])
    }
  },[user?.id])
  useEffect(()=>{refresh()},[refresh])

  async function upload(event,kind){
    const file=event.target.files?.[0];event.target.value=''
    if(!file)return
    setBusy(true);setError('');setMessage('')
    let path
    try {
      validateImage(file)
      path=user.id+'/'+crypto.randomUUID()+'.'+extFor(file)
      // No prior approval: the file is published immediately to the public gallery.
      const {error:uploadError}=await supabase.storage.from('t24-approved').upload(path,file,{contentType:file.type,upsert:false})
      if(uploadError)throw uploadError
      const {data:record,error:recordError}=await supabase.from('t24_media').insert({
        owner_id:user.id,kind,storage_path:path,mime_type:file.type,
        caption:kind==='post'?caption.trim():'',status:'approved'
      }).select('id,approved_url').single()
      if(recordError)throw recordError
      if(kind==='avatar'){
        const {error:profileError}=await supabase.from('t24_profiles')
          .update({avatar_url:record.approved_url,updated_at:new Date().toISOString()}).eq('id',user.id)
        if(profileError)throw profileError
      }
      setCaption('')
      setMessage(t('✅ الصورة ظهرت مباشرة في التطبيق.','✅ Photo publiée immédiatement.'))
      await refresh()
      onProfileChanged?.()
    }catch(cause){
      if(path && /does not exist|duplicate key|permission denied|row-level security/i.test(cause.message||'')){
        await supabase.storage.from('t24-approved').remove([path])
      }
      setError(cause.message||t('صار خطأ أثناء الرفع','Échec du téléchargement'))
    }finally{setBusy(false)}
  }

  async function removeImage(item) {
    if(!admin)return
    setBusy(true);setError('')
    try{
      if(item.status==='approved'){
        const {error:deleteError}=await supabase.storage.from('t24-approved').remove([item.storage_path])
        if(deleteError)throw deleteError
        if(item.kind==='avatar'){
          const {data:p}=await supabase.from('t24_profiles').select('avatar_url').eq('id',item.owner_id).maybeSingle()
          if(p?.avatar_url===item.approved_url){
            const {error:clearError}=await supabase.from('t24_profiles')
              .update({avatar_url:null}).eq('id',item.owner_id)
            if(clearError)throw clearError
          }
        }
      } else if(item.status==='pending') {
        const {error:legacyError}=await supabase.storage.from('t24-pending').remove([item.storage_path])
        if(legacyError)throw legacyError
      }
      const {error:updateError}=await supabase.from('t24_media').update({
        status:'rejected',approved_url:null,review_reason:reason.trim()||'Removed by moderator',
        reviewed_by:user.id,reviewed_at:new Date().toISOString()
      }).eq('id',item.id)
      if(updateError)throw updateError
      await supabase.from('t24_media_reports').update({status:'resolved'}).eq('media_id',item.id)
      setMessage(t('✅ الصورة تنحّات من النشر.','✅ Photo retirée de la publication.'))
      await refresh()
      onProfileChanged?.()
    }catch(cause){setError(cause.message||t('فشل حذف الصورة','Échec du retrait'))}
    finally{setBusy(false)}
  }

  // Legacy pending images can be published by the moderator without reuploading.
  async function approveLegacy(item){
    if(!admin||item.status!=='pending')return
    setBusy(true);setError('')
    let dest
    try {
      const {data:blob,error:downloadError}=await supabase.storage.from('t24-pending').download(item.storage_path)
      if(downloadError)throw downloadError
      dest=item.owner_id+'/'+item.id+'.'+item.storage_path.split('.').pop()
      const {error:uploadError}=await supabase.storage.from('t24-approved')
        .upload(dest,blob,{contentType:item.mime_type})
      if(uploadError)throw uploadError
      const url=supabase.storage.from('t24-approved').getPublicUrl(dest).data.publicUrl
      const {error:approvedError}=await supabase.from('t24_media').update({
        status:'approved',approved_url:url,reviewed_by:user.id,reviewed_at:new Date().toISOString()
      }).eq('id',item.id)
      if(approvedError)throw approvedError
      if(item.kind==='avatar'){
        const {error:avatarError}=await supabase.from('t24_profiles').update({avatar_url:url}).eq('id',item.owner_id)
        if(avatarError)throw avatarError
      }
      await supabase.storage.from('t24-pending').remove([item.storage_path])
      setMessage(t('الصورة القديمة تنشرت','Ancienne photo publiée'))
      await refresh();onProfileChanged?.()
    }catch(cause){setError(cause.message)}
    finally{setBusy(false)}
  }

  async function report(event){
    event.preventDefault()
    if(!reportId||reportText.trim().length<3)return
    setBusy(true);setError('')
    const {error:reportError}=await supabase.from('t24_media_reports').insert({
      media_id:reportId,reporter_id:user.id,reason:reportText.trim()
    })
    if(reportError)setError(reportError.message)
    else {
      setMessage(t('التبليغ وصل للإدارة','Signalement envoyé à la modération'))
      setReportId(null);setReportText('')
    }
    setBusy(false)
  }
  const mine=media.filter(m=>m.owner_id===user.id)
  const published=media.filter(m=>m.status==='approved'&&m.kind==='post')
  const waiting=media.filter(m=>m.status==='pending')
  const flagged=new Set(reports.map(r=>r.media_id))
  const display=(items,isAdmin=false)=><div className="t24-media-grid">{items.map(item=><article className="t24-media-card" key={item.id}>
    {item.status==='approved'&&item.approved_url?<img src={item.approved_url} alt={item.caption||'Sports photo'} loading="lazy"/>:
      previews[item.id]?<img src={previews[item.id]} alt="Pending photo" loading="lazy"/>:
      <div className="t24-media-placeholder"><Camera/></div>}
    <div>
      <strong>{item.kind==='avatar'?t('تصويرة البروفيل','Photo de profil'):t('تصويرة منشور','Publication')}</strong>
      {item.caption&&<small>{item.caption}</small>}
      <small>{item.status==='approved'?t('✅ منشورة','✅ Publiée'):item.status==='rejected'?t('❌ محذوفة','❌ Retirée'):t('⏳ صورة قديمة تستنّى','⏳ Ancienne photo en attente')}</small>
      {isAdmin&&item.status==='pending'&&<button type="button" className="t24-review-approve" disabled={busy} onClick={()=>approveLegacy(item)}><CheckCircle2 size={15}/>{t('انشر','Publier')}</button>}
      {isAdmin&&item.status!=='rejected'&&<button type="button" className="t24-review-remove" disabled={busy} onClick={()=>removeImage(item)}><Trash2 size={15}/>{t('اسحب الصورة','Retirer')}</button>}
      {!isAdmin&&item.owner_id!==user.id&&<button type="button" className="t24-report-link" onClick={()=>setReportId(item.id)}><ShieldAlert size={14}/>{t('بلّغ','Signaler')}</button>}
    </div>
  </article>)}</div>

  return <section className="t24-media-section" dir={lang==='fr'?'ltr':'rtl'}>
    <div className="section-heading"><div><span className="eyebrow">MEDIA • TAKWIRA24</span><h2>{t('التصاور والمشاركة','Photos & communauté')}</h2>
      <p>{t('التصاور تتنشر مباشرة، والإدارة تنجم تسحب المخالف.','Publication immédiate. Le modérateur peut retirer un contenu signalé.')}</p></div></div>
    <div className="t24-upload-actions">
      <label className={'outline-button '+(busy?'t24-disabled':'')}><Camera size={17}/>{t('بدّل صورة البروفيل','Changer ma photo de profil')}
        <input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>upload(e,'avatar')}/></label>
      <label className={'outline-button '+(busy?'t24-disabled':'')}><ImagePlus size={17}/>{t('انشر تصويرة','Publier une photo')}
        <input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>upload(e,'post')}/></label>
    </div>
    <label className="field-label">{t('وصف التصويرة','Légende')}<input maxLength="500" value={caption} onChange={e=>setCaption(e.target.value)} placeholder={t('ماتش صحابنا','Notre match du week-end')}/></label>
    {error&&<p role="alert" className="auth-error">{error}</p>}{message&&<p role="status" className="auth-message">{message}</p>}
    <div className="t24-moderation-note"><ShieldCheck size={18}/>{t('الصور تظهر مباشرة، وتنجم تبلّغ على المخالفات.','Les photos paraissent immédiatement. Signalez toute publication abusive.')}</div>
    {!!mine.length&&<><h3>{t('تصاوري','Mes photos')}</h3>{display(mine)}</>}
    {!!published.length&&<><h3>{t('المجتمع الرياضي','Communauté sportive')}</h3>{display(published)}</>}
    {reportId&&<form className="t24-report-form" onSubmit={report}>
      <strong>{t('بلّغ على صورة مخالفة','Signaler une photo')}</strong>
      <textarea rows="2" minLength="3" maxLength="500" value={reportText} onChange={e=>setReportText(e.target.value)} required placeholder={t('شنوة المخالفة؟','Pourquoi ce signalement ?')}/>
      <button className="primary-button" disabled={busy}>{t('إبعث','Envoyer')}</button><button type="button" onClick={()=>setReportId(null)}>{t('إلغاء','Annuler')}</button>
    </form>}
    {admin&&<div className="t24-review-admin">
      <h3><ShieldCheck size={18}/>{t('مراقبة المحتوى','Modération des contenus')}</h3>
      <label className="field-label">{t('سبب الحذف','Motif du retrait')}<input maxLength="300" value={reason} onChange={e=>setReason(e.target.value)}/></label>
      {!!reports.length&&<><h3>{t('التبليغات الجديدة','Signalements en attente')}</h3>{reports.map(report=><div className="t24-report-row" key={report.id}>
        <span>{report.reason}</span><button type="button" disabled={busy} onClick={()=>{const item=media.find(m=>m.id===report.media_id); if(item)removeImage(item)}}><Trash2 size={15}/>{t('حذف الصورة','Retirer')}</button>
      </div>)}</>}
      <h3>{t('الصور المنشورة','Toutes les photos publiées')}</h3>{display(media.filter(m=>m.status==='approved'),true)}
      {!!waiting.length&&<><h3>{t('صور قديمة','Anciennes photos')}</h3>{display(waiting,true)}</>}
    </div>}
  </section>
}
