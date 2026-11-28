// Recognize authored keys, conventional dmg keys, and explicit percent placeholders.
// Effect labels such as [Shield] and [Freeze] remain ordinary bracketed terms.
export function dynamicValueParts(text,values={}){
 const parts=[];let last=0;
 for(const match of String(text).matchAll(/\[([A-Za-z][A-Za-z0-9_]*)(%)?\]/g)){
  const key=match[1],percent=Boolean(match[2]);
  if(!Object.hasOwn(values,key)&&!/^dmg\d+(?:_[a-z0-9_]+)?$/.test(key)&&!(percent&&/^[a-z][a-z0-9_]*$/.test(key)))continue;
  if(match.index>last)parts.push({text:text.slice(last,match.index)});
  parts.push({key,percent});last=match.index+match[0].length;
 }
 if(last<String(text).length)parts.push({text:String(text).slice(last)});
 return parts;
}
