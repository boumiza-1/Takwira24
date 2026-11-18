import { useState } from 'react'
import { LockKeyhole, Mail, UserRound, X, Phone, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const redirect=()=>new URL(import.meta.env.BASE_URL,window.location.origin).toString()
const normalizeEmail=text=>{
  const value=text.trim().toLowerCase()
  if(value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))throw Error('Adresse email invalide.')
  return value
}
const normalizePhone=text=>{
  const digits=text.trim().replace(/[\s().-]/g,'')
  const value=digits.startsWith('00')?'+'+digits.slice(2):digits.startsWith('+')?digits:'+216'+digits
  if(!/^\+[1-9]\d{7,14}$/.test(value))throw Error('Numéro invalide. Ex : +21622123456')
  return value
}
export default function AuthModal({onClose,lang='ar'}){
  const t=(ar,fr)=>lang==='fr'?fr:ar
  const [method,setMethod]=useState('email'),[mode,setMode]=useState('signin')
  const [email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [name,setName]=useState(''),[phone,setPhone]=useState('')
  const [sentTo,setSentTo]=useState(''),[otp,setOtp]=useState('')
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const clear=()=>{setError('');setMessage('')}
  const changeMethod=v=>{setMethod(v);setSentTo('');setOtp('');clear()}
  const changeMode=v=>{setMode(v);clear()}
  const friendlyError=e=>{
    const message=e?.message||''
    if(/user already registered|already been registered/i.test(message))return t('الإيميل هذا مسجّل قبل. إعمل Login.','Cet email existe déjà. Connectez-vous.')
    if(/invalid login credentials/i.test(message))return t('الإيميل أو كلمة السر غالطين.','Email ou mot de passe incorrect.')
    if(/email not confirmed/i.test(message))return t('Confirm Email مازال مفعّل في إعدادات Supabase.','La confirmation email est toujours activée dans Supabase.')
    return message||t('صار خطأ، عاود جرّب.','Une erreur est survenue.')
  }
  async function emailSubmit(event){
    event.preventDefault();clear()
    if(!isSupabaseConfigured){setError(t('قاعدة البيانات موش مربوطة.','Base de données indisponible.'));return}
    setBusy(true)
    try{
      const address=normalizeEmail(email)
      if(mode==='reset'){
        // Supabase sends a recovery link to the account email and emits PASSWORD_RECOVERY on return.
        const {error:requestError}=await supabase.auth.resetPasswordForEmail(address,{redirectTo:redirect()})
        if(requestError)throw requestError
        setMessage(t('إذا الإيميل مسجّل، توصلّك رسالة استرجاع كلمة السر. افتح الرابط، وبعد اكتب كلمة سر جديدة. ثبّت Spam زادة.',
          'Si cet email est enregistré, vous recevrez un lien pour créer un nouveau mot de passe. Vérifiez aussi vos spams.'))
      }else if(mode==='signup'){
        const {data,error:signupError}=await supabase.auth.signUp({
          email:address,password,options:{data:{display_name:name.trim()},emailRedirectTo:redirect()}
        })
        if(signupError)throw signupError
        if(data.session)onClose()
        else setError(t('Supabase مازال يستوجب تأكيد الإيميل. يلزم تعطّل Confirm Email من لوحة التحكم.',
          'Supabase exige encore la confirmation email. Désactivez « Confirm Email » dans le tableau de bord.'))
      }else{
        const {data,error:signinError}=await supabase.auth.signInWithPassword({email:address,password})
        if(signinError)throw signinError
        if(data.session)onClose()
        else setError(t('الدخول ما كملش.','Connexion non terminée.'))
      }
    }catch(cause){setError(friendlyError(cause))}finally{setBusy(false)}
  }
  async function sendSms(event){
    event.preventDefault();clear();setBusy(true)
    try{
      const target=normalizePhone(phone)
      const {error:sendError}=await supabase.auth.signInWithOtp({phone:target,options:{shouldCreateUser:true,data:{display_name:name.trim()||'Joueur'}}})
      if(sendError)throw sendError
      setSentTo(target)
      setMessage(t('بعثنالك SMS فيه كود.','Code de connexion envoyé par SMS.'))
    }catch(cause){setError(friendlyError(cause)+' — '+t('SMS Provider يلزمو يكون مفعّل.','Le fournisseur SMS doit être activé.'))}
    finally{setBusy(false)}
  }
  async function verifySms(event){
    event.preventDefault();clear();setBusy(true)
    try{
      const {data,error:verifyError}=await supabase.auth.verifyOtp({phone:sentTo,token:otp.trim(),type:'sms'})
      if(verifyError)throw verifyError
      if(!data.session)throw Error(t('الكود ما تأكّدش.','Code non vérifié.'))
      onClose()
    }catch(cause){setError(friendlyError(cause))}finally{setBusy(false)}
  }
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="create-modal auth-modal" dir={lang==='fr'?'ltr':'rtl'}>
      <div className="modal-head"><div><span className="eyebrow">TAKWIRA24 • ACCOUNT</span><h2>{t('حسابك الرياضي ⚽','Votre compte sportif ⚽')}</h2>
        <p>{t('دخول سريع بحسابك أو بالتليفون.','Connexion simple par email ou téléphone.')}</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20}/></button></div>
      <div className="t24-auth-methods">
        <button type="button" className={method==='email'?'chosen':''} onClick={()=>changeMethod('email')}><Mail size={17}/>{t('بالإيميل','Par email')}</button>
        <button type="button" className={method==='phone'?'chosen':''} onClick={()=>changeMethod('phone')}><Phone size={17}/>{t('بالتليفون','Par téléphone')}</button>
      </div>
      {method==='email'?<form onSubmit={emailSubmit}>
        {mode==='signup'&&<label className="field-label">{t('اسم اللاعب','Nom du joueur')}<span className="auth-input-icon">
          <UserRound size={17}/><input required minLength="2" value={name} onChange={e=>setName(e.target.value)} placeholder={t('اسمك الكامل','Nom et prénom')}/></span></label>}
        <label className="field-label">{t('البريد الإلكتروني','Adresse email')}<span className="auth-input-icon">
          <Mail size={17}/><input type="email" required autoComplete="email" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} placeholder="exemple@email.com"/></span></label>
        {mode!=='reset'&&<label className="field-label">{t('كلمة السر','Mot de passe')}<span className="auth-input-icon">
          <LockKeyhole size={17}/><input type="password" required minLength="6" dir="ltr" autoComplete={mode==='signup'?'new-password':'current-password'}
            value={password} onChange={e=>setPassword(e.target.value)} placeholder={t('6 أحرف على الأقل','6 caractères minimum')}/></span></label>}
        {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="auth-message" role="status">{message}</p>}
        <button type="submit" className="primary-button submit-match" disabled={busy}>{busy?t('لحظة...','Patientez...'):
          mode==='signup'?t('إنشاء حساب','Créer mon compte'):mode==='reset'?t('ابعث رابط استرجاع كلمة السر','Envoyer le lien de réinitialisation'):t('تسجيل الدخول','Connexion')}</button>
        {mode==='reset'&&<p className="t24-auth-tip"><ShieldCheck size={15}/>{t('لازم عندك وصول للإيميل المسجّل باش تبدّل كلمة السر.','Le lien de récupération est envoyé uniquement à votre adresse email enregistrée.')}</p>}
        <div className="auth-switch">{mode==='signin'?<>
          <button type="button" onClick={()=>changeMode('signup')}>{t('ما عنديش حساب — نعمل جديد','Pas de compte ? Inscription')}</button>
          <button type="button" onClick={()=>changeMode('reset')}>{t('نسيت كلمة السر؟','Mot de passe oublié ?')}</button>
        </>:<button type="button" onClick={()=>changeMode('signin')}>{t('عندي حساب — تسجيل الدخول','J’ai déjà un compte — connexion')}</button>}</div>
      </form>:<form onSubmit={sentTo?verifySms:sendSms}>
        {!sentTo&&<label className="field-label">{t('اسم اللاعب (كانك جديد)','Nom (nouveau joueur)')}<span className="auth-input-icon">
          <UserRound size={17}/><input value={name} onChange={e=>setName(e.target.value)}/></span></label>}
        <label className="field-label">{t('نمرة التليفون','Numéro de téléphone')}<span className="auth-input-icon">
          <Phone size={17}/><input type="tel" required dir="ltr" autoComplete="tel" inputMode="tel"
            disabled={Boolean(sentTo)} value={sentTo||phone} onChange={e=>setPhone(e.target.value)} placeholder="+216 22 123 456"/></span></label>
        {sentTo&&<label className="field-label">{t('كود SMS','Code SMS')}<span className="auth-input-icon">
          <ShieldCheck size={17}/><input required inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={otp}
            onChange={e=>setOtp(e.target.value)} minLength="4" maxLength="8" placeholder="123456"/></span></label>}
        {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="auth-message" role="status">{message}</p>}
        <button type="submit" disabled={busy} className="primary-button submit-match">{busy?t('لحظة...','Patientez...'):sentTo?t('تأكيد الكود','Vérifier le code'):t('ابعث SMS','Envoyer le code SMS')}</button>
        {sentTo&&<div className="auth-switch"><button type="button" onClick={()=>{setSentTo('');setOtp('');clear()}}>{t('بدّل النمرة أو ابعث كود جديد','Modifier le numéro ou renvoyer le code')}</button></div>}
        <p className="t24-auth-tip"><ShieldCheck size={15}/>{t('الدخول بالتليفون يستوجب SMS Provider مفعّل في Supabase.','La connexion par téléphone nécessite un fournisseur SMS actif dans Supabase.')}</p>
      </form>}
    </div>
  </div>
}
