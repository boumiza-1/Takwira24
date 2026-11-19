import { useState } from 'react'
import { ArrowUpRight, CalendarDays, Clock3, Compass, MapPin, Navigation, Plus, Search, Sparkles, Trophy, Users, Zap } from 'lucide-react'
import './StadiumMobileHome.css'

export const CITIES=[
 ['all','Toute la Tunisie','تونس الكل',''],['Tunis','Tunis','تونس','tunis;tounes;تونس'],
 ['Sousse','Sousse','سوسة','sousse;soussa;سوسة'],['Ariana','Ariana','أريانة','ariana;أريانة'],
 ['Ben Arous','Ben Arous','بن عروس','ben arous;benarous;بن عروس'],
 ['Kasserine','Kasserine','القصرين','kasserine;kassrine;القصرين'],
 ['Sfax','Sfax','صفاقس','sfax;صفاقس'],['Nabeul','Nabeul','نابل','nabeul;نابل'],
 ['Monastir','Monastir','المنستير','monastir;المنستير'],['Mahdia','Mahdia','المهدية','mahdia;المهدية'],
 ['Manouba','Manouba','منوبة','manouba;منوبة'],['Bizerte','Bizerte','بنزرت','bizerte;بنزرت'],
 ['Kairouan','Kairouan','القيروان','kairouan;القيروان'],['Gabes','Gabès','قابس','gabes;gabès;قابس'],
 ['Gafsa','Gafsa','قفصة','gafsa;قفصة'],['Medenine','Médenine','مدنين','medenine;médenine;مدنين'],
 ['Beja','Béja','باجة','beja;béja;باجة'],['Jendouba','Jendouba','جندوبة','jendouba;جندوبة'],
 ['Kef','Le Kef','الكاف','kef;الكاف'],['Siliana','Siliana','سليانة','siliana;سليانة'],
 ['Zaghouan','Zaghouan','زغوان','zaghouan;زغوان'],['Sidi Bouzid','Sidi Bouzid','سيدي بوزيد','sidi bouzid;سيدي بوزيد'],
 ['Tozeur','Tozeur','توزر','tozeur;توزر'],['Kebili','Kébili','قبلي','kebili;قبلي'],['Tataouine','Tataouine','تطاوين','tataouine;تطاوين']
]
const CENTERS={Tunis:[36.8065,10.1815],Sousse:[35.8256,10.6369],Ariana:[36.8625,10.1956],'Ben Arous':[36.753,10.224],Kasserine:[35.1676,8.8365],Sfax:[34.7406,10.7603],Nabeul:[36.4561,10.735],Monastir:[35.7772,10.8262],Mahdia:[35.5034,11.0622],Manouba:[36.808,10.093],Bizerte:[37.2744,9.8739],Kairouan:[35.6781,10.0963],Gabes:[33.8815,10.0982],Gafsa:[34.425,8.7842],Medenine:[33.3549,10.5055],Beja:[36.7256,9.1817],Jendouba:[36.5011,8.7802],Kef:[36.1825,8.7147],Siliana:[36.0849,9.3708],Zaghouan:[36.4029,10.1429],'Sidi Bouzid':[35.038,9.4858],Tozeur:[33.92,8.133],Kebili:[33.7044,8.969],Tataouine:[32.9297,10.4518]}
const SPORTS={football:['⚽','Football','كرة القدم'],handball:['🤾','Handball','كرة اليد'],basketball:['🏀','Basketball','كرة السلة'],volleyball:['🏐','Volley-ball','كرة الطائرة']}
const langSport=(id,lang)=>SPORTS[id]?.[lang==='fr'?1:2]||id
const cityMatch=(record,id)=>{
 if(id==='all')return true
 const city=CITIES.find(c=>c[0]===id)
 const haystack=[record.area,record.venue,record.venue_address].filter(Boolean).join(' ').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 return (city?.[3]||'').split(';').some(key=>key && haystack.includes(key.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')))
}
const todayKey=date=>{
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Tunis',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date(date))
 const pick=k=>p.find(x=>x.type===k)?.value
 return pick('year')+'-'+pick('month')+'-'+pick('day')
}
const fmtDate=(d,lang)=>new Date(d).toLocaleDateString(lang==='fr'?'fr-TN':'ar-TN',{timeZone:'Africa/Tunis',day:'numeric',month:'short'})
const fmtTime=d=>new Date(d).toLocaleTimeString('fr-TN',{timeZone:'Africa/Tunis',hour:'2-digit',minute:'2-digit'})
const distance=(a,b)=>{const r=n=>n*Math.PI/180,dy=r(b[0]-a[0]),dx=r(b[1]-a[1]);return 6371*2*Math.asin(Math.sqrt(Math.sin(dy/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dx/2)**2))}
const STATUS={open:['مفتوح','Ouvert'],full:['كامل','Complet'],completed:['انتهى','Terminé'],postponed:['تأجّل','Reporté'],cancelled:['تلغى','Annulé']}
export default function StadiumMobileHome({matches=[],players=[],lineup=[],user,lang='ar',city='all',setCity,onCreate,onOpenMatch,onGoPlayers,onGoMatches,onGoProfile}){
 const t=(ar,fr)=>lang==='fr'?fr:ar
 const [tab,setTab]=useState('today'),[sport,setSport]=useState('all'),[query,setQuery]=useState(''),[geotext,setGeotext]=useState('')
 const now=Date.now(),today=todayKey(now)
 const todayMatches=matches.filter(m=>m.starts_at&&todayKey(m.starts_at)===today&&m.status!=='cancelled')
 const future=matches.filter(m=>m.starts_at&&new Date(m.starts_at).getTime()>now&&['open','full'].includes(m.status)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))
 const finished=matches.filter(m=>m.status==='completed').sort((a,b)=>new Date(b.completed_at||b.starts_at)-new Date(a.completed_at||a.starts_at))
 const areaMatches=matches.filter(m=>cityMatch(m,city)&&(sport==='all'||m.sport===sport)&&(m.title+' '+(m.area||'')+' '+(m.venue||'')+' '+(m.venue_address||'')).toLowerCase().includes(query.toLowerCase()))
 const feeds={
   today:areaMatches.filter(m=>m.starts_at&&todayKey(m.starts_at)===today).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)),
   upcoming:areaMatches.filter(m=>future.some(n=>n.id===m.id)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)),
   nearby:areaMatches.filter(m=>future.some(n=>n.id===m.id)).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)),
   results:areaMatches.filter(m=>m.status==='completed').sort((a,b)=>new Date(b.completed_at||b.starts_at)-new Date(a.completed_at||a.starts_at))
 }
 const game=future.find(m=>cityMatch(m,city))||future[0]||todayMatches[0]||null
 const confirmed=game?lineup.filter(e=>e.match_id===game.id&&e.status==='confirmed'):[],total=Number(game?.total_players)||0
 const own=new Set(lineup.filter(e=>e.player_id===user?.id).map(e=>e.match_id))
 const mine=matches.filter(m=>m.host_id===user?.id||m.opponent_id===user?.id||own.has(m.id))
 function detectCity(){
   if(!navigator.geolocation){setGeotext(t('تحديد الموقع غير متاح','Géolocalisation indisponible'));return}
   setGeotext(t('نحدّد المدينة بإذنك...','Recherche de ta ville avec ton accord...'))
   navigator.geolocation.getCurrentPosition(({coords})=>{
     const ref=[coords.latitude,coords.longitude]
     const closest=Object.entries(CENTERS).sort((a,b)=>distance(ref,a[1])-distance(ref,b[1]))[0]
     if(closest){setCity(closest[0]);setTab('nearby');setGeotext(t('قرب تقريبي حسب مركز المدينة، موش المسافة الدقيقة للملعب.','Proximité approximative par centre-ville, pas distance réelle au terrain.'))}
   },()=>setGeotext(t('اختار مدينتك يدويًا.','Choisis ta ville manuellement.')),{enableHighAccuracy:false,timeout:7000})
 }
 return <div className="s24-dashboard" dir={lang==='fr'?'ltr':'rtl'}>
   <section className="s24-hero"><div className="s24-hero-content">
     <span className="s24-eyebrow"><Zap size={15}/> TAKWIRA24 · STADIUM EDITION</span>
     <h1>{t('الماتش الجاي','Le prochain match')} <em>{t('يبدأ من هنا.','commence ici.')}</em></h1>
     <p>{t('Football • Handball • Basketball. لمّ صحابك، كوّن فريقك وإلعب.','Football • Handball • Basketball. Rejoins une équipe, crée un match et joue.')}</p>
     <div className="s24-hero-actions"><button type="button" onClick={onCreate}><Plus size={19}/>{t('أنشئ ماتش','Créer un match')}</button><button type="button" onClick={onGoPlayers}><Users size={18}/>{t('اكتشف اللاعبين','Découvrir les joueurs')}</button></div>
   </div><div className="s24-hero-mark"><img src={import.meta.env.BASE_URL+'takwira24-logo.webp'} alt=""/></div><span className="s24-hero-line">THE GAME STARTS HERE <b>24</b></span></section>
   <section className="s24-stats">{[[todayMatches.length,t('اليوم','Aujourd’hui'),CalendarDays],[future.length,t('القادمة','À venir'),Zap],[finished.length,t('النتائج','Résultats'),Trophy],[players.length,t('اللاعبين','Joueurs'),Users]].map(([count,label,Icon],i)=><div key={i}><Icon size={20}/><strong>{count}</strong><small>{label}</small></div>)}</section>
   <div className="s24-panels"><section className="s24-match-feature"><div className="s24-card-head"><span><Zap size={17}/>{t('الماتش القادم','PROCHAIN MATCH')}</span><small>2026 / 2027</small></div>
     {game?<><h3>{game.title}</h3><p><MapPin size={15}/>{[game.venue,game.area].filter(Boolean).join(' · ')}</p><div className="s24-scoreline"><div>TEAM A <strong>{confirmed.filter(e=>e.team==='A').length}</strong></div><b>VS</b><div>TEAM B <strong>{confirmed.filter(e=>e.team==='B').length}</strong></div></div><div className="s24-progress"><i style={{width:(total?Math.min(100,100*confirmed.length/total):0)+'%'}}/></div><div className="s24-match-meta"><CalendarDays size={14}/>{game.starts_at?fmtDate(game.starts_at,lang):'—'}<Clock3 size={14}/>{game.starts_at?fmtTime(game.starts_at):'—'}</div><button type="button" onClick={()=>onOpenMatch(game.id)}>{t('شوف الماتش والتشكيلة','Voir match & composition')}<ArrowUpRight size={17}/></button></>:<div className="s24-no-feature"><strong>{t('ما فماش ماتش قادم','Aucun match à venir')}</strong><p>{t('كون أول واحد ينظّم ماتش.','Sois le premier à organiser un match.')}</p><button onClick={onCreate}>{t('أنشئ ماتش','Créer un match')}</button></div>}</section>
     <section className="s24-shortcuts"><div className="s24-card-head"><span><Sparkles size={17}/> MATCHDAY HUB</span></div><div className="s24-shortcut-grid">{[[Plus,t('أنشئ ماتش','Créer un match'),t('الملعب والوقت','Date & terrain'),onCreate],[Users,t('اللاعبين','Joueurs'),t('صوّر وProfiles','Photos & profils'),onGoPlayers],[Trophy,t('ماتشاتي','Mes matchs'),mine.length+' matches',onGoMatches],[Compass,t('بروفيل','Mon profil'),t('نجوم وإحصائيات','Notes et statistiques'),onGoProfile]].map(([Icon,title,subtitle,action],i)=><button type="button" key={i} onClick={action}><span><Icon size={23}/></span><strong>{title}</strong><small>{subtitle}</small></button>)}</div></section></div>
   <section className="s24-sport-section"><div className="s24-heading"><small>YOUR SPORT · YOUR GAME</small><h2>{t('اختار رياضتك','Choisis ton sport')}</h2></div><div className="s24-sport-grid">{['football','handball','basketball'].map(id=><button type="button" className={'s24-sport s24-'+id+(sport===id?' selected':'')} key={id} onClick={()=>{setSport(id);setTab('upcoming')}}><span className="s24-sport-emoji">{SPORTS[id][0]}</span><strong>{langSport(id,lang)}</strong><small>{id==='football'?'MINI FOOT':id==='handball'?'6 + GARDIEN':'5 VS 5'}</small><ArrowUpRight size={17}/></button>)}</div><div className="s24-credits"><a href="https://commons.wikimedia.org/wiki/File:Handball_match.jpg" target="_blank" rel="noreferrer">Handball: liga-dnepr · CC BY-SA 4.0</a><a href="https://commons.wikimedia.org/wiki/File:Match_de_basket.jpg" target="_blank" rel="noreferrer">Basketball: Wikimedia Commons · CC0</a></div></section>
   <section className="s24-find"><div className="s24-heading"><small>DISCOVER · TUNISIA</small><h2>{t('الماتشات القريبة ليك','Les matchs près de chez toi')}</h2></div>
     <div className="s24-filters"><label><MapPin size={18}/><select value={city} onChange={e=>setCity(e.target.value)} aria-label={t('المدينة','Ville')}>{CITIES.map(c=><option key={c[0]} value={c[0]}>{c[lang==='fr'?1:2]}</option>)}</select></label><button type="button" className="s24-geolocation" onClick={detectCity}><Navigation size={16}/>{t('مدينتي','Ma ville')}</button><label className="s24-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('الملعب أو إسم الماتش...','Terrain ou nom du match...')}/></label></div>
     {geotext&&<p className="s24-geo-note">{geotext}</p>}
     <div className="s24-tabs" role="tablist">{[['today',t('اليوم','Aujourd’hui')],['upcoming',t('القادمة','À venir')],['nearby',t('في مدينتي','Près de moi')],['results',t('النتائج','Résultats')]].map(([id,label])=><button role="tab" aria-selected={tab===id} type="button" key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
     <div className="s24-sport-filters">{[['all',t('الكل','Tous')],...Object.entries(SPORTS).map(([id,z])=>[id,z[0]+' '+z[1]])].map(([id,label])=><button type="button" key={id} className={sport===id?'active':''} onClick={()=>setSport(id)}>{label}</button>)}</div>
     <div className="s24-events">{feeds[tab].length?feeds[tab].slice(0,8).map(m=><article className={'s24-event s24-event-'+m.sport} key={m.id}><div className="s24-event-img"><span>{SPORTS[m.sport]?.[0]} {langSport(m.sport,lang)}</span><span>{STATUS[m.status]?.[lang==='fr'?1:0]||m.status}</span></div><div className="s24-event-info"><strong>{m.title}</strong><p><MapPin size={14}/>{[m.venue,m.area].filter(Boolean).join(' · ')}</p><div>{m.status==='completed'?<b>{m.score_a??'—'} : {m.score_b??'—'}</b>:<span><CalendarDays size={13}/>{m.starts_at?fmtDate(m.starts_at,lang)+' · '+fmtTime(m.starts_at):'—'}</span>}<button type="button" onClick={()=>onOpenMatch(m.id)}>{t('شوف','Voir')}<ArrowUpRight size={14}/></button></div></div></article>):<div className="s24-empty"><Compass size={28}/><strong>{t('ما فماش ماتشات بالفلاتر هاذم','Aucun match pour ces filtres')}</strong><p>{t('بدّل المدينة أو الرياضة، أو أنشئ ماتش في جهتك.','Change de ville ou de sport, ou crée un match près de toi.')}</p><button type="button" onClick={()=>{setCity('all');setSport('all')}}>{t('تونس الكل','Toute la Tunisie')}</button></div>}</div>
   </section>
 </div>
}
