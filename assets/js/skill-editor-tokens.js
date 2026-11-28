const escapePattern=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const tokenCase=(word,key)=>/^[A-Z]/.test(word)?key[0].toUpperCase()+key.slice(1):key;
// Text only: callers walk HTML text nodes so attributes and CSS classes stay intact.
export function tokenizeCharacterText(text,character={}){
 const names=[...new Set([character.name,character.nickname].filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()))].sort((a,b)=>b.length-a.length);
 const namesPattern=names.length?new RegExp('(?<![\\p{L}\\p{N}_])(?:'+names.map(escapePattern).join('|')+')(?![\\p{L}\\p{N}_])','giu'):null;
 return String(text).split(/(\{\{[^}]*\}\}|\[[^\]]*\]|https?:\/\/\S+)/g).map(part=>{
  if(/^(?:\{\{|\[|https?:\/\/)/.test(part))return part;
  if(namesPattern)part=part.replace(namesPattern,'{{nickname}}');
  return part.split(/(\{\{[^}]*\}\})/g).map(segment=>{
   if(segment.startsWith('{{'))return segment;
   return segment.replace(/\b(he|she|himself|herself|him|hers|his|her)(?:([’'])(s|ll|re))?\b/gi,(word,pronoun,apostrophe,ending,offset,source)=>{
    const lower=pronoun.toLowerCase();let key;
    if(lower==='he'||lower==='she')key='subject';
    else if(lower==='him')key='object';
    else if(lower==='himself'||lower==='herself')key='reflexive';
    else if(lower==='hers')key='possessive_pronoun';
    else{
     const next=source.slice(offset+word.length).trimStart();
     const possessive=/^(?:\{\{|\[|own\b|[a-z][a-z’-]*\b)/i.test(next)&&! /^(?:a|an|the|another|and|or|but|who|whom|which|that|is|was|has|had|will|would|can|could|does|did|to|for|with|from|on|in|as|than)\b/i.test(next);
     const indirectObject=lower==='her'&&/\b(?:give|gives|gave|grant|grants|offer|offers|send|sends)\s+$/i.test(source.slice(0,offset));
     key=possessive&&!indirectObject?'possessive':lower==='his'?'possessive_pronoun':'object';
    }
    return '{{'+tokenCase(pronoun,key)+'}}'+(ending?({s:' is',ll:' will',re:' are'}[ending.toLowerCase()]||''):'');
   });
  }).join('');
 }).join('');
}
export const editableTokenPattern=/\{\{((?:nickname|subject|object|possessive_pronoun|possessive|reflexive)(?::c\d+[a-z]?(?::\d+)?)?)\}\}/gi;

export function tokenDisplayText(token,roster,currentId,variantIndex=0){
 const [kind,id,index]=String(token).split(':');
 const entry=roster[id||currentId]||{};
 const person=(id?(index===undefined?null:entry.skill_variants?.[Number(index)]):entry.skill_variants?.[Number(variantIndex)])||entry;
 if(kind==='nickname')return person!==entry?(person.nickname||person.name?.split(' ')[0]||entry.nickname||entry.name||'Character'):(entry.nickname||entry.name||'Character');
 const gender=String(person.gender||'neutral').toLowerCase();
 const forms=gender==='male'?{subject:'he',object:'him',possessive:'his',possessive_pronoun:'his',reflexive:'himself'}:gender==='female'?{subject:'she',object:'her',possessive:'her',possessive_pronoun:'hers',reflexive:'herself'}:{subject:'they',object:'them',possessive:'their',possessive_pronoun:'theirs',reflexive:'themself'};
 const word=forms[kind.toLowerCase()];
 return word?kind[0]===kind[0].toUpperCase()?word[0].toUpperCase()+word.slice(1):word:'{{'+token+'}}';
}
