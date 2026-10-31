// Shared by wiki profiles, the map, and the local Relations Edit page.
export const characterKey=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/^fandom:/,'').replace(/\.html?$/,'').split('/').pop().replace(/[^\p{L}\p{N}]/gu,'');
export function validateRelations(data){
 if(data?.version!==1||!Array.isArray(data.characters))throw Error('This is not a supported relations file.');
 const ids=new Set(),names=new Set(),paths=new Set();
 for(const entry of data.characters){
  if(!entry||typeof entry.id!=='string'||! /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(entry.id)||typeof entry.name!=='string'||!characterKey(entry.name)||typeof entry.relatives!=='string'||typeof entry.path!=='string'||entry.path&&!/^\/wiki\/char\/[a-z0-9_]+(?:\.html)?$/.test(entry.path))throw Error('Each character needs a unique name, valid ID, and relationship text.');
  if(entry.affiliations!==undefined&&typeof entry.affiliations!=='string')throw Error('Character affiliations must be text.');
  const name=characterKey(entry.name),path=entry.path.replace(/\.html$/,'');
  if(ids.has(entry.id)||names.has(name)||path&&paths.has(path))throw Error('Character names and wiki pages must be unique.');
  ids.add(entry.id);names.add(name);if(path)paths.add(path);
 }
 return data;
}
export function createRelationsStore(data){
 validateRelations(data);
 const characters=data.characters;
 function find(path,name=''){
  const normalized=String(path||'').replace(/\.html$/,'').replace(/\/$/,'');
  return characters.find(entry=>entry.path&&entry.path.replace(/\.html$/,'')===normalized)||characters.find(entry=>characterKey(entry.name)===characterKey(name)||characterKey(entry.id)===characterKey(path));
 }
 function mapProfiles(published,parseAffiliations=text=>text.split('\n').map(value=>value.trim()).filter(Boolean)){
  const profiles=published.map(profile=>{const entry=find(profile.path,profile.title);return entry&&entry.affiliations!==undefined?{...profile,affiliations:parseAffiliations(entry.affiliations)}:profile;});
  for(const entry of characters){
   if(profiles.some(profile=>find(profile.path,profile.title)===entry))continue;
   profiles.push({title:entry.name,path:'',image:'',portrait:'',affiliations:parseAffiliations(entry.affiliations||''),relations:relationLines(entry.relatives),unpublished:true,aliases:[entry.id]});
  }
  return profiles;
 }
 return {characters,find,mapProfiles};
}
export function relationLines(text){return text.split('\n').filter(line=>line.trim()).map(line=>'Relatives: '+line).join('\n');}
export const serializeRelations=data=>JSON.stringify(data,null,2)+'\n';
export async function writeRelationsFile(handle,data,baseline){
 validateRelations(data);
 const latest=validateRelations(JSON.parse(await (await handle.getFile()).text()));
 if(serializeRelations(latest)!==baseline)throw Error('Relations changed outside this editor. Reload to load the new file; your draft has been kept.');
 const content=serializeRelations(data),writer=await handle.createWritable();
 try{await writer.write(content);await writer.close();}catch(error){await writer.abort().catch(()=>{});throw error;}
 return content;
}

export function parseRelationsSource(source){return validateRelations(JSON.parse(source));}

// Each relationship/affiliation line starts with its subject, followed by optional
// role notes. Existing wiki links and other markup remain author-controlled.
export function autoLinkRelations(data){
 validateRelations(data);
 function lineLink(line,route){
  const spoiler=line.match(/^(\s*)\{\{Spoiler\|/i);
  if(spoiler){
   let depth=1,end=spoiler[0].length;
   for(;end<line.length&&depth;end++){
    if(line.slice(end,end+2)==='{{'){depth++;end++;}
    else if(line.slice(end,end+2)==='}}'){depth--;if(depth)end++;else break;}
   }
   if(depth)return line; // Leave incomplete markup for the author to correct.
   return spoiler[0]+lineLink(line.slice(spoiler[0].length,end),route)+line.slice(end);
  }
  const match=line.match(/^(\s*(?:[-*]\s+)?)([^\[\]{}()<>\n]+?)(\s*)(?=\(|\[|\{|$)/);
  if(!match)return line;
  const name=match[2].trim();
  if(!/[\p{L}\p{N}]/u.test(name)||/https?:|www\.|\|/i.test(name))return line;
  const slug=name.normalize('NFKC').toLowerCase().replace(/\s+/g,'_');
  return match[1]+'[['+route+'/'+slug+'|'+name+']]'+match[3]+line.slice(match[0].length);
 }
 return {...data,characters:data.characters.map(entry=>({...entry,
  relatives:entry.relatives.split('\n').map(line=>lineLink(line,'char')).join('\n'),
  ...(entry.affiliations===undefined?{}:{affiliations:entry.affiliations.split('\n').map(line=>lineLink(line,'location')).join('\n')})
 }))};
}
