const STAT_ORDER=[
 "health","attack","defense","mana","mana_regen","stamina","stamina_regen",
 "crit_rate","crit_dmg","speed","piercing","healing_rate","luck",
 "gauge_gain","cooldown_red"
];

let characterDatabase={},weaponDatabase={},accessoryDatabase={},artifactDatabase={};

export async function loadJSON(path){
 try{
  const r=await fetch(path,{cache:"no-cache"});
  if(!r.ok)throw Error(`HTTP ${r.status}`);
  return await r.json();
 }catch(e){
  console.error(path,e);
  return{};
 }
}

function normalizeKey(v){
 return String(v||"").toLowerCase().trim().replace(/\s+/g,"_").replace(/-/g,"_");
}

function getCharacterInfo(id){
 const key=`c${id}`;
 const c=characterDatabase?.characters;
 if(characterDatabase?.[key])return characterDatabase[key];
 if(c?.[key])return c[key];
 if(Array.isArray(c))return c[id-1]||{};
 return{};
}

function getDatabaseItem(db,id,prefix){
 const key=`${prefix}${id}`;
 if(db?.[key])return db[key];
 if(db?.items?.[key])return db.items[key];
 if(Array.isArray(db))return db.find(x=>Number(x?.id??x?.artifact_id)===Number(id))||{};
 return{};
}

function num(v,f=0){
 const n=Number(v);
 return Number.isFinite(n)?n:f;
}

function getCharacterLevel(p){
 for(const v of[p?.level,p?.lv,p?.character_level,p?.char_level]){
  const n=Number(v);
  if(Number.isFinite(n)&&n>0)return Math.floor(n);
 }
 return 1;
}

function calculateCharacterStats(info,level){
 const base=info?.base_stats||{};
 const f=info?.stat_change_by_level||{};
 const main=Array.isArray(f.main_stat)?f.main_stat:[];
 const unique=typeof f.unique_stat==="string"?f.unique_stat:null;
 const mainWeight=num(f.main_stat_weight);
 const uniqueWeight=num(f.unique_stat_weight);

 return Object.entries(base).reduce((r,[key,val])=>{
  const n=Number(val);
  if(!Number.isFinite(n))return r;

  const weight=main.includes(key)?mainWeight:unique===key?uniqueWeight:0;

  r.push({
   key,
   base:n,
   current:level>1?n+n*weight*(level-1):n
  });

  return r;
 },[]);
}

function getEquipmentArray(v){
 if(Array.isArray(v))return v[0]||null;
 return v&&typeof v==="object"?v:null;
}

function getCharacterEquipment(p){
 const e=p?.equip||p?.equipment||p?.equipped||{};

 return{
  weapon:getEquipmentArray(e.weapon),
  accessory:getEquipmentArray(e.accessory),
  artifacts:[
   getEquipmentArray(e.artifact1),
   getEquipmentArray(e.artifact2),
   getEquipmentArray(e.artifact3),
   getEquipmentArray(e.artifact4)
  ].filter(Boolean)
 };
}

function getEquipmentStatEntries(info,level){
 const r=[];
 if(!info)return r;

 const f=info?.stat_change_by_level||{};
 const weight=num(f.main_stat_weight);

 for(let i=1;i<=2;i++){
  const name=f[`main_${i}`];
  const base=Number(f[`main_${i}_value`]);

  if(!name||!Number.isFinite(base))continue;

  r.push({
   name,
   value:level>1?base+base*weight*(level-1):base,
   type:f[`main_${i}_type`]||"+"
  });
 }

 return r;
}

