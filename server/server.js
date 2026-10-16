'use strict';
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('node:path');
const crypto = require('node:crypto');
const Star = require('./models/Star');
const User = require('./models/User');
const VisitLog = require('./models/VisitLog');
const authRoutes = require('./routes/authRoutes');
const starRoutes = require('./routes/starRoutes');
const app = express();
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.includes('replace_with')) {
  console.error('Set JWT_SECRET in .env to a random secret of at least 32 characters.'); process.exit(1);
}
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : true }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });
app.use('/api/auth', authRoutes);
app.use('/api/stars', starRoutes);

const eras = [
 {id:'ice',name:'Late Ice Age',time:'10,000 BCE',certainty:'Broad regional context'},
 {id:'cretaceous',name:'Late Cretaceous / K–Pg boundary',time:'~66 million years ago',certainty:'Illustrative scene; boundary interval'},
 {id:'triassic',name:'Early Triassic',time:'~250 million years ago',certainty:'Broad post-extinction context'},
 {id:'now',name:'Modern Earth',time:'Present',certainty:'Observations where datasets are named'},
 {id:'future',name:'Possible Earth in 2100',time:'Scenario',certainty:'Not a prediction'}
];
const planets = [['mercury','Mercury','terrestrial planet'],['venus','Venus','terrestrial planet'],['earth','Earth','terrestrial planet'],['mars','Mars','terrestrial planet'],['jupiter','Jupiter','gas giant'],['saturn','Saturn','gas giant'],['uranus','Uranus','ice giant'],['neptune','Neptune','ice giant'],['titan','Titan','moon of Saturn']].map(([id,name,type])=>({id,name,type}));
const freshState = { state:{}, quizResults:[], worlds:{}, atmosphereRuns:[], feedback:[] };
let db = { ...freshState, stateUpdatedAt:null };
function clamp(v, lo, hi) { const n = Number(v); return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo)); }
function calculateAtmosphere(b={}) {
 const I0=clamp(b.I0??1,0,2), kR=clamp(b.kR??.12,0,2), relativePressure=clamp(b.relativePressure??1,0,10), relativePath=clamp(b.relativePath??1,0,10), wavelengthNm=clamp(b.wavelengthNm??470,380,750), aerosolDepth=clamp(b.aerosolDepth??.18,0,5);
 const rayleighOpticalDepth=kR*relativePressure*relativePath*Math.pow(550/wavelengthNm,4), opticalDepth=rayleighOpticalDepth+aerosolDepth, transmission=Math.exp(-opticalDepth);
 return {I0,kR,relativePressure,relativePath,wavelengthNm,aerosolDepth,rayleighOpticalDepth,opticalDepth,transmission,intensity:I0*transmission,model:'Simplified educational Beer–Lambert/Rayleigh model; not a full radiative-transfer calculation.'};
}
function worldBuilder(prompt) { const p=String(prompt||'').toLowerCase(),settings={},explanations=[];if(!p.trim())return null;
 if(/dust|haze|mist|smog/.test(p)){settings.haze=75;explanations.push('High haze selected.');}
 if(/red star|red dwarf/.test(p)){settings.star='red';explanations.push('Red-dwarf illumination selected.');}else if(/blue star/.test(p)){settings.star='blue';explanations.push('Blue-star illumination selected.');}else if(/orange star/.test(p)){settings.star='orange';explanations.push('Orange-star illumination selected.');}
 if(/mars|red planet|desert/.test(p)){settings.surface='desert';settings.composition='co2';settings.atmosphere=25;explanations.push('Dusty, thin CO₂-rich setting selected.');}
 if(/frozen|ice|icy/.test(p)){settings.surface='ice';settings.haze=10;explanations.push('Icy surface selected.');}if(/titan|methane/.test(p)){settings.composition='titan';settings.haze=70;explanations.push('Titan-like methane haze selected.');}if(/no atmosphere|airless/.test(p)){settings.composition='none';settings.atmosphere=0;explanations.push('Atmosphere set to zero.');}if(/two suns|binary/.test(p)){settings.sunCount='2';explanations.push('Two-star lighting selected.');}if(/ring/.test(p)){settings.moons='rings';explanations.push('Ringed-world cue selected.');}
 return {ok:true,settings,explanations,caveats:'Rules-based prompt parser; not an AI model. Review settings before applying.'}; }
