(function(){
'use strict';

/* ================= costanti e utilità ================= */
var CFG=window.CAL_CONFIG||{};
var SCOPE_LIST=['https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events'];
var API='https://www.googleapis.com/calendar/v3';
var EV_FIELDS='nextPageToken,items(id,status,summary,location,description,start,end,colorId,recurringEventId,htmlLink,eventType)';
var MS=864e5;
var TZ='Europe/Rome';try{TZ=Intl.DateTimeFormat().resolvedOptions().timeZone||TZ;}catch(err){}

function dn(y,m,d){return Math.round(Date.UTC(y,m,d)/MS);}
function fd(n){var t=new Date(n*MS);return{y:t.getUTCFullYear(),m:t.getUTCMonth(),d:t.getUTCDate(),w:(t.getUTCDay()+6)%7};}
function monday(n){return n-fd(n).w;}
function todayNum(){var n=new Date();return dn(n.getFullYear(),n.getMonth(),n.getDate());}
var TODAY=todayNum();
var MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
var M3=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
var GIORNI=['lunedì','martedì','mercoledì','giovedì','venerdì','sabato','domenica'];
var G3=['lun','mar','mer','gio','ven','sab','dom'];
function p2(n){return(n<10?'0':'')+n;}
function hm(min){min=min%1440;return p2(Math.floor(min/60))+':'+p2(min%60);}
function iso(n){var k=fd(n);return k.y+'-'+p2(k.m+1)+'-'+p2(k.d);}
function unIso(s){var p=String(s).split('-');return p.length===3?dn(+p[0],+p[1]-1,+p[2]):NaN;}
function unHm(s){var p=String(s).split(':');return p.length>=2?(+p[0])*60+(+p[1]):NaN;}
function dayStartIso(n){var k=fd(n);return new Date(k.y,k.m,k.d).toISOString();}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function enc(s){return encodeURIComponent(s);}
function $(id){return document.getElementById(id);}
function lsGet(k,def){try{var v=localStorage.getItem(k);return v==null?def:JSON.parse(v);}catch(err){return def;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(err){}}
function plain(html){return String(html||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();}

/* ================= colori ================= */
/* Google restituisce i colori "classici" dei calendari; il sito ne mostra la versione moderna. Tabella di conversione. */
var CAL_MODERN={'#ac725e':'#795548','#d06b64':'#e67c73','#f83a22':'#d50000','#fa573c':'#f4511e','#ff7537':'#ef6c00','#ffad46':'#f09300',
  '#42d692':'#009688','#16a765':'#0b8043','#7bd148':'#7cb342','#b3dc6c':'#c0ca33','#fbe983':'#e4c441','#fad165':'#f6bf26',
  '#92e1c0':'#33b679','#9fe1e7':'#039be5','#9fc6e7':'#4285f4','#4986e7':'#3f51b5','#9a9cff':'#7986cb','#b99aff':'#b39ddb',
  '#c2c2c2':'#616161','#cabdbf':'#a79b8e','#cca6ac':'#ad1457','#f691b2':'#d81b60','#cd74e6':'#8e24aa','#a47ae2':'#9e69af'};
/* colori che si possono dare al singolo evento */
var EV_COLORS={1:'#7986cb',2:'#33b679',3:'#8e24aa',4:'#e67c73',5:'#f6bf26',6:'#f4511e',7:'#039be5',8:'#616161',9:'#3f51b5',10:'#0b8043',11:'#d50000'};
var DEF_COLOR='#039be5';
function hexRgb(h){var n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function lum(h){var c=hexRgb(h).map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
function ratio(a,b){var x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function mix(h,to,p){var a=hexRgb(h),b=hexRgb(to);return'#'+a.map(function(v,i){var x=Math.round(v+(b[i]-v)*p);return p2(0).slice(0,x<16?1:0)+x.toString(16);}).join('');}
var lookCache={};
/* per ogni colore: sfondo della barra, testo sulla barra, testo colorato leggibile sul fondo della casella */
function looks(c){
  var k=c+(LIGHT?'L':'D');if(lookCache[k])return lookCache[k];
  var bg=LIGHT?'#ffffff':'#202023',to=LIGHT?'#000000':'#ffffff',t=c,i=0;
  while(ratio(t,bg)<4.2&&i<10){i++;t=mix(c,to,i*.1);}
  return lookCache[k]={c:c,on:lum(c)>.42?'#1d1a08':'#ffffff',t:t};
}

/* ================= preferenze e stato ================= */
var FONTS=[
  {id:'fira',name:'Fira Sans',ui:'"Fira Sans"',tight:'"Fira Sans Condensed"'},
  {id:'roboto',name:'Roboto',ui:'Roboto',tight:'"Roboto Condensed"'},
  {id:'atkinson',name:'Atkinson Hyperlegible',ui:'"Atkinson Hyperlegible"',tight:'"Atkinson Hyperlegible"'},
  {id:'source',name:'Source Sans',ui:'"Source Sans 3"',tight:'"Source Sans 3"'},
  {id:'sistema',name:'Carattere del telefono',ui:'system-ui',tight:'system-ui'}
];
var FALL=',system-ui,Roboto,"Segoe UI",sans-serif';
var PREF=lsGet('cal-aspetto',null)||{};
if(!PREF.tema)PREF.tema='scuro';
if(!PREF.font)PREF.font='fira';
var LIGHT=false;
var SHOW=lsGet('cal-mostra',null)||{};     /* calendari mostrati o nascosti a mano */
var VIEWS=['month','week','day','agenda'];
var S={view:lsGet('cal-vista','month'),cur:TODAY};
if(VIEWS.indexOf(S.view)<0)S.view='month';

var CALS=[],CALMAP={},EV=[],BYKEY={};
var WIN={min:TODAY-200,max:TODAY+560};     /* intervallo di giorni tenuto sul telefono */
var LAST=0,ACCOUNT='';
var TOKEN=lsGet('cal-token',null);
var SYNCING=false,SYNCP=null,SYNCERR='',SYNCAGAIN=false,EXTENDING=false,NEEDCONSENT=false;
var stage=$('stage');

function setCals(list){CALS=list;CALMAP={};list.forEach(function(c){CALMAP[c.id]=c;});}
function setEvents(list){EV=list;BYKEY={};list.forEach(function(e){BYKEY[e.key]=e;});}
function upsert(e){if(!e)return;if(BYKEY[e.key]){for(var i=0;i<EV.length;i++){if(EV[i].key===e.key){EV[i]=e;break;}}}else EV.push(e);BYKEY[e.key]=e;}
function removeWhere(fn){setEvents(EV.filter(function(e){return!fn(e);}));}
function calShown(c){return SHOW[c.id]!==undefined?SHOW[c.id]:c.selected;}
function canWrite(calId){var c=CALMAP[calId];return!!c&&(c.role==='owner'||c.role==='writer');}
function writable(){return CALS.filter(function(c){return canWrite(c.id);});}

/* ================= memoria sul telefono (IndexedDB) ================= */
var idb=null;
function idbOpen(){return new Promise(function(res){try{var r=indexedDB.open('calendario-agenda',1);r.onupgradeneeded=function(){r.result.createObjectStore('kv');};r.onsuccess=function(){idb=r.result;res();};r.onerror=function(){res();};}catch(err){res();}});}
function idbGet(k){return new Promise(function(res){if(!idb)return res(null);try{var q=idb.transaction('kv').objectStore('kv').get(k);q.onsuccess=function(){res(q.result||null);};q.onerror=function(){res(null);};}catch(err){res(null);}});}
function idbSet(k,v){if(!idb)return;try{idb.transaction('kv','readwrite').objectStore('kv').put(v,k);}catch(err){}}
function saveCache(){idbSet('data',{cals:CALS,ev:EV,win:WIN,last:LAST,account:ACCOUNT});}

/* ================= accesso a Google ================= */
var tokenClient=null,pending=[];
function cfgOk(){return!!CFG.clientId&&CFG.clientId.indexOf('INSERISCI')<0;}
function tokenOk(){return!!TOKEN&&TOKEN.exp>Date.now()+60000;}
function dropToken(){TOKEN=null;lsSet('cal-token',null);}
function initClient(){
  if(tokenClient)return true;
  if(!cfgOk()||!window.google||!google.accounts||!google.accounts.oauth2)return false;
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:CFG.clientId,scope:SCOPE_LIST.join(' '),prompt:'',callback:onToken,error_callback:onTokenErr});
  return true;
}
function failAll(){var q=pending;pending=[];q.forEach(function(x){if(x.fail)x.fail();});}
function onToken(r){
  if(!r||r.error||!r.access_token){failAll();toast('Accesso non riuscito');return;}
  var full=true;try{full=google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE_LIST[0],SCOPE_LIST[1]);}catch(err){}
  if(!full){NEEDCONSENT=true;failAll();loginErr('Servono entrambe le autorizzazioni. Riprova e lascia spuntate tutte le caselle.');toast('Autorizzazioni incomplete: riprova');return;}
  NEEDCONSENT=false;
  TOKEN={t:r.access_token,exp:Date.now()+(+r.expires_in||3600)*1000};lsSet('cal-token',TOKEN);
  var q=pending;pending=[];q.forEach(function(x){if(x.ok)x.ok();});
  if(Date.now()-LAST>180000)syncAll();
  refreshSync();
}
function onTokenErr(e){failAll();toast(e&&e.type==='popup_failed_to_open'?'Il telefono ha bloccato la finestra di Google: riprova':'Accesso annullato');}
function requestToken(ok,fail){
  if(!initClient()){if(fail)fail();toast(cfgOk()?'Accesso Google non raggiungibile: controlla la connessione':'Manca l\'ID client nel file config.js');return;}
  pending.push({ok:ok,fail:fail});
  var o={prompt:NEEDCONSENT?'consent':''};if(ACCOUNT){o.hint=ACCOUNT;o.login_hint=ACCOUNT;}
  try{tokenClient.requestAccessToken(o);}catch(err){failAll();toast('Accesso non riuscito');}
}
/* esegue subito se l'accesso è valido, altrimenti lo chiede (serve un tocco dell'utente) */
function withToken(ok,fail){if(tokenOk())ok();else requestToken(ok,fail);}

function api(method,path,params,body){
  var url=API+path;
  if(params){var q=[];for(var k in params)q.push(enc(k)+'='+enc(params[k]));url+='?'+q.join('&');}
  var h={Authorization:'Bearer '+(TOKEN?TOKEN.t:'')};if(body)h['Content-Type']='application/json';
  return fetch(url,{method:method,headers:h,body:body?JSON.stringify(body):undefined}).then(function(r){
    return r.text().then(function(t){
      var j=null;try{j=t?JSON.parse(t):null;}catch(err){}
      if(!r.ok){var er=new Error(j&&j.error&&j.error.message?j.error.message:'Errore '+r.status);er.status=r.status;throw er;}
      return j;
    });
  });
}
function errMsg(err){
  if(!err||!err.status)return'Nessuna connessione con Google';
  if(err.status===401){dropToken();return'Accesso scaduto: tocca di nuovo per rinnovarlo';}
  if(err.status===403)return'Google ha negato il permesso: '+err.message;
  if(err.status===404||err.status===410)return'Evento non trovato: forse è già stato eliminato';
  return'Google ha risposto con un errore ('+err.status+')';
}

/* ================= lettura da Google ================= */
function mapCal(g){
  var bg=String(g.backgroundColor||DEF_COLOR).toLowerCase();if(!/^#[0-9a-f]{6}$/.test(bg))bg=DEF_COLOR;
  return{id:g.id,name:g.summaryOverride||g.summary||g.id,c:CAL_MODERN[bg]||bg,role:g.accessRole||'reader',primary:!!g.primary,selected:!!g.selected};
}
function mapEv(calId,g){
  if(!g||g.status==='cancelled'||!g.start)return null;
  var allDay=!!g.start.date,sd,ed,st=0,et=0;
  if(allDay){sd=unIso(g.start.date);ed=unIso((g.end&&g.end.date)||g.start.date)-1;if(!(ed>=sd))ed=sd;}
  else{
    var a=new Date(g.start.dateTime),b=new Date((g.end&&g.end.dateTime)||g.start.dateTime);
    if(isNaN(a)||isNaN(b))return null;
    sd=dn(a.getFullYear(),a.getMonth(),a.getDate());st=a.getHours()*60+a.getMinutes();
    ed=dn(b.getFullYear(),b.getMonth(),b.getDate());et=b.getHours()*60+b.getMinutes();
    if(ed>sd&&et===0){ed--;et=1440;}
    if(ed<sd)ed=sd;
  }
  if(isNaN(sd))return null;
  return{key:calId+'|'+g.id,id:g.id,cal:calId,title:g.summary||'(senza titolo)',loc:g.location||'',desc:g.description||'',
    sd:sd,ed:ed,allDay:allDay,st:st,et:et,color:g.colorId||'',rec:g.recurringEventId||'',link:g.htmlLink||'',type:g.eventType||'default'};
}
function fetchEvents(calId,a,b){
  var out=[];
  function page(tok){
    var p={singleEvents:'true',maxResults:'2500',timeMin:dayStartIso(a),timeMax:dayStartIso(b),fields:EV_FIELDS};if(tok)p.pageToken=tok;
    return api('GET','/calendars/'+enc(calId)+'/events',p).then(function(j){
      ((j&&j.items)||[]).forEach(function(g){var e=mapEv(calId,g);if(e)out.push(e);});
      return j&&j.nextPageToken?page(j.nextPageToken):out;
    });
  }
  return page();
}
function syncAll(){
  if(SYNCING){SYNCAGAIN=true;return SYNCP;}
  if(!tokenOk())return Promise.resolve();
  SYNCING=true;SYNCERR='';refreshSync();
  SYNCP=api('GET','/users/me/calendarList',{maxResults:'250',fields:'items(id,summary,summaryOverride,backgroundColor,accessRole,selected,primary)'}).then(function(j){
    var cals=((j&&j.items)||[]).map(mapCal);
    cals.sort(function(a,b){return(b.primary-a.primary)||a.name.localeCompare(b.name);});
    var win={min:TODAY-200,max:TODAY+560};
    return Promise.all(cals.map(function(c){
      return fetchEvents(c.id,win.min,win.max).then(null,function(err){
        if(err&&err.status===401)throw err;
        return EV.filter(function(e){return e.cal===c.id;});   /* se un calendario non risponde tengo i dati che avevo */
      });
    })).then(function(lists){
      var all=[];lists.forEach(function(l){all=all.concat(l);});
      setCals(cals);setEvents(all);WIN=win;LAST=Date.now();
      var pr=cals.filter(function(c){return c.primary;})[0];if(pr)ACCOUNT=pr.id;
      saveCache();buildDrawer();
    });
  }).then(function(){SYNCING=false;$('login').hidden=true;},function(err){SYNCING=false;SYNCERR=errMsg(err);if(err&&err.status===401)SYNCERR='';})
  .then(function(){refreshSync();render();if(SYNCAGAIN){SYNCAGAIN=false;if(tokenOk())syncAll();}});
  return SYNCP;
}
/* se si scorre oltre l'intervallo tenuto sul telefono, scarica il pezzo che manca */
function extendWin(a,b){
  if(EXTENDING||SYNCING||!tokenOk()||!CALS.length)return;
  var na=Math.min(WIN.min,a-120),nb=Math.max(WIN.max,b+120),spans=[];
  if(na<WIN.min)spans.push([na,WIN.min]);
  if(nb>WIN.max)spans.push([WIN.max,nb]);
  if(!spans.length)return;
  EXTENDING=true;
  var jobs=[];
  spans.forEach(function(s){CALS.forEach(function(c){jobs.push(fetchEvents(c.id,s[0],s[1]).then(null,function(){return[];}));});});
  Promise.all(jobs).then(function(lists){
    lists.forEach(function(l){l.forEach(upsert);});
    WIN={min:na,max:nb};saveCache();EXTENDING=false;render();
  });
}

/* ================= stato dell'aggiornamento ================= */
function agoText(t){var d=new Date(t),n=dn(d.getFullYear(),d.getMonth(),d.getDate()),h=p2(d.getHours())+':'+p2(d.getMinutes());return n===TODAY?'alle '+h:'il '+d.getDate()+' '+M3[d.getMonth()]+' alle '+h;}
function syncState(){
  if(!CALS.length&&!SYNCING)return null;
  if(SYNCING)return{text:'Aggiornamento in corso…',busy:true};
  if(SYNCERR)return{text:SYNCERR+' · Tocca per riprovare'};
  if(!tokenOk())return{text:(LAST?'Aggiornato '+agoText(LAST):'Non ancora aggiornato')+' · Tocca per aggiornare'};
  return null;
}
function refreshSync(){
  var el=$('sync'),st=syncState(),was=el.hidden;
  el.hidden=!st;
  if(st){el.textContent=st.text;el.disabled=!!st.busy;}
  return was!==el.hidden;
}
$('sync').addEventListener('click',function(){withToken(function(){syncAll();});});

/* ================= aspetto ================= */
var mqLight=window.matchMedia('(prefers-color-scheme: light)');
function curFont(){return FONTS.filter(function(f){return f.id===PREF.font;})[0]||FONTS[0];}
function applyLook(){
  var root=document.documentElement,f=curFont();
  LIGHT=PREF.tema==='chiaro'||(PREF.tema==='auto'&&mqLight.matches);
  root.setAttribute('data-tema',LIGHT?'chiaro':'scuro');
  root.style.setProperty('--f-ui',f.ui+FALL);root.style.setProperty('--f-tight',f.tight+FALL);
  var meta=document.querySelector('meta[name=theme-color]');if(meta)meta.setAttribute('content',LIGHT?'#f3f1ec':'#17171a');
  document.querySelectorAll('#tema button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.tema===PREF.tema?'true':'false');});
  document.querySelectorAll('#fonts button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.font===f.id?'true':'false');});
  lsSet('cal-aspetto',PREF);
}
$('fonts').innerHTML=FONTS.map(function(f){return'<button data-font="'+f.id+'" style="font-family:'+esc(f.ui+FALL)+'">'+f.name+'</button>';}).join('');
$('tema').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;PREF.tema=b.dataset.tema;applyLook();render();});
$('fonts').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;PREF.font=b.dataset.font;applyLook();render();
  if(document.fonts&&document.fonts.load){var f=curFont();Promise.all([document.fonts.load('16px '+f.ui),document.fonts.load('16px '+f.tight)]).then(function(){render();},function(){});}
});
if(mqLight.addEventListener)mqLight.addEventListener('change',function(){applyLook();render();});

/* ================= viste ================= */
function isBar(e){return e.allDay||e.ed>e.sd;}
function vis(){return EV.filter(function(e){var c=CALMAP[e.cal];return c&&calShown(c);});}
function cmpDay(a,b){return(isBar(b)-isBar(a))||(isBar(a)?(a.sd-b.sd||(b.ed-b.sd)-(a.ed-a.sd)):(a.st-b.st))||a.title.localeCompare(b.title);}
function eventsOn(day,list){return(list||vis()).filter(function(e){return e.sd<=day&&e.ed>=day;}).sort(cmpDay);}
function evColor(e){if(e.color&&EV_COLORS[e.color])return EV_COLORS[e.color];var c=CALMAP[e.cal];return c?c.c:DEF_COLOR;}
function sty(e){var l=looks(evColor(e));return'--c:'+l.c+';--on:'+l.on+';--t:'+l.t;}
function kAttr(e){return' data-k="'+esc(e.key)+'"';}

function renderMonth(){
  var c=fd(S.cur),first=dn(c.y,c.m,1),start=monday(first),list=vis();
  var wkH=(stage.clientHeight-26)/6,maxL=Math.max(1,Math.floor((wkH-25)/21));
  var h='<div class="dow">'+G3.map(function(g){return'<span>'+g+'</span>';}).join('')+'</div><div class="weeks">';
  for(var w=0;w<6;w++){
    var ws=start+7*w,we=ws+6,occ=[[],[],[],[],[],[],[]],items=[],extra=[0,0,0,0,0,0,0];
    list.filter(function(e){return isBar(e)&&e.sd<=we&&e.ed>=ws;}).sort(function(a,b){return a.sd-b.sd||(b.ed-b.sd)-(a.ed-a.sd)||a.title.localeCompare(b.title);}).forEach(function(e){
      var s=Math.max(e.sd,ws)-ws,t=Math.min(e.ed,we)-ws,lane=0,d;
      for(;;){var free=true;for(d=s;d<=t;d++){if(occ[d][lane]){free=false;break;}}if(free)break;lane++;}
      for(d=s;d<=t;d++)occ[d][lane]=1;
      items.push({e:e,s:s,span:t-s+1,lane:lane,bar:true,cl:e.sd<ws,cr:e.ed>we});
    });
    for(var d=0;d<7;d++){
      list.filter(function(e){return!isBar(e)&&e.sd===ws+d;}).sort(function(a,b){return a.st-b.st;}).forEach(function(e){
        var lane=0;while(occ[d][lane])lane++;occ[d][lane]=1;items.push({e:e,s:d,span:1,lane:lane,bar:false});
      });
    }
    var evh='';
    items.forEach(function(it){
      if(it.lane>=maxL){for(var x=it.s;x<it.s+it.span;x++)extra[x]++;return;}
      var onT=!it.bar&&ws+it.s===TODAY;
      evh+='<button class="ev '+(it.bar?'bar':'txt')+(it.cl?' cl':'')+(it.cr?' cr':'')+(onT?' ot':'')+'"'+kAttr(it.e)+' style="grid-column:'+(it.s+1)+' / span '+it.span+';grid-row:'+(it.lane+1)+';'+sty(it.e)+'">'+esc(it.e.title)+'</button>';
    });
    var bg='';
    for(d=0;d<7;d++){
      var day=ws+d,k=fd(day);
      bg+='<button class="cell'+(d>=5?' we':'')+(d===6?' sun':'')+(k.m!==c.m?' out':'')+(day===TODAY?' today':'')+'" data-day="'+day+'" aria-label="'+GIORNI[d]+' '+k.d+' '+MESI[k.m]+'"><span class="num">'+k.d+'</span>'+(extra[d]?'<span class="plus">+'+extra[d]+'</span>':'')+'</button>';
    }
    h+='<div class="wk"><div class="wk-bg">'+bg+'</div><div class="wk-ev">'+evh+'</div></div>';
  }
  return{cls:'month',html:h+'</div>',t1:MESI[c.m],t2:String(c.y),a:start,b:start+41};
}

function dayCell(day,d,list){
  var k=fd(day),evs=eventsOn(day,list);
  var h='<div class="wcell'+(d>=5?' we':'')+(d===6?' sun':'')+(day===TODAY?' today':'')+'" data-day="'+day+'">'
    +'<button class="wh" data-day="'+day+'"><span class="n">'+k.d+'</span><span class="d">'+GIORNI[d]+'</span>'+((d===0||k.d===1)?'<span class="m">/ '+M3[k.m]+'</span>':'')+'</button>';
  evs.forEach(function(e){
    h+=isBar(e)?'<button class="wbar fit"'+kAttr(e)+' style="'+sty(e)+'">'+esc(e.title)+'</button>'
      :'<button class="wtxt fit"'+kAttr(e)+' style="'+sty(e)+'"><span class="tm">'+hm(e.st)+'</span> '+esc(e.title)+'</button>';
  });
  return h+'<div class="more" hidden></div></div>';
}
function rangeLabel(a,b){var x=fd(a),y=fd(b);return x.m===y.m?x.d+'–'+y.d:x.d+' '+M3[x.m]+'–'+y.d+' '+M3[y.m];}
function renderWeek(){
  var ws=monday(S.cur),list=vis(),h='';
  for(var d=0;d<7;d++)h+=dayCell(ws+d,d,list);
  var ns=ws+7,ne=ws+13;
  var nx=list.filter(function(e){return e.sd<=ne&&e.ed>=ns;}).sort(function(a,b){return Math.max(a.sd,ns)-Math.max(b.sd,ns)||cmpDay(a,b);});
  h+='<div class="wcell next" data-go="next" role="button" tabindex="0" aria-label="Apri la settimana successiva"><h3><span>Settimana successiva</span><i>'+rangeLabel(ns,ne)+'</i></h3>';
  if(!nx.length)h+='<div class="empty">Nessun evento</div>';
  nx.forEach(function(e){
    var s=Math.max(e.sd,ns),t=Math.min(e.ed,ne),a=fd(s),b=fd(t),lab=G3[a.w]+' '+a.d;
    if(t>s)lab+='–'+G3[b.w]+' '+b.d;
    h+='<div class="prow fit" style="'+sty(e)+'"><span class="pd">'+lab+'</span><span class="pt'+(isBar(e)?' bar':'')+'">'+esc(e.title)+'</span></div>';
  });
  h+='<div class="more" hidden></div></div>';
  var m=fd(ws),e2=fd(ws+6);
  return{cls:'week',html:h,t1:(m.m===e2.m?MESI[m.m]:M3[m.m]+' – '+M3[e2.m])+' '+e2.y,t2:'lun '+m.d+' – dom '+e2.d,fit:true,a:ws,b:ws+13};
}

function renderDay(){
  var day=S.cur,k=fd(day),evs=eventsOn(day);
  var h='<div class="dh"><span class="n">'+k.d+'</span><span class="d">'+GIORNI[k.w]+'</span>'+(day===TODAY?'<span class="tag">Oggi</span>':'')+'</div><div class="dlist">';
  if(!evs.length)h+='<div class="empty">Nessun evento. Tieni premuto per crearne uno.</div>';
  evs.forEach(function(e){
    h+=isBar(e)?'<button class="dbar"'+kAttr(e)+' style="'+sty(e)+'">'+esc(e.title)+'</button>'
      :'<button class="drow"'+kAttr(e)+' style="'+sty(e)+'"><span class="tm"><b>'+hm(e.st)+'</b>'+hm(e.et)+'</span><span class="st"></span><span class="tx"><b>'+esc(e.title)+'</b>'+(e.loc?'<span>'+esc(e.loc)+'</span>':'')+'</span></button>';
  });
  return{cls:'dayv'+(k.w>=5?' we':'')+(k.w===6?' sun':''),day:day,html:h+'</div>',t1:GIORNI[k.w]+' '+k.d,t2:MESI[k.m]+' '+k.y,a:day,b:day};
}

function renderAgenda(){
  var list=vis(),h='';
  for(var day=TODAY;day<TODAY+120;day++){
    var evs=eventsOn(day,list);if(!evs.length)continue;
    var k=fd(day);
    h+='<div class="ag-day'+(k.w===6?' sun':'')+'"><span class="n">'+k.d+'</span><span class="d">'+GIORNI[k.w]+', '+MESI[k.m]+'</span>'+(day===TODAY?'<span class="tag">Oggi</span>':'')+'</div>';
    evs.forEach(function(e){
      h+='<button class="ag-row"'+kAttr(e)+' style="'+sty(e)+'"><span class="tm">'+(isBar(e)?'':hm(e.st))+'</span><span class="tt'+(isBar(e)?' bar':'')+'">'+esc(e.title)+'</span></button>';
    });
  }
  if(!h)h='<div class="empty">Nessun evento nei prossimi mesi.</div>';
  return{cls:'agenda',html:h,t1:'Agenda',t2:'da oggi in avanti',a:TODAY,b:TODAY+120};
}

function fitCells(root){
  root.querySelectorAll('.wcell').forEach(function(cell){
    var items=cell.querySelectorAll('.fit'),more=cell.querySelector('.more'),n=0;
    while(cell.scrollHeight>cell.clientHeight+1&&n<items.length){
      n++;items[items.length-n].hidden=true;more.hidden=false;more.textContent=n===1?'+1 altro':'+'+n+' altri';
    }
  });
}

function render(anim){
  refreshSync();
  var keepScroll=(!anim&&S.view==='agenda'&&stage.firstChild)?stage.firstChild.scrollTop:0;
  var r={month:renderMonth,week:renderWeek,day:renderDay,agenda:renderAgenda}[S.view]();
  stage.className=S.view==='agenda'?'scrolls':'';
  stage.innerHTML='<div class="view '+r.cls+(anim?' '+anim:'')+'"'+(r.day!=null?' data-day="'+r.day+'"':'')+'>'+r.html+'</div>';
  if(r.fit)fitCells(stage);
  if(keepScroll)stage.firstChild.scrollTop=keepScroll;
  $('t1').textContent=r.t1;$('t2').textContent=r.t2;
  document.querySelectorAll('#tabs button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.view===S.view?'true':'false');});
  if(r.a<WIN.min||r.b>WIN.max)extendWin(r.a,r.b);
}

/* ================= navigazione e gesti ================= */
function shift(dir){
  if(S.view==='agenda')return;
  if(S.view==='month'){var c=fd(S.cur),n=dn(c.y,c.m+dir,1),k=fd(n),t=fd(TODAY);S.cur=(k.y===t.y&&k.m===t.m)?TODAY:n;}
  else S.cur+=(S.view==='week'?7:1)*dir;
  render(dir>0?'up':'down');
}
function setView(v,anim){if(v===S.view)return;S.view=v;lsSet('cal-vista',v);render(anim);}
function stepView(dir){var i=VIEWS.indexOf(S.view)+dir;if(i<0||i>=VIEWS.length)return;setView(VIEWS[i],dir>0?'left':'right');}

/* verticale = avanti/indietro nel tempo, orizzontale = cambia vista, pressione lunga = nuovo evento */
var P=null,lpTimer=0,lpFired=false,suppressUntil=0;
stage.addEventListener('pointerdown',function(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  lpFired=false;clearTimeout(lpTimer);
  P={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};
  var dayEl=e.target.closest('[data-day]');
  if(dayEl&&!e.target.closest('[data-k]')){
    lpTimer=setTimeout(function(){if(P&&!P.moved){lpFired=true;P=null;openForm({day:+dayEl.dataset.day});}},550);
  }
});
stage.addEventListener('pointermove',function(e){
  if(!P||e.pointerId!==P.id)return;
  if(Math.abs(e.clientX-P.x)>10||Math.abs(e.clientY-P.y)>10){P.moved=true;clearTimeout(lpTimer);}
});
function endPointer(e){
  if(!P||e.pointerId!==P.id)return;
  clearTimeout(lpTimer);
  var dx=e.clientX-P.x,dy=e.clientY-P.y,ax=Math.abs(dx),ay=Math.abs(dy);P=null;
  if(e.type==='pointercancel')return;
  if(ax>45&&ax>ay*1.4){suppressUntil=performance.now()+400;stepView(dx<0?1:-1);}
  else if(ay>45&&ay>ax*1.4&&S.view!=='agenda'){suppressUntil=performance.now()+400;shift(dy<0?1:-1);}
}
window.addEventListener('pointerup',endPointer);
window.addEventListener('pointercancel',endPointer);
stage.addEventListener('contextmenu',function(e){e.preventDefault();});
function blocked(){return lpFired||performance.now()<suppressUntil;}

stage.addEventListener('click',function(e){
  if(blocked())return;
  var ev=e.target.closest('[data-k]');
  if(ev){openDetail(ev.dataset.k);return;}
  if(e.target.closest('[data-go]')){shift(1);return;}
  var d=e.target.closest('[data-day]');
  if(!d)return;
  if(S.view==='month'){S.cur=+d.dataset.day;setView('week','left');}
  else if(S.view==='week'){S.cur=+d.dataset.day;setView('day','left');}
});
var lastWheel=0;
stage.addEventListener('wheel',function(e){
  if(S.view==='agenda')return;
  e.preventDefault();
  var t=performance.now();if(t-lastWheel<320||Math.abs(e.deltaY)<8)return;lastWheel=t;shift(e.deltaY>0?1:-1);
},{passive:false});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeAll();return;}
  if(!$('scrim').hidden||!$('login').hidden||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.key==='ArrowDown')shift(1);else if(e.key==='ArrowUp')shift(-1);
  else if(e.key==='ArrowRight')stepView(1);else if(e.key==='ArrowLeft')stepView(-1);
  else if((e.key==='Enter'||e.key===' ')&&e.target.dataset&&e.target.dataset.go){e.preventDefault();shift(1);}
});
$('tabs').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  var i=VIEWS.indexOf(b.dataset.view),j=VIEWS.indexOf(S.view);
  setView(b.dataset.view,i>j?'left':'right');
});
$('b-today').addEventListener('click',function(){S.cur=TODAY;render('down');if(S.view==='agenda'&&stage.firstChild)stage.firstChild.scrollTop=0;});
$('b-new').addEventListener('click',function(){openForm({day:S.view==='agenda'?TODAY:S.cur});});
$('b-menu').addEventListener('click',function(){show('drawer');});

