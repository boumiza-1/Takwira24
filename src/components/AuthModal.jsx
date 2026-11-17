import { useState } from 'react'
import { LockKeyhole, Mail, UserRound, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'reset') {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + import.meta.env.BASE_URL
        })
        if (requestError) throw requestError
        setMessage('إذا الإيميل مسجّل، باش توصلك رسالة تبديل كلمة السر.')
      } else if (mode === 'signup') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() } }
        })
        if (signupError) throw signupError
        if (data.session) onClose()
        else setMessage('ثبت في الإيميل متاعك وفعّل الحساب، وبعد ارجع ادخل.')
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (loginError) throw loginError
        onClose()
      }
    } catch (cause) {
      setError(cause.message || 'صار خطأ، عاود جرّب.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <form className="create-modal auth-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">TAKWIRA24 ACCOUNT</span>
            <h2>{mode === 'signup' ? 'إعمل حساب لاعب' : mode === 'reset' ? 'استرجاع كلمة السر' : 'أدخل لحسابك'}</h2>
            <p>بالحساب متاعك تنجم تشارك وتكوّن الماتشات وتتابع الدعوات.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={21}/></button>
        </div>
        {mode === 'signup' && <label className="field-label">إسم اللاعب
          <span className="auth-input-icon"><UserRound size={17}/><input required minLength="2" value={name} onChange={event => setName(event.target.value)} placeholder="إسمك الكامل" /></span>
        </label>}
        <label className="field-label">البريد الإلكتروني
          <span className="auth-input-icon"><Mail size={17}/><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="example@email.com" dir="ltr" /></span>
        </label>
        {mode !== 'reset' && <label className="field-label">كلمة السر
          <span className="auth-input-icon"><LockKeyhole size={17}/><input required type="password" minLength="6" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="6 حروف على الأقل" dir="ltr" /></span>
        </label>}
        {error && <p role="alert" className="auth-error">{error}</p>}
        {message && <p role="status" className="auth-message">{message}</p>}
        <button className="primary-button submit-match" type="submit" disabled={busy}>
          {busy ? 'لحظة...' : mode === 'signup' ? 'إنشاء الحساب' : mode === 'reset' ? 'أبعث رابط الاسترجاع' : 'تسجيل الدخول'}
        </button>
        <div className="auth-switch">
          {mode !== 'signin' ? <button type="button" onClick={() => { setMode('signin'); setError(''); setMessage('') }}>عندي حساب، ندخل</button>
            : <><button type="button" onClick={() => { setMode('signup'); setError(''); setMessage('') }}>حساب جديد</button><button type="button" onClick={() => { setMode('reset'); setError(''); setMessage('') }}>نسيت كلمة السر؟</button></>}
        </div>
      </form>
    </div>
  )
}
