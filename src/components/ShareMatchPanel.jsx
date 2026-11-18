import { useState } from 'react'
import { CheckCircle2, ClipboardCopy, Share2, Users, Trophy, ArrowLeft, ShieldCheck } from 'lucide-react'
import './ShareMatchPanel.css'

const starterCount = match => Number(match?.outfield_per_team || 6) + 1

// A full team means EVERY starting position (including keeper) is confirmed.
// Pending invitations, declines and substitutes do not count as confirmed starters.
export function getMatchStage(match, lineup = []) {
  const required = starterCount(match)
  const confirmedByTeam = team => new Set(lineup.filter(row =>
    row.match_id === match.id && row.team === team &&
    row.status === 'confirmed' && Number(row.slot) < required &&
    Number(row.slot) >= 0
  ).map(row => Number(row.slot))).size
  const a = confirmedByTeam('A')
  const b = confirmedByTeam('B')
  const aReady = a === required
  const bReady = Boolean(match.opponent_id) && b === required
  const stage = aReady && bReady ? 'match_ready' : aReady ? 'find_opponent' : 'complete_a'
  return {required,a,b,aReady,bReady,stage}
}
const shareUrl = matchId => {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin)
  base.searchParams.set('match', matchId)
  return base.href
}

export default function ShareMatchPanel({ match, lineup = [], canShare = true }) {
  const [feedback,setFeedback] = useState('')
  if (!match) return null
  const state = getMatchStage(match,lineup)
  const url = shareUrl(match.id)
  const text = state.stage === 'match_ready'
    ? '⚽ الماتش جاهز! زوز فرق تأكدوا في Takwira24: '+match.title+' — '+match.venue+'، '+match.area+'.'
    : state.aReady
    ? '⚔️ Team A جاهزة! نلوجوا على Team B باش تتحدّانا في Takwira24: '+match.title+' — '+match.venue+'، '+match.area+'.'
    : '⚽ ماتش جديد على Takwira24: '+match.title+' — '+match.venue+'، '+match.area+'. إفتح الرابط وشوف التشكيلة واطلب تلعب معانا.'

  async function share() {
    try {
      if(navigator.share) {
        await navigator.share({title:'Takwira24 • '+match.title,text,url})
        setFeedback('✅ رابط الماتش جاهز للمشاركة')
      } else {
        await copy()
      }
    } catch(error) {
      if(error?.name !== 'AbortError') setFeedback('تعذّرت المشاركة. استعمل Copier lien.')
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text+'\n'+url)
      setFeedback('✅ تنسخ رابط الماتش، تنجم تبعثو على WhatsApp أو Facebook.')
    } catch {
      setFeedback('ما نجّمش ننسخ آليًا. حدّد الرابط اللي لتحت وانسخو.')
    }
  }
  return <section className="t24-share-panel" dir="rtl">
    <div className="t24-share-heading">
      <div><span className="eyebrow">MATCH PROGRESS • TAKWIRA24</span><h3>تقدّم الماتش والمشاركة</h3>
      <p>نحسبوا كان اللاعبين اللي قبلوا الدعوات، موش اللي مازالوا Pending.</p></div>
      <span className={'t24-match-stage '+(state.stage==='match_ready'?'ready':state.aReady?'searching':'forming')}>
        {state.stage==='match_ready'?'🏆 الماتش جاهز':state.aReady?'⚔️ نلوجوا على منافس':'👥 نكمّلوا Team A'}
      </span>
    </div>
    <div className="t24-ready-teams">
      {['A','B'].map(team=>{
        const count=team==='A'?state.a:state.b
        const ready=team==='A'?state.aReady:state.bReady
        return <div key={team} className={'t24-ready-team '+(ready?'ready':'')}>
          <div className="t24-team-progress-title"><strong>TEAM {team}</strong>
            {ready?<CheckCircle2 size={17}/>:<Users size={17}/>}</div>
          <span><b>{count}/{state.required}</b> أساسيين موافقين</span>
          <div className="t24-share-progress"><i style={{width:(count/state.required*100)+'%'}}/></div>
          <small>{ready?'الفريق جاهز ✅':team==='B'&&!match.opponent_id?'يلزم أولًا قبول مسؤول Team B':'مازال ناقص '+(state.required-count)+' لاعبين'}</small>
        </div>
      })}
    </div>
    <div className="t24-share-next">
      {state.stage==='complete_a'?<>
        <Users size={20}/><div><strong>المرحلة الأولى: تأكيد Team A</strong>
          <p>لازم Gardien وبقية الأساسيين يقبلوا دعواتهم قبل ما نعتبروا Team A جاهزة.</p></div>
      </>:state.stage==='find_opponent'?<>
        <Share2 size={20}/><div><strong>المرحلة الثانية: شارك الماتش وتحدّى Team B</strong>
          <p>{match.opponent_id?'المنافس موجود، يستنّى يكمل تشكيلتو.':'ابعث الرابط لمسؤول Team B. يفتح الماتش، يطلب تحدّي، وإنت تقبل.'}</p></div>
      </>:<>
        <Trophy size={21}/><div><strong>المرحلة الثالثة: الفريقين جاهزين!</strong>
          <p>تنجم تشارك رابط الماتش النهائي مع اللاعبين والصحاب.</p></div>
      </>}
    </div>
    {canShare&&<>
      <div className="t24-share-buttons">
        <button type="button" onClick={share} className="t24-share-primary"><Share2 size={18}/> Partager le match</button>
        <button type="button" onClick={copy} className="t24-share-copy"><ClipboardCopy size={17}/> Copier lien</button>
      </div>
      <label className="t24-share-link-label">Lien du match
        <input type="text" dir="ltr" value={url} readOnly onFocus={event=>event.target.select()}/></label>
      <p className="t24-share-private"><ShieldCheck size={15}/> الرابط يفتح الماتش داخل Takwira24 بعد تسجيل الدخول. الإيميلات والمعلومات الخاصة ما تتشاركش.</p>
      {feedback&&<p role="status" className="t24-share-feedback">{feedback}</p>}
    </>}
  </section>
}