/* ================= pannelli ================= */
function show(id){['drawer','detail','formsheet'].forEach(function(x){$(x).hidden=x!==id;});$('scrim').hidden=false;}
function closeAll(){['drawer','detail','formsheet','scrim'].forEach(function(x){$(x).hidden=true;});}
$('scrim').addEventListener('click',function(){if(!blocked())closeAll();});
var toastT=0;
function toast(msg){var t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;},2600);}

/* menu laterale */
function buildDrawer(){
  $('acct').textContent=ACCOUNT?'Account: '+ACCOUNT:'';
  $('cal-list').innerHTML=CALS.length?CALS.map(function(c,i){
    return'<label style="--c:'+c.c+'"><input type="checkbox" id="cal-'+i+'" data-i="'+i+'"'+(calShown(c)?' checked':'')+'><span class="sw"></span><span class="nm">'+esc(c.name)+'</span></label>';
  }).join(''):'<div class="empty">Nessun calendario caricato.</div>';
}
$('cal-list').addEventListener('change',function(e){var c=CALS[+e.target.dataset.i];if(!c)return;SHOW[c.id]=e.target.checked;lsSet('cal-mostra',SHOW);render();});
$('m-sync').addEventListener('click',function(){closeAll();withToken(function(){syncAll();});});
$('m-out').addEventListener('click',function(){
  var b=$('m-out');
  if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Conferma: esci e cancella';return;}
  b.classList.remove('sure');b.textContent='Esci e cancella i dati dal telefono';
  try{if(TOKEN&&window.google)google.accounts.oauth2.revoke(TOKEN.t,function(){});}catch(err){}
  dropToken();setCals([]);setEvents([]);LAST=0;ACCOUNT='';SYNCERR='';idbSet('data',null);
  closeAll();buildDrawer();render();showLogin();
});

