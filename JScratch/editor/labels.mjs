// Presentation only: API names, argument keys and authored values stay intact.
const words=text=>text.replace(/\bvariable\b/gi,'var').replace(/\bvalue2\b/gi,'val2').replace(/\bvalue\b/gi,'val');
const readable=text=>text.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('_',' ').toLowerCase().replace(/^ui /,'UI ');
const titles={whenStart:'on start',whenBroadcast:'on broadcast',whenClone:'on clone',makeVar:'create var',setVar:'set var',changeVarBy:'change var',goFront:'bring to front',goBack:'send to back',spriteCostume:'set costume',ifBlock:'if',whileBlock:'while',withoutScreenRefresh:'no refresh'};
const parameters={spriteName:'sprite',varName:'var',value:'val',value2:'val2',val:'val',a:'val',b:'val2',width:'width',height:'height',radius:'radius',background:'bg',foreground:'fg',property:'prop',rotation:'angle',offsetX:'dx',offsetY:'dy',horizontal:'X side',vertical:'Y side',start_range:'from',end_range:'to',color_hex:'color',num:'n'};
export function blockTitle(definition){return words(definition.label??titles[definition.name]??readable(definition.name));}
export function argumentLabel(definition,index){
    const param=definition.params[index];
    if(param?.label!==undefined)return words(param.label);
    const name=param?.name;
    if(index===0&&['name','id','message','condition'].includes(name))return '';
    if(name==='value'&&['setVar','setSpriteVar'].includes(definition.name))return 'to';
    if(name==='value'&&definition.name.startsWith('change'))return 'by';
    return parameters[name]??(name?words(readable(name)):(index===0?'val':'val'+(index+1)));
}
