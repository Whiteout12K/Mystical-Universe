// Presentation only: API names, argument keys and authored values stay intact.
const words=text=>text.replace(/\bvariable\b/gi,'var').replace(/\bvalue2\b/gi,'v2').replace(/\bvalue\b/gi,'v1');
const readable=text=>text.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replaceAll('_',' ').toLowerCase().replace(/^ui /,'UI ');
const titles={whenStart:'on start',whenBroadcast:'on broadcast',whenClone:'on clone',makeVar:'create var',setVar:'set var',changeVarBy:'change var',goFront:'bring to front',goBack:'send to back',spriteCostume:'set costume',ifBlock:'if',whileBlock:'while',withoutScreenRefresh:'no refresh'};
const parameters={spriteName:'sprite',varName:'var',value:'v1',value2:'v2',val:'v1',a:'v1',b:'v2',width:'w',height:'h',radius:'r',background:'bg',foreground:'fg',property:'prop',rotation:'angle',offsetX:'dx',offsetY:'dy',horizontal:'X side',vertical:'Y side',start_range:'from',end_range:'to',color_hex:'color',num:'n'};
export function blockTitle(definition){return words(definition.label??titles[definition.name]??readable(definition.name));}
export function argumentLabel(definition,index){
    const param=definition.params[index];
    if(param?.label!==undefined)return words(param.label);
    const name=param?.name;
    if(index===0&&['name','id','message','condition'].includes(name))return '';
    if(name==='value'&&['setVar','setSpriteVar'].includes(definition.name))return 'to';
    if(name==='value'&&definition.name.startsWith('change'))return 'by';
    return parameters[name]??(name?words(readable(name)):'v'+(index+1));
}
