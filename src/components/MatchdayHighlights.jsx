import { ArrowUpRight, CalendarDays, ChevronLeft, CircleDot, Compass, MapPin, Plus, ShieldCheck, Sparkles, Trophy, Users, Zap } from 'lucide-react'
import './MatchdayHighlights.css'

/**
 * A real-data home dashboard: the spotlight reads existing matches and slots,
 * rather than showing a fake "LIVE" event or invented players.
 */
export default function MatchdayHighlights({ game, lineup = [], lang = 'ar', onOpenMatch, onCreate, onPlayers, onMyMatches }) {
  const t = (ar, fr) => lang === 'fr' ? fr : ar
  const confirmed = game ? lineup.filter(entry => entry.match_id === game.id && entry.status === 'confirmed').length : 0
  const capacity = Number(game?.total_players) || 0
  const perTeam = Number(game?.outfield_per_team || 6) + 1
  const playersOn = team => game
    ? new Set(lineup.filter(entry => entry.match_id === game.id && entry.team === team &&
      entry.status === 'confirmed' && Number(entry.slot) < perTeam).map(entry => Number(entry.slot))).size
    : 0
  const date = game?.starts_at ? new Date(game.starts_at) : null
  const dateText = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(lang === 'fr' ? 'fr-TN' : 'ar-TN', { weekday: 'short', day: 'numeric', month: 'short' })
    : t('الموعد يتحدّد', 'Date à définir')
  const timeText = date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  return <section className="t24-matchday-dashboard" dir={lang === 'fr' ? 'ltr' : 'rtl'} aria-label={t('مركز الماتشات', 'Tableau de bord des matchs')}>
    <div className="t24-matchday-title">
      <div>
        <span className="t24-matchday-eyebrow"><Sparkles size={15} /> MATCHDAY HUB · TAKWIRA24</span>
        <h2>{t('كل شي للماتش الجاي،','Tout pour ton prochain match,')} <em>{t('في بلاصة واحدة.','au même endroit.')}</em></h2>
      </div>
      <span className="t24-hub-season"><CircleDot size={14}/>{t('موسم', 'Saison')} 2026/2027</span>
    </div>

    <div className="t24-hub-grid">
      <div className={'t24-hub-feature '+(game ? 'has-game' : 'no-game')}>
        <span className="t24-hub-beam" aria-hidden="true" />
        <div className="t24-hub-feature-top">
          <span className="t24-hub-pill"><Zap size={14}/>{game ? t('ماتش موجود', 'À l’affiche') : t('البلاصة جاهزة ليك', 'Le terrain t’attend')}</span>
          <span className="t24-hub-kicker">TAKWIRA24 · FOOTBALL COMMUNITY</span>
        </div>
        {game ? <>
          <div className="t24-hub-game-hero">
            <div className="t24-hub-game-text">
              <small>{t('الماتش القادم', 'PROCHAIN MATCH')}</small>
              <h3>{game.title}</h3>
              <p><MapPin size={16}/>{[game.venue, game.area].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="t24-hub-game-date"><CalendarDays size={21}/><strong>{dateText}</strong><span dir="ltr">{timeText}</span></div>
          </div>
          <div className="t24-hub-scoreboard">
            <div className="t24-hub-team"><span>TEAM A</span><strong>{playersOn('A')}<i>/{perTeam}</i></strong></div>
            <div className="t24-hub-versus">VS</div>
            <div className="t24-hub-team"><span>TEAM B</span><strong>{playersOn('B')}<i>/{perTeam}</i></strong></div>
          </div>
          <div className="t24-hub-progress">
            <div><span>{t('لاعبين مؤكّدين', 'Joueurs confirmés')}</span><strong>{confirmed}/{capacity}</strong></div>
            <div className="t24-hub-progress-track"><i style={{ width: (capacity ? Math.min(100, confirmed / capacity * 100) : 0) + '%' }} /></div>
          </div>
          <button className="t24-hub-main-button" type="button" onClick={() => onOpenMatch(game.id)}>
            {t('شوف التيران والتشكيلة', 'Voir le terrain et la composition')} <ArrowUpRight size={19}/>
          </button>
        </> : <>
          <div className="t24-hub-zero">
            <div className="t24-hub-zero-icon">⚽</div>
            <h3>{t('إنت تبدأ الحكاية.','À toi de lancer le match.')}</h3>
            <p>{t('كوّن فريق، اختار تيران، وابعث الدعوات للصحاب.','Crée ton équipe, choisis le terrain et invite tes amis.')}</p>
          </div>
          <button className="t24-hub-main-button" type="button" onClick={onCreate}>
            {t('أنشئ أوّل ماتش', 'Créer mon premier match')} <Plus size={19}/>
          </button>
        </>}
        <span className="t24-hub-watermark" aria-hidden="true">24</span>
      </div>

      <div className="t24-hub-actions">
        <button type="button" className="t24-action-card t24-action-create" onClick={onCreate}>
          <span className="t24-action-icon"><Plus size={24}/></span>
          <span className="t24-action-copy"><small>01 · KICK-OFF</small><strong>{t('كوّن ماتش جديد','Créer un match')}</strong><span>{t('الوقت، التيران والتشكيلة','Terrain, date et composition')}</span></span>
          <ArrowUpRight className="t24-action-arrow" size={20}/>
        </button>
        <button type="button" className="t24-action-card t24-action-players" onClick={onPlayers}>
          <span className="t24-action-icon"><Users size={23}/></span>
          <span className="t24-action-copy"><small>02 · COMMUNITY</small><strong>{t('اكتشف اللاعبين','Découvrir les joueurs')}</strong><span>{t('قلّب بالاسم أو Player ID','Chercher par nom ou Player ID')}</span></span>
          <ArrowUpRight className="t24-action-arrow" size={20}/>
        </button>
        <button type="button" className="t24-action-card t24-action-matches" onClick={onMyMatches}>
          <span className="t24-action-icon"><Trophy size={23}/></span>
          <span className="t24-action-copy"><small>03 · MY GAMES</small><strong>{t('ماتشاتي ودعواتي','Mes matchs et invitations')}</strong><span>{t('نتائج، طلبات وتقييمات','Résultats, défis et notes')}</span></span>
          <ArrowUpRight className="t24-action-arrow" size={20}/>
        </button>
      </div>
    </div>
    <div className="t24-hub-bottomline">
      <span><ShieldCheck size={16}/>{t('حسابات لاعبين حقيقية', 'Profils de vrais joueurs')}</span>
      <span><Compass size={16}/>{t('تشكيلات وتيران واقعي', 'Formations & terrain réalistes')}</span>
      <span><Trophy size={16}/>{t('نتائج وتقييمات الموسم', 'Scores & notes de la saison')}</span>
    </div>
  </section>
}