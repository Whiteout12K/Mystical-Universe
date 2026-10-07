/* DOM-independent project validation and JavaScript generation. */
(() => {
  'use strict';
  const format=(value,type)=>{const v=String(value??'');if(type==='number'&&v.trim()!==''&&Number.isFinite(Number(v)))return String(Number(v));if(v==='true'||v==='false'||/^-?\d+(\.\d+)?$/.test(v))return v;return JSON.stringify(v);};
  function validate(project,definitions){
    if(project?.format!=='jscratch'||project.version!==1||!Array.isArray(project.scripts)||!project.scripts.length)throw Error('Not a supported JScratch project.');
    const pending=[];for(const script of project.scripts){if(typeof script.name!=='string'||!Array.isArray(script.blocks))throw Error('Invalid script structure.');pending.push(...script.blocks.map(block=>({block,depth:0})));}
    let count=0;while(pending.length){const {block,depth}=pending.pop();if(++count>200000||depth>300)throw Error('Project exceeds supported block count or nesting depth.');if(!block||!definitions.has(block.type)||!Array.isArray(block.slots)||typeof block.stacks!=='object'||!block.stacks)throw Error('Unknown or malformed block: '+block?.type);for(const slot of block.slots){if(slot?.block)pending.push({block:slot.block,depth:depth+1});else if(!slot||!['string','number','boolean'].includes(typeof slot.value))throw Error('Invalid block input.');}for(const stack of Object.values(block.stacks)){if(!Array.isArray(stack))throw Error('Invalid nested stack.');for(const child of stack)pending.push({block:child,depth:depth+1});}}
    return count;
  }
  function generate(scripts,definitions,zeroFields,options={}){
    let id=0;const locations=new Map();
    function blockCode(block,level,scriptIndex,path,expression=false){
      const def=definitions.get(block.type);if(!def)throw Error('Unknown block: '+block.type);
      const fn=def[2],indent=expression?'':'    '.repeat(level),args=zeroFields.has(block.type)?[]:(block.slots||[]).map((slot,i)=>slot.block?blockCode(slot.block,0,scriptIndex,path+'.slot'+i,true):format(slot.value,slot.type));
      const children=(name)=>((block.stacks||{})[name]||[]).map((child,i)=>blockCode(child,level+1,scriptIndex,path+'.'+name+i)).join(',\n');
      const main=children('main');let code;
      if(fn==='ifBlock'){const other=children('else');code=fn+'('+(args[0]||'false')+(main?',\n'+main:'')+(other?',\n'+indent+'    "else",\n'+other:'')+')';}
      else code=fn+'('+args.join(', ')+(main?(args.length?',':'')+'\n'+main+'\n'+indent:'')+')';
      if(options.debug){const sourceId=++id;locations.set(sourceId,{scriptIndex,path,type:block.type});code='__jscratchTag('+sourceId+', '+code+')';}
      return indent+code;
    }
    const code='// Start of Code Blocks.\n'+scripts.map((script,i)=>'\n// '+script.name.replace(/[\r\n]/g,' ')+'\n'+script.blocks.map((block,j)=>blockCode(block,0,i,String(j))+';').join('\n')).join('\n')+'\n';
    return {code,locations};
  }
  window.JScratchProject={validate,generate,format};
})();
