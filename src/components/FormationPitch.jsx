import { useMemo } from 'react'
import { Users, UserRoundPlus, Shirt } from 'lucide-react'
import './FormationPitch.css'

// Seven, eight or nine starters INCLUDING the goalkeeper.
// The keeper is always slot 0; remaining slots are outfield players.
// Each team has its own mirrored half of the full stadium.
function teamFormation(outfield) {
  const patterns = {
    4: [[50,85],[25,66],[75,66],[27,35],[73,35]],
    6: [[50,88],[20,67],[50,67],[80,67],[32,40],[68,40],[50,16]],
    7: [[50,88],[20,67],[50,67],[80,67],[18,40],[50,40],[82,40],[50,16]],
    8: [[50,88],[20,67],[50,67],[80,67],[18,43],[50,43],[82,43],[34,16],[66,16]]
  }
  return patterns[outfield] || patterns[6]
}

export default function FormationPitch({
  outfield = 6, bench = 0, sport = 'football', entries = [], players = [],
  onSelectSlot, canEdit = false, busy = false, lang='ar'
}) {
  const t=(ar,fr)=>lang==='fr'?fr:ar
  const startCount = Number(outfield) + 1
  const benchCount = Number(bench)
  const coords = useMemo(() => teamFormation(Number(outfield)), [outfield])
  const isBasket=sport==='basketball'
  const lookup = id => players.find(p=>p.id===id)
  const lookupEntry = (team,slot) => entries.find(e=>e.team===team && e.slot===slot)
  return <div className="tf-shell" dir="rtl">
    <div className="tf-headline"><div><span className="tf-overline">MATCH DAY • FORMATION</span><h3>{t('تشكيلة الفريقين','Compositions des équipes')}</h3></div><div className="tf-head-count"><Users size={15}/><b>{startCount} × 2</b><small>{t('أساسيين لكل فريق','Titulaires par équipe')}</small></div></div>
    <div className={'tf-stadium tf-'+sport}>
      <div className="tf-lawn">
        <div className="tf-mark tf-outline"/>
        <div className="tf-mark tf-midline"/>
        <div className="tf-mark tf-midcircle"/>
        <div className="tf-mark tf-area tf-area-top"/>
        <div className="tf-mark tf-area tf-area-bottom"/>
        <div className="tf-mark tf-goal tf-goal-top"/>
        <div className="tf-mark tf-goal tf-goal-bottom"/>
        {['A','B'].map(team=><div key={team} className={'tf-half tf-half-'+team}>
          <span className={'tf-team-label tf-team-label-'+team}>TEAM {team}</span>
          {coords.map(([x,y],slot)=>{
            const row=lookupEntry(team,slot)
            const person=lookup(row?.player_id)
            const flippedY=team==='A' ? 100-y : y
            const state=row?.status || 'empty'
            const occupied=Boolean(row)
            return <button key={team+'-'+slot} type="button"
              className={'tf-slot '+(occupied?'tf-slot-occupied ':'')+(team==='B'?'tf-slot-blue':'')+(slot===0&&!isBasket?' tf-keeper':'')+' tf-state-'+state}
              style={{left:x+'%',top:flippedY+'%'}}
              title={occupied?(person?.display_name||t('لاعب','Joueur'))+' — '+(state==='invited'?t('في انتظار الموافقة','En attente'):state==='declined'?t('رفض الدعوة','Refusé'):t('مؤكّد','Confirmé')):t('مكان فارغ — ','Place libre — ')+(slot===0&&!isBasket?'Gardien':'Joueur')}
              disabled={busy || !canEdit}
              onClick={()=>onSelectSlot?.(team,slot,row)}
            >
              <span className="tf-player-circle">{person?.avatar_url?
                <img src={person.avatar_url} alt={person.display_name||'لاعب'} loading="lazy"/>:
                occupied?<Shirt size={18} strokeWidth={2}/>:<span className="tf-empty-plus">+</span>}</span>
              <span className="tf-player-name">{occupied?(person?.display_name||t('لاعب','Joueur')):slot===0&&!isBasket?'Gardien':('P'+(isBasket?slot+1:slot))}</span>{state==='invited'&&<span className="tf-state-label">⏳ انتظار</span>}{state==='declined'&&<span className="tf-state-label">✕ رفض</span>}
            </button>
          })}
        </div>)}
      </div>
      <span className="tf-stadium-edge">TAKWIRA24 • PLAY TOGETHER</span>
    </div>
    <div className="tf-benches">
      {['A','B'].map(team=><div key={team} className={'tf-bench tf-bench-'+team}>
        <div className="tf-bench-title"><Shirt size={16}/> <strong>Banc {team}</strong><small>{benchCount} {t('بدلاء','Remplaçants')}</small></div>
        {benchCount===0?<span className="tf-no-bench">{t('ما فماش بدلاء','Pas de remplaçants')}</span>:<div className="tf-bench-roster">{Array.from({length:benchCount},(_,idx)=>{
          const slot=startCount+idx, row=lookupEntry(team,slot),person=lookup(row?.player_id)
          return <button type="button" disabled={!canEdit||busy} onClick={()=>onSelectSlot?.(team,slot,row)}
            className={'tf-bench-player tf-state-'+(row?.status||'empty')} key={slot} title={person?.display_name || 'بديل فارغ'}>
            <span className="tf-bench-avatar">{person?.avatar_url?<img src={person.avatar_url} alt={person.display_name||'بديل'}/>:row?<Shirt size={16}/>:<UserRoundPlus size={15}/>}</span>
            <small>{person?.display_name||(t('بديل ','Remplaçant ')+(idx+1))}</small>{row?.status==='invited'&&<small>{t('⏳ انتظار','⏳ Attente')}</small>}{row?.status==='declined'&&<small>{t('❌ رفض','❌ Refusé')}</small>}
          </button>
        })}</div>}
      </div>)}
    </div>
    <div className="tf-summary"><span>{isBasket?'🏀 '+(Number(outfield)+1)+' '+t('لاعبين لكل فريق','joueurs par équipe'):'🧤 '+t('حارس + ','Gardien + ')+outfield+' '+t('لاعبين لكل فريق','joueurs par équipe')}</span><span>🪑 {benchCount} {t('بدلاء لكل فريق','remplaçants par équipe')}</span><span>👥 {2*(startCount+benchCount)} {t('بلاصة في الماتش','places au total')}</span></div>
  </div>
}
