'use strict';
// Dependency-free Node backend. Persistent JSON store is suitable for a college demo;
// use a managed database for multi-instance production deployments.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.CHRONOSKY_DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'chronosky-data.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
const fresh = () => ({ state: {}, quizResults: [], worlds: {}, atmosphereRuns: [], feedback: [] });
let db = fresh();
try { db = { ...fresh(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch (_) { save(); }
function save() { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE); }
const now = () => new Date().toISOString();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : lo));
function calculateAtmosphere(input) {
  const I0 = clamp(input.I0 ?? 1, 0, 2), kR = clamp(input.kR ?? 0.12, 0, 2);
  const relativePressure = clamp(input.relativePressure ?? 1, 0, 10), relativePath = clamp(input.relativePath ?? 1, 0, 10);
  const wavelengthNm = clamp(input.wavelengthNm ?? 470, 380, 750), aerosolDepth = clamp(input.aerosolDepth ?? 0.18, 0, 5);
  const rayleighOpticalDepth = kR * relativePressure * relativePath * Math.pow(550 / wavelengthNm, 4);
  const opticalDepth = rayleighOpticalDepth + aerosolDepth, transmission = Math.exp(-opticalDepth);
  return { I0, kR, relativePressure, relativePath, wavelengthNm, aerosolDepth, rayleighOpticalDepth, opticalDepth, transmission, intensity: I0 * transmission, model: 'Simplified educational model; not a full radiative-transfer calculation.' };
}
const eras = [
 {id:'ice',name:'Late Ice Age',time:'10,000 BCE',certainty:'Broad regional context'},
 {id:'cretaceous',name:'Late Cretaceous / K–Pg boundary',time:'~66 million years ago',certainty:'Illustrative scene; boundary interval'},
 {id:'triassic',name:'Early Triassic',time:'~250 million years ago',certainty:'Broad post-extinction context'},
 {id:'now',name:'Modern Earth',time:'Present',certainty:'Observations where datasets are named'},
 {id:'future',name:'Possible Earth in 2100',time:'Scenario',certainty:'Not a prediction'}
];
const planets = [
 ['mercury','Mercury','terrestrial planet'],['venus','Venus','terrestrial planet'],['earth','Earth','terrestrial planet'],['mars','Mars','terrestrial planet'],['jupiter','Jupiter','gas giant'],['saturn','Saturn','gas giant'],['uranus','Uranus','ice giant'],['neptune','Neptune','ice giant'],['titan','Titan','moon of Saturn']
].map(([id,name,type])=>({id,name,type}));
const stars = [
 ['The Sun','G-type main-sequence star'],['Proxima Centauri','red dwarf'],['Alpha Centauri A & B','binary system'],['Barnard’s Star','red dwarf'],['Sirius','A-type main-sequence star and white dwarf companion'],['Vega','A-type main-sequence star'],['Betelgeuse','red supergiant'],['Rigel','blue supergiant'],['Antares','red supergiant'],['Polaris','Cepheid in a multiple-star system'],['Deneb','blue-white supergiant'],['Epsilon Eridani','K-type main-sequence star']
].map(([name,type])=>({name,type}));
function json(res, status, data) { const body = JSON.stringify(data); res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(body); }
function readBody(req) { return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>1_000_000){reject(new Error('Request body too large'));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(e);}});}); }
function worldBuilder(prompt) { const p=String(prompt||'').toLowerCase(),settings={},explanations=[];if(!String(prompt||'').trim())return null;
 if(/dust|haze|mist|smog/.test(p)){settings.haze=75;explanations.push('High haze selected.');}
 if(/red star|red dwarf/.test(p)){settings.star='red';explanations.push('Red-dwarf illumination selected.');}else if(/blue star/.test(p)){settings.star='blue';explanations.push('Blue-star illumination selected.');}else if(/orange star/.test(p)){settings.star='orange';explanations.push('Orange-star illumination selected.');}
 if(/mars|red planet|desert/.test(p)){settings.surface='desert';settings.composition='co2';settings.atmosphere=25;explanations.push('Dusty, thin CO₂-rich setting selected.');}
 if(/frozen|ice|icy/.test(p)){settings.surface='ice';settings.haze=10;explanations.push('Icy surface selected.');}
 if(/titan|methane/.test(p)){settings.composition='titan';settings.haze=70;explanations.push('Titan-like methane haze selected.');}
 if(/no atmosphere|airless/.test(p)){settings.composition='none';settings.atmosphere=0;explanations.push('Atmosphere set to zero.');}
 if(/two suns|binary/.test(p)){settings.sunCount='2';explanations.push('Two-star lighting selected.');}
 if(/ring/.test(p)){settings.moons='rings';explanations.push('Ringed-world cue selected.');}
 return {ok:true,settings,explanations,caveats:'Rules-based prompt parser; not an AI model. Review settings before applying.'}; }
