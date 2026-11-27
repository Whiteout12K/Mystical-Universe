export const CHARACTER_BUILD_DEFAULTS_VERSION=1;
export function emptyCharacterBuild(stars=0){return {loadout:{basic:['B1'],special:['',''],ultimate:[''],technical:['']},gear:{weapon:'',accessory:'',artifacts:['','','',''],artifactRarity:'SSR'},stars:Number.isInteger(stars)?Math.min(16,Math.max(0,stars)):0};}
export function ownsCharacter(data,id){return Number(data?.c_owned?.[Number(String(id).slice(1))-1])>0;}
export function ownedCharacterStarLevel(data,id){
 if(!ownsCharacter(data,id))return 0;
 const value=Number(data[id]?.star_level);
 return Number.isFinite(value)?Math.min(16,Math.max(0,Math.trunc(value))):0;
}
// One-time reset of equipped selections. Keep owned skills and return equipment to inventory.
export function initializeOwnedCharacterBuilds(input){
 if(input?.character_build_defaults_version>=CHARACTER_BUILD_DEFAULTS_VERSION)return input;
 const data=structuredClone(input||{});
 data.character_builds={...data.character_builds};
 data.c_equipped_skills=Array.isArray(data.c_equipped_skills)?data.c_equipped_skills:[];
 for(const [index,owned] of (data.c_owned||[]).entries()){
  if(!Number(owned))continue;
  const id='c'+(index+1),character=data[id]||{};
  data.character_builds[id]=emptyCharacterBuild(character.star_level||0);
  data.c_equipped_skills[index]=[1,0,0,0,0,0];
  if(character.equip){
   for(const [slot,value]of Object.entries(character.equip)){
    const inventory=slot.startsWith('artifact')?'inventory2':'inventory1';
    const items=Array.isArray(value)?value:value&&typeof value==='object'?[value]:[];
    if(!items.length)continue;
    data[inventory]=Array.isArray(data[inventory])?data[inventory]:[];
    for(const item of items)if(!data[inventory].some(owned=>JSON.stringify(owned)===JSON.stringify(item)))data[inventory].push(item);
   }
   character.equip={weapon:[],accessory:[],artifact1:[],artifact2:[],artifact3:[],artifact4:[]};
  }
 }
 data.character_build_defaults_version=CHARACTER_BUILD_DEFAULTS_VERSION;
 return data;
}
