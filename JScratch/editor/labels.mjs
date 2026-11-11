// Presentation only: API names, argument keys and authored values stay intact.
const words=text=>text.replace(/\bvariable\b/gi,'var').replace(/\bvalue2\b/gi,'val2').replace(/\bvalue\b/gi,'val');
const readable=text=>text.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('_',' ').toLowerCase().replace(/^ui /,'UI ');
export const infixSymbols={add:'+',sub:'-',mult:'*',div:'/',mod:'mod',equal:'=',gThan:'>',lThan:'<',gEqThan:'≥',lEqThan:'≤',and:'and',or:'or',contain:'is in'};
const titles={whenStart:'when game starts',whenBroadcast:'when I receive',whenClone:'when I start as a clone',makeVar:'create var',setVar:'set var',changeVarBy:'change var',goFront:'bring to front',goBack:'send to back',spriteCostume:'set costume',ifBlock:'if',whileBlock:'while',withoutScreenRefresh:'no refresh',broadcastAndWait:'broadcast and wait',randomNum:'pick random',length:'length of',contain:'contains?',touchingMouse:'touching mouse-pointer?',touchingSprite:'touching sprite?',keyPressed:'key pressed?',getLoggedIn:'logged in?',isMobile:'on mobile?',isClone:'is clone?',moveTo:'go to',spriteDirection:'direction of',sizeOfSprite:'size of',costumeOfSprite:'costume of'};
const parameters={spriteName:'sprite',varName:'var',value:'val',value2:'val2',val:'val',a:'val',b:'val2',width:'width',height:'height',radius:'radius',background:'bg',foreground:'fg',property:'prop',rotation:'angle',offsetX:'dx',offsetY:'dy',horizontal:'X side',vertical:'Y side',start_range:'from',end_range:'to',color_hex:'color',num:'n'};
export function blockTitle(definition){return infixSymbols[definition.name]?'val '+infixSymbols[definition.name]+' val2':words(definition.label??titles[definition.name]??readable(definition.name));}
export function blockPrefix(definition){return infixSymbols[definition.name]?'':blockTitle(definition);}
export function argumentLabel(definition,index){
    if(infixSymbols[definition.name])return index===1?infixSymbols[definition.name]:'';
    if(definition.name==='join')return '';
    if(['not','round','abs','sin','cos','length'].includes(definition.name)&&index===0)return '';
    if(definition.name==='randomNum')return index===1?'to':'';
    const param=definition.params[index];
    if(param?.label!==undefined)return words(param.label);
    const name=param?.name;
    if(index===0&&['name','id','message','condition'].includes(name))return '';
    if(name==='value'&&['setVar','setSpriteVar'].includes(definition.name))return 'to';
    if(name==='value'&&definition.name.startsWith('change'))return 'by';
    return parameters[name]??(name?words(readable(name)):(index===0?'val':'val'+(index+1)));
}

const aliases={add:'add plus +',sub:'subtract minus -',mult:'multiply times * ×',div:'divide / ÷',gThan:'greater than >',lThan:'less than <',gEqThan:'greater than or equal >= ≥',lEqThan:'less than or equal <= ≤',equal:'equals =',contain:'contains text is in'};
export const blockSearchText=definition=>`${definition.name} ${blockTitle(definition)} ${aliases[definition.name]??''} ${definition.category}`;
