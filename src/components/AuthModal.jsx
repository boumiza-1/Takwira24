import { useState } from 'react'
import { LockKeyhole, Mail, UserRound, X, Phone, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const redirect = () => window.location.origin + import.meta.env.BASE_URL
const normalizePhone = text => {
  const digits = text.trim().replace(/[\s().-]/g, '')
  const number = digits.startsWith('00') ? '+' + digits.slice(2) : digits.startsWith('+') ? digits : '+216' + digits
  if (!/^\+[1-9]\d{7,14}$/.test(number)) throw new Error('اكتب نمرة صحيحة مع كود البلاد (+216).')
  return number
}

export default function AuthModal({ onClose }) {
  const [method, setMethod] = useState('email')
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const clear = () => { setError(''); setMessage('') }
  const changeMethod = value => { setMethod(value); setSentTo(''); setOtp(''); clear() }
  const changeMode = value => { setMode(value); clear() }

  async function submitEmail(event) {
    event.preventDefault()
    clear()
    if (!isSupabaseConfigured) { setError('قاعدة البيانات موش مربوطة في النسخة هاذي.'); return }
    setBusy(true)
    try {
      if (mode === 'reset') {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, {redirectTo: redirect()})
        if (requestError) throw requestError
        setMessage('إذا الإيميل مسجّل، باش توصلك رسالة لتغيير كلمة السر.')
      } else if (mode === 'signup') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: redirect() }
        })
        if (signupError) throw signupError
        if (data.session) onClose()
        else setMessage('الحساب تسجّل، لكن Supabase مازالت تستوجب تأكيد الإيميل. يلزم المسؤول يعطّل Confirm Email من إعدادات المشروع إذا يحب دخول مباشر.')
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({email:email.trim(), password})
        if (loginError) throw loginError
        if(data.session) onClose()
        else setError('تسجيل الدخول ما كملش. تثبّت من الإيميل وكلمة السر.')
      }
    } catch (cause) { setError(cause.message || 'صار خطأ. عاود جرّب.') }
    finally { setBusy(false) }
  }

  async function requestPhoneCode(event) {
    event.preventDefault(); clear()
    if (!isSupabaseConfigured) { setError('قاعدة البيانات موش مربوطة.'); return }
    setBusy(true)
    try {
      const target = normalizePhone(phone)
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone:target, options: { shouldCreateUser: true, data: { display_name: name.trim() || 'لاعب' } }
      })
      if (sendError) throw sendError
      setSentTo(target)
      setMessage('بعثنالك كود SMS للنمرة ' + target + '. اكتبو هنا باش تأكّد ملكية النمرة.')
    } catch (cause) {
      setError((cause.message || 'تعذّر إرسال الكود') + ' — إذا SMS ما يخدمش، يلزم تفعيل SMS Provider في Supabase.')
    } finally { setBusy(false) }
  }

  async function verifyPhone(event) {
    event.preventDefault(); clear(); setBusy(true)
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({phone:sentTo, token:otp.trim(), type:'sms'})
      if (verifyError) throw verifyError
      if (!data.user?.phone_confirmed_at && !data.user?.confirmed_at) throw new Error('ما نجّمش نثبت النمرة.')
      onClose()
    } catch (cause) { setError(cause.message || 'الكود غلط ولا فات وقتو.') }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="create-modal auth-modal">
      <div className="modal-head"><div><span className="eyebrow">TAKWIRA24 — ACCOUNT</span><h2>حسابك الرياضي ⚽</h2><p>إعمل حساب بإيميل أو نمرة تليفون، وبعد إدخل للتشكيلة.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={21}/></button></div>
      <div className="t24-auth-methods">
        <button type="button" className={method==='email'?'chosen':''} onClick={()=>changeMethod('email')}><Mail size={17}/> بالإيميل</button>
        <button type="button" className={method==='phone'?'chosen':''} onClick={()=>changeMethod('phone')}><Phone size={17}/> بنمرة التليفون</button>
      </div>
      {method==='email'? <form onSubmit={submitEmail}>
        {mode==='signup' && <label className="field-label">إسم اللاعب
          <span className="auth-input-icon"><UserRound size={17}/><input required minLength="2" value={name} onChange={e=>setName(e.target.value)} placeholder="إسمك الكامل"/></span></label>}
        <label className="field-label">البريد الإلكتروني
          <span className="auth-input-icon"><Mail size={17}/><input type="email" required autoComplete="email" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com"/></span></label>
        {mode!=='reset' && <label className="field-label">كلمة السر
          <span className="auth-input-icon"><LockKeyhole size={17}/><input type="password" required minLength="6" autoComplete={mode==='signup'?'new-password':'current-password'} dir="ltr" value={password} onChange={e=>setPassword(e.target.value)} placeholder="6 حروف على الأقل"/></span></label>}
        {error && <p role="alert" className="auth-error">{error}</p>}
        {message && <p role="status" className="auth-message">{message}</p>}
        <button type="submit" disabled={busy} className="primary-button submit-match">{busy?'لحظة...':mode==='signup'?'إعمل حساب جديد':mode==='reset'?'إبعث رابط الاسترجاع':'تسجيل الدخول'}</button>
        <p className="t24-auth-tip"><ShieldCheck size={15}/> الدخول المباشر يستوجب تعطيل Confirm Email من إعدادات Supabase؛ موش من التطبيق.</p>
        <div className="auth-switch">{mode==='signin' ? <>
          <button type="button" onClick={()=>changeMode('signup')}>ما عنديش حساب — نعمل جديد</button>
          <button type="button" onClick={()=>changeMode('reset')}>نسيت كلمة السر؟</button>
        </> : <button type="button" onClick={()=>changeMode('signin')}>عندي حساب — تسجيل الدخول</button>}</div>
      </form> : <form onSubmit={sentTo?verifyPhone:requestPhoneCode}>
        {!sentTo && <label className="field-label">إسم اللاعب (كانك جديد)
          <span className="auth-input-icon"><UserRound size={17}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="إسمك" /></span></label>}
        <label className="field-label">نمرة التليفون
          <span className="auth-input-icon"><Phone size={17}/><input required type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="+216 22 123 456" disabled={!!sentTo} value={sentTo||phone} onChange={e=>setPhone(e.target.value)}/></span>
        </label>
        {sentTo && <label className="field-label">كود SMS
          <span className="auth-input-icon"><ShieldCheck size={17}/><input required inputMode="numeric" autoComplete="one-time-code" dir="ltr" minLength="4" maxLength="8" placeholder="123456" value={otp} onChange={e=>setOtp(e.target.value)}/></span></label>}
        {error && <p role="alert" className="auth-error">{error}</p>}
        {message && <p role="status" className="auth-message">{message}</p>}
        <button type="submit" disabled={busy} className="primary-button submit-match">{busy?'لحظة...':sentTo?'تأكيد الكود والدخول':'إبعث كود SMS'}</button>
        {sentTo && <div className="auth-switch"><button type="button" onClick={()=>{setSentTo('');setOtp('');clear()}}>بدّل النمرة / أعد إرسال الكود</button></div>}
        <p className="t24-auth-tip"><ShieldCheck size={15}/> الدخول بالنمرة يستوجب SMS Provider مفعّل في Supabase.</p>
      </form>}
    </div>
  </div>
}
