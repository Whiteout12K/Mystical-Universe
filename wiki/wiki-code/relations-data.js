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