function getArtifactStatEntries(info,p,level){
 const r=[];
 if(!info&&!p)return r;

 const f=info?.stat_change_by_level||{};
 const mainName=p?.main??f.main;
 const mainBase=Number(p?.main_value??f.main_value);
 const mainType=p?.main_type??f.main_type??"";
 const weight=num(f.main_stat_weight);

 if(mainName&&Number.isFinite(mainBase)){
  r.push({
   name:mainName,
   value:level>1?mainBase+mainBase*weight*(level-1):mainBase,
   type:mainType,
   source:"artifact"
  });
 }

 for(let i=1;i<=4;i++){
  const name=p?.[`sub_${i}`];
  const base=Number(p?.[`sub_${i}_value`]);

  if(!name||!Number.isFinite(base))continue;

  const rolls=Math.min(5,Math.max(0,num(p?.[`sub_${i}_rolls`])));

  r.push({
   name,
   value:base*(rolls+1),
   type:p?.[`sub_${i}_type`]||"+",
   source:"artifact"
  });
 }

 return r;
}

function isPercentStat(type,name){
 const key=normalizeKey(name);

 if(key==="gauge_gain"||key==="cooldown_red")return false;
 if(String(type||"").trim()==="%")return true;
 if(String(type||"").trim()==="+")return false;

 return["crit_rate","crit_dmg","healing_rate"].includes(key);
}

function isDirectAdditionalStat(name){
 const key=normalizeKey(name);
 return key==="gauge_gain"||key==="cooldown_red";
}

function collectEquipmentStats(equipment){
 const additive={};
 const artifactAdditive={};
 const artifactPercent={};

 const add=(map,name,value)=>{
  const key=normalizeKey(name);
  const n=Number(value);

  if(!key||!Number.isFinite(n))return;

  map[key]=(map[key]||0)+n;
 };

 for(const type of["weapon","accessory"]){
  const item=equipment[type];
  if(!item)continue;

  const db=type==="weapon"?weaponDatabase:accessoryDatabase;
  const prefix=type==="weapon"?"w":"a";
  const info=getDatabaseItem(db,item.id,prefix);
  const level=num(item.level,info?.level||1);

  for(const stat of getEquipmentStatEntries(info,level)){
   add(additive,stat.name,stat.value);
  }
 }

 for(const item of equipment.artifacts||[]){
  const info=getDatabaseItem(artifactDatabase,item.id,"o");
  const level=num(item.level,info?.level||1);

  for(const stat of getArtifactStatEntries(info,item,level)){
   if(isDirectAdditionalStat(stat.name)){
    add(artifactAdditive,stat.name,stat.value);
   }else if(isPercentStat(stat.type,stat.name)){
    add(artifactPercent,stat.name,stat.value);
   }else{
    add(artifactAdditive,stat.name,stat.value);
   }
  }
 }

 return{additive,artifactAdditive,artifactPercent};
}

function calculateFinalStats(baseStats,equipment){
 const eq=collectEquipmentStats(equipment);

 const base={};
 const mainEquipment={};
 const artifact={};
 const total={};

 const keys=new Set([
  ...Object.keys(baseStats),
  ...Object.keys(eq.additive),
  ...Object.keys(eq.artifactAdditive),
  ...Object.keys(eq.artifactPercent),
  "gauge_gain",
  "cooldown_red"
 ]);

 for(const key of keys){
  const b=num(baseStats[key]);
  const e=num(eq.additive[key]);
  const a=num(eq.artifactAdditive[key]);
  const p=num(eq.artifactPercent[key]);

  const additive=b+e+a;
  const final=additive*(1+p/100);

  base[key]=b;
  mainEquipment[key]=e;
  artifact[key]=a+(additive*(p/100));
  total[key]=final;
 }

 return{
  base,
  mainEquipment,
  artifact,
  total
 };
}

function cleanStats(stats){
 const result={};

 for(const key of STAT_ORDER){
  if(Object.prototype.hasOwnProperty.call(stats,key)){
   const value=Number(stats[key]);

   if(Number.isFinite(value)){
    result[key]=Number.isInteger(value)
     ?value
     :Number(value.toFixed(10));
   }
  }
 }

 for(const key of Object.keys(stats)){
  if(Object.prototype.hasOwnProperty.call(result,key))continue;

  const value=Number(stats[key]);

  if(Number.isFinite(value)){
   result[key]=Number.isInteger(value)
    ?value
    :Number(value.toFixed(10));
  }
 }

 return result;
}