/* dettaglio evento */
function longDate(n){var k=fd(n);return GIORNI[k.w]+' '+k.d+' '+MESI[k.m]+' '+k.y;}
function shortDate(n){var k=fd(n);return G3[k.w]+' '+k.d+' '+M3[k.m];}
function whenText(e){
  if(e.ed>e.sd)return'da '+shortDate(e.sd)+(e.allDay?'':' '+hm(e.st))+' a '+shortDate(e.ed)+(e.allDay?'':' '+hm(e.et));
  return longDate(e.sd)+(e.allDay?' · tutto il giorno':' · '+hm(e.st)+' – '+hm(e.et));
}
var openKey=null;
function editable(e){return canWrite(e.cal)&&e.type==='default';}
function openDetail(key){
  var e=BYKEY[key];if(!e)return;
  openKey=key;
  var c=CALMAP[e.cal],ed=editable(e);
  $('detail').style.cssText=sty(e);
  $('d-title').textContent=e.title;$('d-when').textContent=whenText(e)+(e.rec?' · si ripete':'');
  $('d-loc').textContent=e.loc;$('d-loc').hidden=!e.loc;
  var desc=plain(e.desc);$('d-desc').textContent=desc;$('d-desc').hidden=!desc;
  $('d-cal').textContent='Calendario: '+(c?c.name:'')+(ed?'':' · sola lettura');
  $('d-link').hidden=!e.link;if(e.link)$('d-link').href=e.link;
  $('d-share').hidden=true;
  $('d-edit').hidden=!ed;$('d-del').hidden=!ed;$('d-dup').hidden=!writable().length;
  var del=$('d-del');del.classList.remove('sure');del.textContent='Elimina';
  $('d-acts').hidden=false;$('d-delopts').hidden=true;
  show('detail');
}
$('d-close').addEventListener('click',closeAll);
$('d-edit').addEventListener('click',function(){var e=BYKEY[openKey];if(e)openForm({ev:e});});
$('d-dup').addEventListener('click',function(){var e=BYKEY[openKey];if(e)openForm({copy:e});});
$('d-share-btn').addEventListener('click',function(){
  var e=BYKEY[openKey];if(!e)return;
  var txt=e.title+'\n'+whenText(e)+(e.loc?'\n'+e.loc:'');
  function fallback(){
    var p=$('d-share');p.textContent=txt;p.hidden=false;
    var ok=function(){toast('Testo copiato, incollalo dove vuoi');},ko=function(){toast('Seleziona il testo per copiarlo');};
    try{navigator.clipboard.writeText(txt).then(ok,ko);}catch(err){ko();}
  }
  if(navigator.share){
    try{navigator.share({title:e.title,text:txt}).catch(function(err){if(!err||err.name!=='AbortError')fallback();});}catch(err){fallback();}
  }else fallback();
});
function doDelete(e,series){
  var btns=document.querySelectorAll('#detail .btn');
  function busy(on){btns.forEach(function(b){b.disabled=on;});}
  busy(true);
  withToken(function(){
    api('DELETE','/calendars/'+enc(e.cal)+'/events/'+enc(series?e.rec:e.id)).then(null,function(err){if(err&&err.status===410)return null;throw err;}).then(function(){
      if(series)removeWhere(function(x){return x.cal===e.cal&&(x.rec===e.rec||x.id===e.rec);});
      else removeWhere(function(x){return x.key===e.key;});
      afterWrite();closeAll();render();toast(series?'Serie eliminata':'Evento eliminato');
    },function(err){toast(errMsg(err));refreshSync();}).then(function(){busy(false);});
  },function(){busy(false);});
}
$('d-del').addEventListener('click',function(){
  var e=BYKEY[openKey],b=$('d-del');if(!e)return;
  if(e.rec){$('d-acts').hidden=true;$('d-delopts').hidden=false;return;}
  if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Conferma eliminazione';return;}
  doDelete(e,false);
});
$('d-del-one').addEventListener('click',function(){var e=BYKEY[openKey];if(e)doDelete(e,false);});
$('d-del-all').addEventListener('click',function(){var e=BYKEY[openKey];if(e)doDelete(e,true);});
$('d-del-no').addEventListener('click',function(){$('d-acts').hidden=false;$('d-delopts').hidden=true;});

