import { useState } from 'react'
import { LockKeyhole, Mail, UserRound, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const resetFeedback = () => { setError(''); setMessage('') }
  const switchMode = value => { setMode(value); resetFeedback() }

  async function submit(event) {
    event.preventDefault()
    resetFeedback()
    if (!isSupabaseConfigured) {
      setError('الاتصال بقاعدة البيانات موش مهيأ. اتصل بإدارة التطبيق.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'reset') {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + import.meta.env.BASE_URL
        })
        if (requestError) throw requestError
        setMessage('إذا الإيميل مسجّل، باش توصلك رسالة لتبديل كلمة السر.')
      } else if (mode === 'signup') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL }
        })
        if (signupError) throw signupError
        if (data.session) onClose()
        else setMessage('تمّ إنشاء الحساب. ثبّت الإيميل متاعك وفعّلو، وبعد اعمل دخول.')
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (loginError) throw loginError
        onClose()
      }
    } catch (cause) {
      setError(cause.message || 'صار خطأ. عاود جرّب.')
    } finally {
      setBusy(false)
    }
  }

  async function facebookSignIn() {
    resetFeedback()
    if (!isSupabaseConfigured) { setError('Supabase موش مربوطة.'); return }
    setBusy(true)
    try {
      const { error: facebookError } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo: window.location.origin + import.meta.env.BASE_URL }
      })
      if (facebookError) throw facebookError
    } catch (cause) {
      setError(cause.message || 'الدخول عبر Facebook موش متاح توا. يلزم تفعيل Facebook Login في Supabase وMeta.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="create-modal auth-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">TAKWIRA24 ACCOUNT</span>
            <h2>{mode === 'signup' ? 'إعمل حساب لاعب' : mode === 'reset' ? 'استرجاع كلمة السر' : 'أدخل لحسابك'}</h2>
            <p>ملفك الرياضي والماتشات متاعك محفوظين في حسابك.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={21}/></button>
        </div>
        {mode === 'signup' && <label className="field-label">إسم اللاعب
          <span className="auth-input-icon"><UserRound size={17}/><input required minLength="2" value={name} onChange={e => setName(e.target.value)} placeholder="إسمك الكامل" /></span>
        </label>}
        <label className="field-label">البريد الإلكتروني
          <span className="auth-input-icon"><Mail size={17}/><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" dir="ltr" /></span>
        </label>
        {mode !== 'reset' && <label className="field-label">كلمة السر
          <span className="auth-input-icon"><LockKeyhole size={17}/><input required type="password" minLength="6" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="6 حروف على الأقل" dir="ltr" /></span>
        </label>}
        {error && <p role="alert" className="auth-error">{error}</p>}
        {message && <p role="status" className="auth-message">{message}</p>}
        <button className="primary-button submit-match" type="submit" disabled={busy}>
          {busy ? 'لحظة...' : mode === 'signup' ? 'إنشاء حساب جديد' : mode === 'reset' ? 'أبعث رابط الاسترجاع' : 'تسجيل الدخول'}
        </button>
        {mode !== 'reset' && <>
          <div className="auth-divider"><span>أو</span></div>
          <button type="button" className="facebook-button" disabled={busy} onClick={facebookSignIn}>
            <span className="facebook-letter">f</span> متابعة بحساب Facebook
          </button>
          <p className="oauth-note">الدخول عبر Facebook يتطلب تفعيل الخدمة من إدارة التطبيق.</p>
        </>}
        <div className="auth-switch">
          {mode === 'signin' ? <>
            <button type="button" onClick={() => switchMode('signup')}>ما عنديش حساب — إنشاء حساب</button>
            <button type="button" onClick={() => switchMode('reset')}>نسيت كلمة السر؟</button>
          </> : <button type="button" onClick={() => switchMode('signin')}>عندي حساب — تسجيل الدخول</button>}
        </div>
      </form>
    </div>
  )
}