/* ============================================================
   PUBLIC CHARACTER STAT API
   ============================================================ */

export async function getCharacterStats(username,characterKey="c1",view="total"){
 username=String(username||"").trim();
 characterKey=String(characterKey||"c1").trim().toLowerCase();
 view=String(view||"total").trim().toLowerCase();

 if(!username)throw Error("No username.");
 if(!/^c\d+$/i.test(characterKey))throw Error("Invalid character.");

 const characterId=Number(characterKey.slice(1));

 const[
  characterDB,
  weaponDB,
  accessoryDB,
  artifactDB
 ]=await Promise.all([
  loadJSON("/images/mlg-assets/data-character.json"),
  loadJSON("/images/mlg-assets/data-weapon.json"),
  loadJSON("/images/mlg-assets/data-accessory.json"),
  loadJSON("/images/mlg-assets/data-artifact.json")
 ]);

 characterDatabase=characterDB;
 weaponDatabase=weaponDB;
 accessoryDatabase=accessoryDB;
 artifactDatabase=artifactDB;

 const response=await fetch(
  `/api/user/${encodeURIComponent(username)}`,
  {cache:"no-cache"}
 );

 if(!response.ok)throw Error("Player Not Found.");

 const result=await response.json();

 const data=result?.data&&typeof result.data==="object"
  ?result.data
  :{};

 const p=data[characterKey];

 if(!p)throw Error(`The player does not have ${characterKey}.`);

 const info=getCharacterInfo(characterId);
 const level=getCharacterLevel(p);

 const baseStats=calculateCharacterStats(info,level);
 const equipment=getCharacterEquipment(p);

 const baseMap={};

 baseStats.forEach(s=>{
  baseMap[normalizeKey(s.key)]=s.current;
 });

 const calculated=calculateFinalStats(baseMap,equipment);

 const safeView=[
  "base",
  "equipment",
  "artifact",
  "total"
 ].includes(view)
  ?view
  :"total";

 const source=safeView==="equipment"
  ?calculated.mainEquipment
  :calculated[safeView];

 return{
  username:result?.username||username,
  character:{
   id:characterKey,
   character_id:String(
    info?.character_id??
    p?.character_id??
    characterKey.replace(/^c/i,"")
   ),
   name:info?.name||p?.name||characterKey,
   level,
   rarity:p?.rarity??info?.rarity??null,
   view:safeView,
   stats:cleanStats(source)
  }
 };
}

/* ============================================================
   NORMAL HTML VIEW
   ============================================================ */

function statName(name){
 const names={
  health:"Health",
  attack:"Attack",
  defense:"Defense",
  mana:"Mana",
  mana_regen:"Mana Regen (MP/s)",
  stamina:"Stamina",
  stamina_regen:"Stamina Regen (p/s)",
  crit_rate:"Crit Rate",
  crit_dmg:"Crit DMG",
  speed:"Speed",
  piercing:"Piercing",
  healing_rate:"Healing Rate",
  luck:"Luck",
  gauge_gain:"EG Gain",
  cooldown_red:"CD Red"
 };

 const key=normalizeKey(name);

 return names[key]||String(name)
  .replaceAll("_"," ")
  .replace(/\b\w/g,c=>c.toUpperCase());
}

function isPercentDisplay(name){
 return[
  "crit_rate",
  "crit_dmg",
  "healing_rate",
  "gauge_gain",
  "cooldown_red"
 ].includes(normalizeKey(name));
}

function formatNumber(v){
 const n=Number(v);

 if(!Number.isFinite(n))return"0";
 if(Number.isInteger(n))return n.toLocaleString();

 return n.toLocaleString(undefined,{maximumFractionDigits:2});
}

function formatStat(name,v){
 return`${formatNumber(v)}${isPercentDisplay(name)?"%":""}`;
}

function escapeHTML(v){
 return String(v??"")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");
}