function afterWrite(){saveCache();if(SYNCING)SYNCAGAIN=true;}

/* modulo evento */
var REMS=[['def','Predefinito del calendario'],['none','Nessuno'],['0','All\'ora dell\'evento'],['10','10 minuti prima'],['30','30 minuti prima'],['60','1 ora prima'],['1440','1 giorno prima']];
var editKey=null,formOrig=null;
function syncAllDay(){var a=$('f-all').checked;$('f-st').hidden=a;$('f-et').hidden=a;$('r-start').classList.toggle('solo',a);$('r-end').classList.toggle('solo',a);}
function openForm(o){
  var ws=writable();
  if(!ws.length){toast(CALS.length?'Nessun calendario su cui puoi scrivere':'Prima collega Google Calendar');return;}
  var e=o.ev||o.copy;
  editKey=o.ev?o.ev.key:null;formOrig=o.ev||null;
  $('f-head').textContent=o.ev?'Modifica evento':(o.copy?'Duplica evento':'Nuovo evento');
  $('f-note').hidden=!(o.ev&&o.ev.rec);
  $('f-title').value=e?e.title:'';
  $('f-all').checked=e?e.allDay:false;
  $('f-sd').value=iso(e?e.sd:o.day);$('f-ed').value=iso(e?e.ed:o.day);
  $('f-st').value=hm(e&&!e.allDay?e.st:600);$('f-et').value=hm(e&&!e.allDay?e.et:660);
  var sel=$('f-cal');
  sel.innerHTML=ws.map(function(c){return'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join('');
  var want=e&&canWrite(e.cal)?e.cal:lsGet('cal-ultimo',''),pr=ws.filter(function(c){return c.primary;})[0];
  sel.value=canWrite(want)?want:(pr?pr.id:ws[0].id);
  sel.disabled=!!(o.ev&&o.ev.rec);
  $('w-rep').hidden=!!o.ev;$('f-rep').value='';
  $('f-rem').innerHTML=(o.ev?'<option value="keep">Non modificare</option>':'')+REMS.map(function(r){return'<option value="'+r[0]+'">'+r[1]+'</option>';}).join('');
  $('f-rem').value=o.ev?'keep':'def';
  $('f-loc').value=e?e.loc:'';$('f-desc').value=e?plain(e.desc):'';
  $('f-err').hidden=true;syncAllDay();setBusy(false);show('formsheet');
}
function setBusy(on){var b=$('f-save');b.disabled=on;b.textContent=on?'Salvataggio…':'Salva';}
$('f-all').addEventListener('change',syncAllDay);
$('f-sd').addEventListener('change',function(){if(!$('f-ed').value||unIso($('f-ed').value)<unIso($('f-sd').value))$('f-ed').value=$('f-sd').value;});
$('f-cancel').addEventListener('click',closeAll);

function timeBody(d,patch){
  var b={};
  if(d.allDay){b.start={date:iso(d.sd)};b.end={date:iso(d.ed+1)};if(patch){b.start.dateTime=null;b.start.timeZone=null;b.end.dateTime=null;b.end.timeZone=null;}}
  else{b.start={dateTime:iso(d.sd)+'T'+hm(d.st)+':00',timeZone:TZ};b.end={dateTime:iso(d.ed)+'T'+hm(d.et)+':00',timeZone:TZ};if(patch){b.start.date=null;b.end.date=null;}}
  return b;
}
function remBody(v){
  if(v==='def')return{useDefault:true};
  if(v==='none')return{useDefault:false,overrides:[]};
  return{useDefault:false,overrides:[{method:'popup',minutes:+v}]};
}
$('form').addEventListener('submit',function(ev){
  ev.preventDefault();
  var title=$('f-title').value.trim();
  if(!title){$('f-err').hidden=false;$('f-title').focus();return;}
  var all=$('f-all').checked,sd=unIso($('f-sd').value),ed=unIso($('f-ed').value);
  if(isNaN(sd))sd=S.cur;if(isNaN(ed)||ed<sd)ed=sd;
  var st=all?0:unHm($('f-st').value),et=all?0:unHm($('f-et').value);
  if(isNaN(st))st=600;if(isNaN(et))et=st+60;
  if(!all&&ed===sd&&et<=st){et=st+60;if(et>1439)et=1439;}
  var d={title:title,cal:$('f-cal').value,sd:sd,ed:ed,allDay:all,st:st,et:et,loc:$('f-loc').value.trim(),desc:$('f-desc').value.trim()};
  var rep=$('f-rep').value,rem=$('f-rem').value,orig=formOrig;
  setBusy(true);
  withToken(function(){
    var p,body;
    if(!orig){
      body=timeBody(d,false);body.summary=d.title;
      if(d.loc)body.location=d.loc;if(d.desc)body.description=d.desc;
      if(rep)body.recurrence=['RRULE:FREQ='+rep];
      if(rem!=='def')body.reminders=remBody(rem);
      p=api('POST','/calendars/'+enc(d.cal)+'/events',null,body).then(function(g){
        lsSet('cal-ultimo',d.cal);
        if(rep)return fetchEvents(d.cal,WIN.min,WIN.max).then(function(list){removeWhere(function(x){return x.cal===d.cal;});list.forEach(upsert);},function(){upsert(mapEv(d.cal,g));});
        upsert(mapEv(d.cal,g));
      });
    }else{
      body=timeBody(d,true);body.summary=d.title;body.location=d.loc;
      if(d.desc!==plain(orig.desc))body.description=d.desc;
      if(rem!=='keep')body.reminders=remBody(rem);
      var step=Promise.resolve(orig.cal);
      if(d.cal!==orig.cal&&!orig.rec)step=api('POST','/calendars/'+enc(orig.cal)+'/events/'+enc(orig.id)+'/move',{destination:d.cal}).then(function(){return d.cal;});
      p=step.then(function(cal){
        return api('PATCH','/calendars/'+enc(cal)+'/events/'+enc(orig.id),null,body).then(function(g){
          removeWhere(function(x){return x.key===orig.key;});upsert(mapEv(cal,g));
        });
      });
    }
    p.then(function(){
      afterWrite();if(S.view!=='agenda')S.cur=d.sd;
      closeAll();render();toast('Evento salvato');
    },function(err){toast(errMsg(err));refreshSync();}).then(function(){setBusy(false);});
  },function(){setBusy(false);});
});

/* ================= accesso iniziale ================= */
function loginErr(msg){var p=$('login-err');p.textContent=msg||'';p.hidden=!msg;}
function showLogin(){$('login').hidden=false;loginErr(cfgOk()?'':'L\'app non è ancora configurata: manca l\'ID client nel file config.js.');$('b-login').disabled=!cfgOk();}
$('b-login').addEventListener('click',function(){
  loginErr('');
  var b=$('b-login');b.disabled=true;
  requestToken(function(){b.disabled=false;syncAll();},function(){b.disabled=false;});
});

/* ================= avvio ================= */
function onVisible(){
  var t=todayNum();
  if(t!==TODAY){if(S.cur===TODAY)S.cur=t;TODAY=t;}
  render();
  if(tokenOk()&&Date.now()-LAST>180000)syncAll();
}
document.addEventListener('visibilitychange',function(){if(!document.hidden)onVisible();});
setInterval(function(){if(!document.hidden&&refreshSync())render();},60000);
var rz=0;
window.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(function(){render();},120);});

applyLook();
idbOpen().then(function(){return idbGet('data');}).then(function(d){
  if(d){setCals(d.cals||[]);setEvents(d.ev||[]);if(d.win)WIN=d.win;LAST=d.last||0;ACCOUNT=d.account||'';}
  buildDrawer();
  if(!CALS.length&&!tokenOk())showLogin();
  render();
  if(tokenOk())syncAll();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){render();});
});
if('serviceWorker' in navigator&&location.protocol==='https:'){navigator.serviceWorker.register('sw.js').catch(function(){});}
})();