async function route(req,res){
 const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`), p=url.pathname, method=req.method;
 if(method==='GET'&&p==='/api/health')return json(res,200,{ok:true,service:'ChronoSky API',version:'v21',timestamp:now(),persistence:'JSON file store'});
 if(method==='GET'&&p==='/api/state')return json(res,200,{state:db.state,updatedAt:db.stateUpdatedAt||null});
 if(method==='POST'&&p==='/api/state'){const b=await readBody(req);db.state={...db.state,...(b&&typeof b==='object'?b:{})};db.stateUpdatedAt=now();save();return json(res,200,{ok:true,state:db.state,updatedAt:db.stateUpdatedAt});}
 if(method==='GET'&&p==='/api/eras')return json(res,200,{eras});
 if(method==='GET'&&p==='/api/planets')return json(res,200,{planets});
 if(method==='GET'&&p==='/api/stars')return json(res,200,{stars});
 if(method==='POST'&&p==='/api/atmosphere/calculate'){const b=await readBody(req),result=calculateAtmosphere(b||{});db.atmosphereRuns.push({id:crypto.randomUUID(),payload:b,result,createdAt:now()});db.atmosphereRuns=db.atmosphereRuns.slice(-500);save();return json(res,200,{ok:true,result});}
 if(method==='POST'&&p==='/api/quiz-results'){const b=await readBody(req),type=String(b.type||'').toUpperCase();if(!/^(INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)$/.test(type))return json(res,400,{error:'A valid four-letter MBTI-style type is required.'});const result={id:crypto.randomUUID(),type,payload:b,createdAt:now()};db.quizResults.push(result);db.quizResults=db.quizResults.slice(-1000);save();return json(res,201,{ok:true,id:result.id,type,savedAt:result.createdAt});}
 if(method==='GET'&&p==='/api/quiz-results/latest'){const row=db.quizResults.at(-1);return json(res,200,row?{id:row.id,type:row.type,result:row.payload,createdAt:row.createdAt}:{result:null});}
 if(method==='POST'&&p==='/api/worlds'){const b=await readBody(req),id=crypto.randomBytes(7).toString('hex'),createdAt=now(),name=String(b.name||'My ChronoSky world').slice(0,80);db.worlds[id]={id,name,payload:b,createdAt};save();return json(res,201,{ok:true,id,name,createdAt,url:`/world/${id}`});}
 if(method==='GET'&&p.startsWith('/api/worlds/')){const id=p.split('/').pop(),w=db.worlds[id];return w?json(res,200,{id:w.id,name:w.name,world:w.payload,createdAt:w.createdAt}):json(res,404,{error:'World not found.'});}
 if(method==='POST'&&p==='/api/world-builder'){const b=await readBody(req),result=worldBuilder(b.prompt);return result?json(res,200,result):json(res,400,{error:'Describe a world first.'});}
 if(method==='POST'&&p==='/api/feedback'){const b=await readBody(req),message=String(b.message||'').trim().slice(0,2000);if(!message)return json(res,400,{error:'Feedback message is required.'});const row={id:crypto.randomUUID(),category:String(b.category||'general').slice(0,50),message,createdAt:now()};db.feedback.push(row);db.feedback=db.feedback.slice(-1000);save();return json(res,201,{ok:true,id:row.id});}
 if(p.startsWith('/api/'))return json(res,404,{error:'API endpoint not found.'});
 if(method!=='GET'&&method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end('Method not allowed');}
 const decoded=decodeURIComponent(p.split('?')[0]);let target=path.resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));if(!target.startsWith(ROOT+path.sep)&&target!==ROOT)return json(res,403,{error:'Forbidden'});
 try{const st=fs.statSync(target);if(st.isDirectory())target=path.join(target,'index.html');}catch(_){if(/^\/world\/[a-f0-9]+$/.test(p))target=path.join(ROOT,'index.html');else return json(res,404,{error:'File not found.'});}
 const ext=path.extname(target).toLowerCase(),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.mp4':'video/mp4','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
 try{const st=fs.statSync(target);res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Length':st.size,'X-Content-Type-Options':'nosniff','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});if(method==='HEAD')return res.end();fs.createReadStream(target).pipe(res);}catch(_){json(res,404,{error:'File not found.'});}
}
http.createServer((req,res)=>route(req,res).catch(err=>{console.error(err);json(res,err.message==='Unexpected end of JSON input'?400:500,{error:err.message==='Unexpected end of JSON input'?'Invalid JSON body':'Internal server error.'});})).listen(PORT,()=>console.log(`ChronoSky v21 ready at http://localhost:${PORT}`));