app.get('/api/health', (_req,res)=>res.json({ok:true,service:'ChronoSky + Star Traveler API',version:'v21-mongo',database:mongoose.connection.readyState===1?'MongoDB connected':'MongoDB unavailable'}));
app.get('/api/eras',(_req,res)=>res.json({eras})); app.get('/api/planets',(_req,res)=>res.json({planets}));
app.get('/api/state',(_req,res)=>res.json({state:db.state,updatedAt:db.stateUpdatedAt}));
app.post('/api/state',(req,res)=>{db.state={...db.state,...req.body};db.stateUpdatedAt=new Date().toISOString();res.json({ok:true,state:db.state,updatedAt:db.stateUpdatedAt});});
app.post('/api/atmosphere/calculate',(req,res)=>{const result=calculateAtmosphere(req.body);db.atmosphereRuns.push({id:crypto.randomUUID(),payload:req.body,result,createdAt:new Date().toISOString()});db.atmosphereRuns=db.atmosphereRuns.slice(-500);res.json({ok:true,result});});
app.post('/api/quiz-results',(req,res)=>{const type=String(req.body.type||'').toUpperCase();if(!/^(INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)$/.test(type))return res.status(400).json({error:'A valid four-letter MBTI-style type is required.'});const row={id:crypto.randomUUID(),type,payload:req.body,createdAt:new Date().toISOString()};db.quizResults.push(row);db.quizResults=db.quizResults.slice(-1000);res.status(201).json({ok:true,id:row.id,type,savedAt:row.createdAt});});
app.get('/api/quiz-results/latest',(_req,res)=>{const row=db.quizResults.at(-1);res.json(row?{id:row.id,type:row.type,result:row.payload,createdAt:row.createdAt}:{result:null});});
app.post('/api/worlds',(req,res)=>{const id=crypto.randomBytes(7).toString('hex'),createdAt=new Date().toISOString(),name=String(req.body.name||'My ChronoSky world').slice(0,80);db.worlds[id]={id,name,payload:req.body,createdAt};res.status(201).json({ok:true,id,name,createdAt,url:`/world/${id}`});});
app.get('/api/worlds/:id',(req,res)=>{const w=db.worlds[req.params.id];return w?res.json({id:w.id,name:w.name,world:w.payload,createdAt:w.createdAt}):res.status(404).json({error:'World not found.'});});
app.post('/api/world-builder',(req,res)=>{const result=worldBuilder(req.body.prompt);return result?res.json(result):res.status(400).json({error:'Describe a world first.'});});
app.post('/api/feedback',(req,res)=>{const message=String(req.body.message||'').trim().slice(0,2000);if(!message)return res.status(400).json({error:'Feedback message is required.'});const row={id:crypto.randomUUID(),category:String(req.body.category||'general').slice(0,50),message,createdAt:new Date().toISOString()};db.feedback.push(row);db.feedback=db.feedback.slice(-1000);res.status(201).json({ok:true,id:row.id});});
// Development-only seeding; deliberately disabled unless explicitly enabled in .env.
app.post('/seed',async(_req,res)=>{if(process.env.ENABLE_SEED!=='true')return res.status(403).json({error:'Seeding disabled. Set ENABLE_SEED=true temporarily for local setup.'});try{if(await Star.estimatedDocumentCount())return res.json({msg:'Database already seeded'});
 const catalog=[
  ['sun','The Sun','G-type main-sequence star','The star at the centre of our Solar System.','Its light takes about 8 minutes 20 seconds to reach Earth.','#fff0a6'],
  ['sirius','Sirius','A-type main-sequence star','The brightest star in Earth’s night sky by apparent brightness.','Sirius is a binary system with a white dwarf companion.','#b8dcff'],
  ['vega','Vega','A-type main-sequence star','A bright star in the constellation Lyra.','Vega was one of the first stars photographed and had its spectrum recorded.','#c9e6ff'],
  ['polaris','Polaris','Cepheid / multiple-star system','The current North Star, close to the north celestial pole.','Polaris is a multiple-star system, not a lone star.','#fff1c6'],
  ['proxima','Proxima Centauri','Red dwarf','The closest known star to the Sun.','It is part of the Alpha Centauri system and has known exoplanets.','#ff9d80'],
  ['betelgeuse','Betelgeuse','Red supergiant','A huge, evolved star in Orion.','Its radius varies and it is expected to end its life in a supernova.','#ffad8d'],
  ['rigel','Rigel','Blue supergiant','A luminous blue-white star in Orion.','Despite appearing as one point, Rigel is a multiple-star system.','#a9dfff'],
  ['antares','Antares','Red supergiant','A reddish supergiant in Scorpius.','Its name is often interpreted as “rival of Mars” because of its colour.','#ff9b8b'],
  ['aldebaran','Aldebaran','Orange giant','An orange giant in Taurus.','It appears near the Hyades but is not a member of that cluster.','#ffc28d'],
  ['canopus','Canopus','A-type bright giant','One of the brightest stars in the night sky.','Canopus is used for spacecraft attitude navigation.','#fff0c7'],
  ['arcturus','Arcturus','Red giant','A bright orange giant in Boötes.','It is moving through space on a path that differs from most nearby stars.','#ffc78c'],
  ['capella','Capella','Multiple-star system','A bright system in Auriga.','Capella is made up of multiple stars, including a pair of evolved giants.','#ffe4ad'],
  ['barnards-star','Barnard’s Star','Red dwarf','A nearby low-mass star.','It has one of the largest known proper motions across our sky.','#ff9888'],
  ['alpha-centauri','Alpha Centauri A & B','Binary star system','A nearby pair of Sun-like stars.','The system also shares its neighbourhood with Proxima Centauri.','#e5ddff'],
  ['deneb','Deneb','Blue-white supergiant','A luminous star in Cygnus.','Deneb is one of the farthest stars visible as a first-magnitude star.','#c5dcff'],
  ['epsilon-eridani','Epsilon Eridani','K-type main-sequence star','A relatively nearby orange dwarf.','It hosts a debris disk and has been studied for possible planetary companions.','#ffd0a0']
 ];
 const docs=catalog.map(([slug,name,type,desc,fact,color],i)=>({slug,name,type,desc,fact,color,coordinates:{x:Math.cos(i*2.4)*300,y:Math.sin(i*2.4)*220,z:100+i*43}}));await Star.insertMany(docs);return res.json({msg:`Database seeded with ${docs.length} curated star records.`});
 }catch(err){console.error(err);return res.status(500).json({error:'Seed failed.'});}});
app.use(express.static(ROOT,{index:'index.html',fallthrough:true,maxAge:'1h',setHeaders(res,filePath){if(filePath.endsWith('.html'))res.setHeader('Cache-Control','no-cache');}}));
app.get('/world/:id',(_req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.use((req,res)=>req.path.startsWith('/api/')?res.status(404).json({error:'API endpoint not found.'}):res.status(404).send('Not found'));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Internal server error.'});});
(async()=>{try{await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/startraveler');console.log('MongoDB connected');}catch(err){console.error('MongoDB connection failed:',err.message);console.error('API server will not start without MongoDB. Check MONGO_URI and database availability.');process.exit(1);}app.listen(PORT,()=>console.log(`ChronoSky server running at http://localhost:${PORT}`));})();
