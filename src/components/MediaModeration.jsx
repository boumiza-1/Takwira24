import { useCallback, useEffect, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, ShieldAlert, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

function validateImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('الصورة لازم تكون JPG أو PNG أو WebP.')
  if (file.size > 3 * 1024 * 1024) throw new Error('الصورة أكبر من 3MB.')
}
const extFor = file => file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'

export default function MediaModeration({ user, onProfileChanged }) {
  const [media, setMedia] = useState([])
  const [admin, setAdmin] = useState(false)
  const [pendingPreviews, setPendingPreviews] = useState({})
  const [reason, setReason] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reportingId, setReportingId] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reports, setReports] = useState([])

  const loadMedia = useCallback(async () => {
    if (!user) return
    const [{ data: role, error: roleError }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from('t24_moderators').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('t24_media').select('*').order('created_at',{ascending:false}).limit(200)
    ])
    if (roleError || itemsError) { setError((roleError || itemsError).message); return }
    const isModerator = Boolean(role)
    setAdmin(isModerator)
    setMedia(items || [])
    if (isModerator) {
      const { data: issues } = await supabase.from('t24_media_reports').select('*').eq('status','open').order('created_at',{ascending:false})
      setReports(issues || [])
    }
    const permitted = (items || []).filter(item => item.status === 'pending' && (isModerator || item.owner_id === user.id))
    const previews = await Promise.all(permitted.map(async item => {
      const { data, error: urlError } = await supabase.storage.from('t24-pending').createSignedUrl(item.storage_path, 300)
      return [item.id, urlError ? null : data?.signedUrl]
    }))
    setPendingPreviews(Object.fromEntries(previews))
  }, [user?.id])

  useEffect(() => { loadMedia() }, [loadMedia])

  async function submitImage(event, kind) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('');setMessage('')
    try { validateImage(file) } catch (cause) { setError(cause.message); return }
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      const storagePath = user.id + '/' + id + '.' + extFor(file)
      const { error: uploadError } = await supabase.storage.from('t24-pending').upload(storagePath,file,{contentType:file.type,upsert:false})
      if (uploadError) throw uploadError
      const { error: recordError } = await supabase.from('t24_media').insert({
        owner_id:user.id,kind,storage_path:storagePath,mime_type:file.type,caption:kind==='post'?caption.trim():''
      })
      if (recordError) {
        await supabase.storage.from('t24-pending').remove([storagePath])
        throw recordError
      }
      setCaption('')
      setMessage('الصورة وصلت، وتستنى في موافقة الإدارة. ما تظهرش للناس قبل المراجعة.')
      await loadMedia()
    } catch (cause) { setError(cause.message || 'تعذّر رفع الصورة.') }
    finally { setBusy(false) }
  }

  async function review(item, approve) {
    if (!admin) return
    setBusy(true);setError('');setMessage('')
    let approvedPath = null
    try {
      if (approve) {
        const { data: blob, error: downloadError } = await supabase.storage.from('t24-pending').download(item.storage_path)
        if (downloadError) throw downloadError
        const ext = item.storage_path.split('.').pop()
        approvedPath = item.owner_id + '/' + item.id + '.' + ext
        const { error: uploadError } = await supabase.storage.from('t24-approved').upload(approvedPath,blob,{contentType:item.mime_type,upsert:false})
        if (uploadError) throw uploadError
        const { data: publicUrl } = supabase.storage.from('t24-approved').getPublicUrl(approvedPath)
        if (item.kind === 'avatar') {
          const { error: profileError } = await supabase.from('t24_profiles').update({avatar_url:publicUrl.publicUrl}).eq('id',item.owner_id)
          if (profileError) throw profileError
        }
        const { error: approvedError } = await supabase.from('t24_media').update({
          status:'approved',approved_url:publicUrl.publicUrl,reviewed_by:user.id,reviewed_at:new Date().toISOString(),review_reason:null
        }).eq('id',item.id).eq('status','pending')
        if (approvedError) throw approvedError
        setMessage('تمّت الموافقة، والصورة تنجم تظهر للناس.')
      } else {
        if (item.status === 'approved') {
          // Remove public bytes first: never report successful takedown while a public URL still serves the file.
          const removalPath = item.owner_id + '/' + item.id + '.' + item.storage_path.split('.').pop()
          const { error: removalError } = await supabase.storage.from('t24-approved').remove([removalPath])
          if (removalError) throw removalError
          if (item.kind === 'avatar') {
            // Clear only when this is the picture currently shown on that profile.
            const { data: profile } = await supabase.from('t24_profiles').select('avatar_url').eq('id',item.owner_id).maybeSingle()
            if (profile?.avatar_url === item.approved_url) {
              const { error: clearError } = await supabase.from('t24_profiles').update({avatar_url:null}).eq('id',item.owner_id)
              if (clearError) throw clearError
            }
          }
        }
        const { error: rejectError } = await supabase.from('t24_media').update({
          status:'rejected',approved_url:null,reviewed_by:user.id,reviewed_at:new Date().toISOString(),review_reason:reason.trim()||'الصورة تخالف شروط النشر'
        }).eq('id',item.id)
        if (rejectError) throw rejectError
        setMessage('الصورة ترفضت، وما عادش تظهر في التطبيق.')
      }
      if (item.status==='pending') await supabase.storage.from('t24-pending').remove([item.storage_path])
      if (item.status==='approved' && !approve) {
        await supabase.from('t24_media_reports').update({status:'resolved'}).eq('media_id',item.id)
      }
      setReason('')
      await loadMedia()
      onProfileChanged?.()
    } catch (cause) {
      if (approvedPath) {
        // Avoid leaving publicly reachable files when the database review did not succeed.
        await supabase.storage.from('t24-approved').remove([approvedPath])
      }
      setError(cause.message || 'صار خطأ أثناء المراجعة.')
    } finally { setBusy(false) }
  }

  async function submitReport(event) {
    event.preventDefault()
    if (!reportingId || reportReason.trim().length < 3) return
    setBusy(true);setError('')
    const { error: reportError } = await supabase.from('t24_media_reports').insert({
      media_id:reportingId,reporter_id:user.id,reason:reportReason.trim()
    })
    if (reportError) setError(reportError.message)
    else { setMessage('وصل التبليغ للإدارة، باش تتم مراجعته.');setReportingId(null);setReportReason('') }
    setBusy(false)
  }

  const mine = media.filter(item=>item.owner_id===user?.id)
  const approved = media.filter(item=>item.status==='approved' && item.kind==='post')
  const queue = media.filter(item=>item.status==='pending')
  const flagged = new Set(reports.map(item=>item.media_id))
  return <section className="t24-media-section">
    <div className="section-heading"><div><span className="eyebrow">COMMUNITY SAFETY</span><h2>التصاور والمشاركة</h2><p>كل صورة جديدة تتراجع قبل النشر.</p></div></div>
    <div className="t24-upload-actions">
      <label className={'outline-button '+(busy?'t24-disabled':'')}><Camera size={17}/> بدّل تصويرة البروفيل<input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>submitImage(e,'avatar')}/></label>
      <label className={'outline-button '+(busy?'t24-disabled':'')}><ImagePlus size={17}/> أضف صورة للمجتمع<input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>submitImage(e,'post')}/></label>
    </div>
    <label className="field-label">وصف قصير للتصويرة اللي باش تنشرها<input maxLength="500" value={caption} placeholder="مثلاً: ماتش البارح" onChange={e=>setCaption(e.target.value)}/></label>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    {message&&<p className="auth-message" role="status">{message}</p>}
    <div className="t24-moderation-note"><ShieldCheck size={18}/> التصاور ما تظهرش للناس حتى يوافق عليها المسؤول. تنجم تبلغ على أي صورة مخالفة.</div>
    {mine.length>0&&<><h3>تصاوري المبعوثة</h3><div className="t24-media-grid">{mine.map(item=><div className="t24-media-card" key={item.id}>
      {item.status==='approved' ? <img src={item.approved_url} alt={item.caption||'صورة مقبولة'} loading="lazy"/> :
       item.status==='pending' && pendingPreviews[item.id] ? <img src={pendingPreviews[item.id]} alt="صورة في انتظار المراجعة" loading="lazy"/> :
       <div className="t24-media-placeholder"><ImagePlus size={25}/></div>}
      <div><strong>{item.kind==='avatar'?'صورة بروفيل':'صورة منشور'}</strong>
      <small>{item.status==='approved'?'✅ مقبولة':item.status==='pending'?'⏳ تستنى المراجعة':'❌ مرفوضة'}</small>
      {item.status==='rejected'&&<small>{item.review_reason}</small>}</div>
    </div>)}</div></>}
    {approved.length>0&&<><h3>تصاور المجتمع المقبولة</h3><div className="t24-media-grid">{approved.map(item=><div className="t24-media-card" key={item.id}>
      <img src={item.approved_url} alt={item.caption||'صورة رياضية'} loading="lazy"/><div><small>{item.caption}</small>
      {item.owner_id!==user.id&&<button className="t24-report-link" onClick={()=>setReportingId(item.id)}><ShieldAlert size={14}/> تبليغ</button>}</div>
    </div>)}</div></>}
    {reportingId&&<form className="t24-report-form" onSubmit={submitReport}>
      <strong>تبليغ عن صورة مخالفة</strong><textarea rows="2" required minLength="3" maxLength="500" value={reportReason} onChange={e=>setReportReason(e.target.value)} placeholder="علاش الصورة مخالفة؟"/>
      <button disabled={busy} className="primary-button">إبعث التبليغ</button><button type="button" onClick={()=>setReportingId(null)}>إلغاء</button>
    </form>}
    {admin&&<div className="t24-review-admin"><h3><ShieldCheck size={18}/> إدارة مراجعة الصور</h3><p>المسؤول هو اللي يقرّر. الصور المرفوضة ما تظهرش للمستخدمين.</p>
      <label className="field-label">سبب الرفض<input maxLength="300" value={reason} placeholder="سبب الرفض (اختياري)" onChange={e=>setReason(e.target.value)}/></label>
      {queue.length===0&&<div className="t24-empty">ما فمّاش صور تستنّى المراجعة.</div>}
      <div className="t24-media-grid">{queue.map(item=><div className="t24-media-card" key={item.id}>
        {pendingPreviews[item.id]?<img src={pendingPreviews[item.id]} alt="صورة في الانتظار"/>:<div className="t24-media-placeholder">الصورة غير متاحة</div>}
        <div><small>النوع: {item.kind==='avatar'?'بروفيل':'منشور'} • {item.caption||'بدون وصف'}</small>
        <div className="t24-review-buttons"><button disabled={busy} onClick={()=>review(item,true)}><CheckCircle2 size={15}/> قبول</button><button disabled={busy} onClick={()=>review(item,false)}><XCircle size={15}/> رفض</button></div></div>
      </div>)}</div>
      {reports.length>0&&<><h3>تبليغات جديدة</h3>{reports.map(report=><div className="t24-report-row" key={report.id}>
        <span>تبليغ: {report.reason}</span>
        {media.find(item=>item.id===report.media_id&&item.status==='approved')&&<button onClick={()=>review(media.find(item=>item.id===report.media_id),false)} disabled={busy}><Trash2 size={16}/> سحب الصورة</button>}
      </div>)}</>}
    </div>}
  </section>
}