function createTotalStatRow(key,calculated){
 const base=num(calculated.base[key]);
 const equipment=num(calculated.mainEquipment[key]);
 const artifact=num(calculated.artifact[key]);
 const total=num(calculated.total[key]);

 return`
 <div class="stat">
  <span class="stat-name">${escapeHTML(statName(key))}</span>
  <span class="stat-values">
   <span class="stat-total">${escapeHTML(formatStat(key,total))}</span>
   ${equipment?`<span class="stat-equipment">+${escapeHTML(formatStat(key,equipment))}</span>`:""}
   ${artifact?`<span class="stat-artifact">+${escapeHTML(formatStat(key,artifact))}</span>`:""}
   <span class="stat-base">(${escapeHTML(formatStat(key,base))})</span>
  </span>
 </div>`;
}

export async function renderCharacterStats(username,characterKey="c1"){
 const output=await getCharacterStats(username,characterKey,"total");

 const characterId=Number(characterKey.slice(1));
 const p={};

 const info=getCharacterInfo(characterId);

 /*
  Recalculate the detailed values for the visual page.
 */

 const dataResponse=await fetch(
  `/api/user/${encodeURIComponent(username)}`,
  {cache:"no-cache"}
 );

 const result=await dataResponse.json();
 const data=result?.data||{};
 const playerCharacter=data[characterKey];

 const level=getCharacterLevel(playerCharacter);
 const baseStats=calculateCharacterStats(info,level);
 const equipment=getCharacterEquipment(playerCharacter);
 const baseMap={};

 baseStats.forEach(s=>{
  baseMap[normalizeKey(s.key)]=s.current;
 });

 const calculated=calculateFinalStats(baseMap,equipment);

 const keys=Object.keys(calculated.total).sort((a,b)=>{
  const ai=STAT_ORDER.indexOf(a);
  const bi=STAT_ORDER.indexOf(b);

  if(ai<0&&bi<0)return a.localeCompare(b);
  if(ai<0)return 1;
  if(bi<0)return-1;

  return ai-bi;
 });

 document.getElementById("app").innerHTML=`
 <main class="stats-page">
  <header class="header">
   <div>
    <h1 class="title">${escapeHTML(output.character.name)}</h1>
    <p class="subtitle">${escapeHTML(characterKey.toUpperCase())}</p>
   </div>
   <div class="level">LEVEL ${output.character.level}</div>
  </header>

  <section class="panel">
   <div class="panel-title">Total Stats</div>

   <div class="legend">
    <span>Total</span>
    <span>Main Equipment</span>
    <span>Artifact</span>
    <span>Base</span>
   </div>

   <div class="stats">
    ${keys.map(key=>createTotalStatRow(key,calculated)).join("")}
   </div>
  </section>
 </main>`;

 return output;
}

/* ============================================================
   DIRECT SCRIPT MODE
   c-stat.js?username=Avery&c=c1&api=true
   ============================================================ */

export async function run(){
 const params=new URLSearchParams(location.search);
 const username=params.get("username")?.trim()||"";
 const character=params.get("c")?.trim().toLowerCase()||"c1";
 const view=params.get("view")?.trim().toLowerCase()||"total";
 const api=params.get("api")==="true";

 try{
  if(api){
   const output=await getCharacterStats(username,character,view);

   document.open();
   document.write(JSON.stringify(output,null,2));
   document.close();

   return output;
  }

  return await renderCharacterStats(username,character);
 }catch(e){
  console.error(e);

  const output={
   error:"Character Stats Error",
   message:e?.message||"Could not calculate character stats."
  };

  if(api){
   document.open();
   document.write(JSON.stringify(output,null,2));
   document.close();
  }else if(document.getElementById("app")){
   document.getElementById("app").innerHTML=`
   <div class="stats-page">
    <div class="error">
     <h2>${escapeHTML(output.error)}</h2>
     <p>${escapeHTML(output.message)}</p>
    </div>
   </div>`;
  }

  return output;
}}