/* Visual wiki editing. Unedited blocks keep their original source exactly. */
(() => {
  const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const safeURL=value=>{try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
  function templates(text){
    const result=[];let depth=0,start=0;
    for(let i=0;i<text.length-1;i++){const pair=text.slice(i,i+2);if(pair==='{{'){if(!depth)start=i;depth++;i++;}else if(pair==='}}'&&depth){depth--;i++;if(!depth)result.push({start,end:i+1,value:text.slice(start,i+1)});}}
    return result;
  }
  // Blank-line counts outside templates do not affect wiki rendering.
  function compactSource(text){
    text=text.replace(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi,(_,name)=>'[[Category:'+name.trim()+']]');
    const compact=value=>value.replace(/\[\[Category:[^\]]+\]\](?:\s*\[\[Category:[^\]]+\]\])*/gi,(group,offset,input)=>{
      const tags=group.match(/\[\[Category:[^\]]+\]\]/gi).join('\n');
      const before=offset>0&&input[offset-1]!=='\n'?'\n':'',end=offset+group.length;
      const after=end<input.length&&input[end]!=='\n'?'\n':'';
      return before+tags+after;
    }).replace(/\n(?:[ \t]*\n){2,}/g,'\n\n');
    let output='',offset=0;
    for(const token of templates(text)){
      output+=compact(text.slice(offset,token.start))+token.value;
      offset=token.end;
    }
    return output+compact(text.slice(offset));
  }
  function parts(value){
    const result=[];let start=2,depth=0,links=0;
    for(let i=2;i<value.length-2;i++){const pair=value.slice(i,i+2);if(pair==='{{'){depth++;i++;}else if(pair==='}}'){depth--;i++;}else if(pair==='[['){links++;i++;}else if(pair===']]'){links--;i++;}else if(value[i]==='|'&&!depth&&!links){result.push({start,end:i,value:value.slice(start,i)});start=i+1;}}
    result.push({start,end:value.length-2,value:value.slice(start,-2)});return result;
  }
  function focusLine(line){
    (line.closest('.visual-editable')||line).focus();const range=document.createRange();range.selectNodeContents(line);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  }
  function continueAfter(node){
    const editor=node.closest('.visual-editable');if(!editor)return;
    const anchor=node.closest('p,h2,h3,h4,h5,h6,li')||node;
    const line=make('p','caret-line');line.dataset.caretLine='';line.append(make('br'));anchor.after(line);focusLine(line);
  }
  function exitButton(node,label){
    const button=make('button','inline-continue','↵');button.type='button';button.contentEditable='false';button.dataset.editorUi='';button.title=label;button.setAttribute('aria-label',label);
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();continueAfter(node);});return button;
  }
  function inline(parent,text,imageBase){
    const pattern=/\{\{|\[\[|\[https?:\/\/|'''|''|<br\s*\/?>/gi;let position=0,match;
    while((match=pattern.exec(text))){
      parent.append(document.createTextNode(text.slice(position,match.index)));let end=pattern.lastIndex,node;
      if(match[0]==='{{'){
        const template=templates(text.slice(match.index))[0];
        if(template?.start===0){end=match.index+template.end;const values=parts(template.value),name=values[0].value.trim().toLowerCase();
          if(name==='spoiler'){node=make('details','visual-spoiler');node.open=true;const label=make('summary','','Spoiler'),content=make('div');content.dataset.spoilerContent='';inline(content,values.slice(1).map(p=>p.value).join('|'),imageBase);const remove=make('button','inline-remove','×');remove.type='button';remove.contentEditable='false';remove.dataset.editorUi='';remove.setAttribute('aria-label','Remove inline spoiler');remove.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const editor=node.closest('.visual-editable');node.remove();editor?.dispatchEvent(new Event('input',{bubbles:true}));});label.append(exitButton(node,'Continue after spoiler'),remove);label.contentEditable='false';node.append(label,content);}
          else{node=make('span','visual-token',template.value);node.contentEditable='false';node.dataset.wikiToken=template.value;}
        }
      }else if(match[0]==='[['){
        const close=text.indexOf(']]',end);if(close!==-1){end=close+2;const token=text.slice(match.index,end),inside=token.slice(2,-2),pipe=inside.indexOf('|'),target=pipe<0?inside:inside.slice(0,pipe),label=pipe<0?target.replace(/^fandom:/,''):inside.slice(pipe+1);
          if(/^Category:/i.test(target)){
            const name=target.replace(/^Category:/i,'').trim();node=make('span','visual-category');node.contentEditable='false';node.dataset.wikiToken=token;node.dataset.wikiCategory=name;node.title='Double-click to edit category';node.append(make('span','',name));const remove=make('button','inline-remove','×');remove.type='button';remove.setAttribute('aria-label','Remove category '+name);remove.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const editor=node.closest('.visual-editable');node.remove();editor?.dispatchEvent(new Event('input',{bubbles:true}));});node.append(remove);
          }else if(/^File:/i.test(target)){node=make('span','visual-media');node.contentEditable='false';node.dataset.wikiToken=token;const img=make('img','visual-image'),fileInput=make('input'),captionInput=make('input'),remove=make('button','inline-remove','×');fileInput.value=target.slice(5);fileInput.setAttribute('aria-label','Image path');captionInput.value=pipe<0?'':label;captionInput.setAttribute('aria-label','Image caption');remove.type='button';remove.setAttribute('aria-label','Remove image');
            const paint=()=>{const file=fileInput.value;img.src=safeURL(/^(?:https?:|\/)/i.test(file)?file:imageBase+file);img.alt=captionInput.value;};paint();
            for(const field of [fileInput,captionInput])field.addEventListener('input',()=>{node.dataset.wikiToken='[[File:'+fileInput.value+(captionInput.value?'|'+captionInput.value:'')+']]';paint();node.closest('.visual-editable')?.dispatchEvent(new Event('input',{bubbles:true}));});
            remove.addEventListener('click',event=>{event.preventDefault();const editor=node.closest('.visual-editable');node.remove();editor?.dispatchEvent(new Event('input',{bubbles:true}));});node.append(img,fileInput,captionInput,exitButton(node,'Continue after image'),remove);for(const field of [fileInput,captionInput])field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();continueAfter(node);}});}
          else{node=make('a');node.dataset.wikiTarget=target;node.href=safeURL(/^(https?:|\/|#)/.test(target)?target:'/wiki/'+target.replace(/^fandom:/,'').toLowerCase().replace(/ /g,'_'));node.textContent=label;}
        }
      }else if(match[0].startsWith('[http')){
        const close=text.indexOf(']',end);if(close!==-1){end=close+1;const value=text.slice(match.index+1,close),space=value.indexOf(' ');node=make('a','',space<0?value:value.slice(space+1));node.dataset.external='';node.dataset.wikiTarget=space<0?value:value.slice(0,space);node.href=safeURL(node.dataset.wikiTarget);}
      }else if(match[0]==="'''"||match[0]==="''"){
        const close=text.indexOf(match[0],end);if(close!==-1){node=make(match[0].length===3?'strong':'em');inline(node,text.slice(end,close),imageBase);end=close+match[0].length;}
      }else node=make('br');
      if(!node){parent.append(document.createTextNode(match[0]));}else parent.append(node);
      position=end;pattern.lastIndex=end;
    }
    parent.append(document.createTextNode(text.slice(position)));
  }
  function serialize(node,options={}){
    if(!node)return '';
    if(node.nodeType===Node.TEXT_NODE)return node.textContent.replace(/\u200B/g,'');
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    if(node.dataset.editorUi!==undefined)return '';
    if(node.dataset.caretLine!==undefined&&!node.textContent.trim())return '';
    if(node.dataset.wikiToken!==undefined)return node.dataset.wikiToken;
    const tag=node.tagName,content=()=>{
      let output='',previousBlock=false;
      for(const child of node.childNodes){
        const value=serialize(child,options),block=child.nodeType===Node.ELEMENT_NODE&&['P','DIV'].includes(child.tagName);
        if(options.field&&(block||previousBlock)&&output&&value&&!output.endsWith('\n')&&!value.startsWith('\n'))output+='\n';
        output+=value;previousBlock=block;
      }
      return options.field?output:compactSource(output);
    };
    if(tag==='DETAILS')return '{{Spoiler|'+serialize(node.querySelector('[data-spoiler-content]'),{field:true}).trim().replace(/\n/g,'<br>')+'}}';
    if(tag==='SUMMARY')return '';
    if(tag==='BR')return options.field?'\n':'<br>';
    if(tag==='STRONG'||tag==='B')return "'''"+content()+"'''";
    if(tag==='EM'||tag==='I')return "''"+content()+"''";
    if(tag==='A'){const target=node.dataset.wikiTarget||node.getAttribute('href')||'';return node.dataset.external!==undefined?'['+target+' '+content()+']':'[['+target+'|'+content()+']]';}
    if(/^H[1-6]$/.test(tag)){const marker='='.repeat(Math.max(2,Number(tag[1])));return '\n'+marker+' '+content().trim()+' '+marker+'\n';}
    if(tag==='UL'||tag==='OL')return [...node.children].map(child=>serialize(child,options)).join('');
    if(tag==='LI'){
      const ancestors=[];let parent=node.parentElement;while(parent){if(parent.tagName==='UL'||parent.tagName==='OL')ancestors.unshift(parent.tagName==='UL'?'*':'#');parent=parent.parentElement;}
      let own='',nested='';for(const child of node.childNodes){if(['UL','OL'].includes(child.tagName))nested+=serialize(child,options);else own+=serialize(child,options);}
      return ancestors.join('')+' '+own.trim()+'\n'+nested;
    }
    if(tag==='P'||tag==='DIV')return options.field?content():'\n\n'+content()+'\n\n';
    return content();
  }
  function body(parent,text,imageBase){
    const lines=text.split('\n');let paragraph=[],listStack=[];
    const flush=()=>{if(paragraph.length){const p=make('p');inline(p,paragraph.join('\n'),imageBase);parent.append(p);paragraph=[];}};
    for(const line of lines){
      const heading=/^(={2,6})\s*(.*?)\s*\1\s*$/.exec(line),list=/^([*#]+)\s*(.*)$/.exec(line);
      if(!line.trim()){flush();listStack=[];continue;}
      if(heading){flush();listStack=[];const h=make('h'+heading[1].length);inline(h,heading[2],imageBase);parent.append(h);}
      else if(list){
        flush();const markers=list[1];let shared=0;while(shared<listStack.length&&shared<markers.length&&listStack[shared].marker===markers[shared])shared++;listStack=listStack.slice(0,shared);
        for(let depth=shared;depth<markers.length;depth++){const ul=make(markers[depth]==='*'?'ul':'ol');if(depth){let li=listStack[depth-1].node.lastElementChild;if(!li){li=make('li');listStack[depth-1].node.append(li);}li.append(ul);}else parent.append(ul);listStack.push({marker:markers[depth],node:ul});}
        const li=make('li');inline(li,list[2],imageBase);listStack.at(-1).node.append(li);
      }else{listStack=[];paragraph.push(line);}
    }flush();
  }
  function selectParagraph(root,offset){
    const container=[...root.querySelectorAll('[data-source-start]')].find(element=>Number(element.dataset.sourceStart)<=offset+2&&Number(element.dataset.insertAt)>=offset+2);
    const candidates=[...(container||root).querySelectorAll('p')].filter(node=>node.textContent==='New paragraph.');
    const paragraph=container&&Number(container.dataset.sourceStart)<offset-2?candidates.at(-1):candidates[0];
    if(!paragraph)return;
    (paragraph.closest('.visual-editable')||paragraph).focus();const range=document.createRange();range.selectNodeContents(paragraph);getSelection().removeAllRanges();getSelection().addRange(range);
  }
  function render(source,root,onChange){
    const panelStates=new Map(),panelCounts=new Map();
    for(const panel of root.querySelectorAll('details.visual-template')){const name=panel.dataset.blockName,index=panelCounts.get(name)||0;panelCounts.set(name,index+1);panelStates.set(name+':'+index,panel.open);}
    root.replaceChildren();const blocks=[],tabMenus=[];let position=0,imageBase='/images/character_art/';
    const imageSetting=/\|image base\s*=\s*([^\n|}]+)/i.exec(source);if(imageSetting)imageBase=imageSetting[1].trim().replace(/\/?$/,'/');
    const compose=()=>{let output='',offset=0;for(const block of blocks){output=compactSource(output+source.slice(offset,block.start));if(block.element){block.element.dataset.sourceStart=String(output.length);block.element.dataset.insertAt=String(compactSource(output+block.value).length);}output=compactSource(output+block.value);offset=block.end;}return compactSource(output+source.slice(offset));};
    const update=(structural=false)=>onChange(compactSource(compose()),{structural});
    function writeAfter(block){
      const current=compose(),offset=Number(block.element.dataset.insertAt);
      onChange(current.slice(0,offset)+'\n\nNew paragraph.\n\n'+current.slice(offset),{structural:true,render:true});
      selectParagraph(root,offset);
    }
    function button(label,title,action){const b=make('button','block-action',label);b.type='button';b.title=title;b.setAttribute('aria-label',title);b.contentEditable='false';b.dataset.editorUi='';b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();action();});return b;}
    function remove(block,element){block.value='';element.remove();update(true);}
    function editable(node,changed,label){node.contentEditable='true';node.spellcheck=true;node.classList.add('visual-editable');node.setAttribute('role','textbox');node.setAttribute('aria-label',label);node.setAttribute('aria-multiline','true');node.addEventListener('input',()=>{changed();update();});node.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing||event.ctrlKey||event.metaKey)return;
      const selection=getSelection();if(!selection?.rangeCount)return;
      const range=selection.getRangeAt(0),element=range.startContainer.nodeType===Node.ELEMENT_NODE?range.startContainer:range.startContainer.parentElement;
      if(!node.contains(element)||element.closest('[contenteditable="false"]'))return;
      // Article Return creates a paragraph; compact template fields keep single-line spacing.
      if(!event.shiftKey&&element.closest('li,h2,h3,h4,h5,h6'))return;
      event.preventDefault();
      if(!event.shiftKey&&label==='Article text'&&!element.closest('[data-spoiler-content]')){
        document.execCommand('defaultParagraphSeparator',false,'p');
        document.execCommand('insertParagraph',false);
      }else document.execCommand('insertLineBreak',false);

    });}
    function input(value,label,changed){const field=make('input');field.value=value;field.setAttribute('aria-label',label);field.addEventListener('input',()=>{changed(field.value);update();});field.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){const block=blocks.find(block=>block.element===field.closest('.visual-template,.visual-tab-marker'));if(block){event.preventDefault();writeAfter(block);}}});return field;}
    function title(section,label,block){section.dataset.blockName=label;const bar=make(section.tagName==='DETAILS'?'summary':'div','block-heading');bar.append(make('span','',label),button('↵','Write after '+label,()=>writeAfter(block)),button('×','Remove '+label,()=>remove(block,section)));section.append(bar);}
    function article(start,end){
      const text=source.slice(start,end),markers=[...text.matchAll(/^\|tab\s*=\s*(.+)$/gm)];let offset=0;
      function chunk(from,to){const value=text.slice(from,to);if(!value.trim())return;const block={start:start+from,end:start+to,value};blocks.push(block);const section=make('section','visual-section');block.element=section;
        const tools=make('div','article-tools');tools.append(button('×','Remove article section',()=>remove(block,section)));section.append(tools);
        const content=make('div','visual-body');body(content,value,imageBase);editable(content,()=>block.value='\n'+serialize(content).trim()+'\n\n','Article text');section.append(content);root.append(section);
      }
      for(const marker of markers){chunk(offset,marker.index);const lineEnd=marker.index+marker[0].length,block={start:start+marker.index,end:start+lineEnd,value:marker[0]};blocks.push(block);const bar=make('div','visual-tab-marker');block.element=bar;bar.append(make('span','','Tab'),input(marker[1].trim(),'Tab section name',value=>{const previous=block.value.replace(/^\|tab\s*=\s*/,'').trim(),next=value.replace(/[\r\n]/g,'');block.value='|tab='+next;for(const menu of tabMenus){for(const row of menu.rows){if(row.key===previous&&!row.value){row.key=next;row.raw=next+'\n';row.keyField.value=next;}}menu.commit();}}),button('×','Remove tab marker',()=>{const label=block.value.replace(/^\|tab\s*=\s*/,'').trim();for(const menu of tabMenus){for(const row of [...menu.rows]){if(row.key===label&&!row.value){menu.rows.splice(menu.rows.indexOf(row),1);row.element.remove();}}menu.commit();}remove(block,bar);}));root.append(bar);offset=lineEnd;}chunk(offset,text.length);
    }
    for(const template of templates(source)){
      article(position,template.start);position=template.end;const block={...template};blocks.push(block);const parameters=parts(template.value),namePart=parameters.shift(),name=namePart.value.trim().toLowerCase();
      const section=make(name==='spoiler'||name==='credits'?'section':'details','visual-template');block.element=section;
      const names={page:'Page information',infobox:'Infobox',character:'Infobox',references:'References',characters:'Character list',randomarticle:'Random article',tabs:'Tabs',gallery:'Gallery',credits:'Credits',spoiler:'Spoiler'};
      title(section,names[name]||namePart.value.trim(),block);
      if(name==='spoiler'||name==='credits'){
        const content=make('div','visual-body');inline(content,parameters.map(p=>p.value).join('|').trim(),imageBase);editable(content,()=>block.value='{{'+(name==='spoiler'?'Spoiler':'Credits')+'|'+serialize(content,{field:true}).trim().replace(/\n/g,'<br>')+'}}',names[name]+' text');section.append(content);
      }else if(name==='gallery'){
        const images=parameters.map(p=>p.value).join('|').split('\n').filter(v=>v.trim()).map(line=>{const [file,...caption]=line.trim().split(' :: ');return{file,caption:caption.join(' :: ')};});
        const grid=make('div','visual-gallery');section.append(grid);
        const commit=()=>block.value='{{Gallery|\n'+images.map(image=>image.file+(image.caption?' :: '+image.caption:'')).join('\n')+'\n}}';
        function imageRow(image){const row=make('figure'),img=make('img');image.element=row;const paint=()=>{img.src=safeURL(/^(?:https?:|\/)/i.test(image.file)?image.file:imageBase+image.file);img.alt=image.caption;};paint();row.append(img,input(image.file,'Gallery image path',value=>{image.file=value.replace(/[\r\n|]/g,'');paint();commit();}),input(image.caption,'Gallery image caption',value=>{image.caption=value.replace(/[\r\n|]/g,'');paint();commit();}),button('↳','Add gallery image after',()=>addImage(image)),button('×','Remove gallery image',()=>{images.splice(images.indexOf(image),1);row.remove();commit();update(true);}));grid.append(row);}
        function addImage(afterImage=null){const image={file:'',caption:''};if(afterImage)images.splice(images.indexOf(afterImage)+1,0,image);else images.push(image);imageRow(image);if(afterImage)afterImage.element.after(image.element);commit();update(true);section.open=true;image.element.querySelector('input').focus();}
        images.forEach(imageRow);section.append(button('Add image','Add gallery image',()=>addImage()));
      }else{
        const rows=parameters.map(part=>{const equal=part.value.indexOf('='),raw=equal<0?part.value:part.value.slice(equal+1);return{raw:part.value,key:(equal<0?part.value:part.value.slice(0,equal)).trim(),value:equal<0?'':raw.trim(),named:equal>=0};});
        const list=make('div','visual-info-list');section.append(list);
        const commit=()=>block.value='{{'+namePart.value+rows.map(row=>'|'+row.raw).join('')+'}}';
        if(name==='tabs')tabMenus.push({rows,commit});
        function rowView(row){
          const element=make('div','visual-info-row'),key=input(row.key,name==='tabs'?'Tab name':'Field name',value=>{
            const previous=row.key;row.key=value.replace(/[\r\n|{}=]/g,'');row.raw=row.key+(row.named?'='+row.value:'')+'\n';commit();
            element.querySelector('.visual-info-value')?.setAttribute('aria-label','Value for '+row.key);const removeButton=element.querySelector('[data-remove-row]');if(removeButton){removeButton.setAttribute('aria-label','Remove '+(row.key||'field')+' row');removeButton.title='Remove '+(row.key||'field')+' row';}
            if(name==='tabs'&&previous!==row.key){for(const other of blocks){if(/^\|tab\s*=/.test(other.value)&&other.value.replace(/^\|tab\s*=\s*/,'').trim()===previous){other.value='|tab='+row.key;const field=other.element?.querySelector('input');if(field)field.value=row.key;}}}
          });
          row.keyField=key;row.element=element;element.append(key);let content;
          if(name==='tabs'||['image','image base','source'].includes(row.key.toLowerCase())||name==='characters'||name==='randomarticle'||name==='references'){
            content=input(row.value,name==='tabs'?'Tab destination (empty for an article tab)':'Field value',value=>{row.value=value.replace(/[\r\n|]/g,'');row.named=name!=='tabs'||Boolean(row.value);row.raw=row.key+(row.named?'='+row.value:'')+'\n';commit();});
          }else{content=make('div','visual-info-value');inline(content,row.value,imageBase);editable(content,()=>{row.value=serialize(content,{field:true}).trim();row.named=true;row.raw=row.key+'='+row.value+'\n';commit();},'Value for '+row.key);}
          const removeRow=button('×','Remove '+(row.key||'field')+' row',()=>{rows.splice(rows.indexOf(row),1);element.remove();commit();update(true);});removeRow.dataset.removeRow='';
          element.append(content);
          element.classList.add('visual-infobox-row');const controls=make('div','infobox-row-actions');controls.append(button('↳',name==='tabs'?'Add tab below':name==='infobox'||name==='character'?'Add infobox row below':'Add field below',()=>addRow(name==='tabs'?'New tab':'New field',row)),removeRow);element.append(controls);
          if(row.key.toLowerCase()==='image'&&row.value){const img=make('img','visual-portrait'),file=row.value.split(' :: ')[0];img.src=safeURL(/^(?:https?:|\/)/i.test(file)?file:imageBase+file);img.alt=row.value;element.append(img);}
          list.append(element);
        }
        rows.forEach(rowView);
        const actions=make('div','block-footer');
        function addRow(key,afterRow=null){if(name==='tabs'){let number=1;while(rows.some(row=>row.key===key)||compose().includes('|tab='+key))key='New tab '+(++number);}const row={raw:key+(name==='tabs'?'':'=')+'\n',key,value:'',named:name!=='tabs'};if(afterRow)rows.splice(rows.indexOf(afterRow)+1,0,row);else rows.push(row);rowView(row);if(afterRow)afterRow.element.after(row.element);commit();if(name==='tabs'){section.open=true;onChange(compose()+'\n\n|tab='+key+'\n\n== '+key+' ==\nWrite tab content here.\n',{structural:true,render:true});const field=[...root.querySelectorAll('[data-block-name="Tabs"] input')].find(input=>input.value===key);field?.focus();field?.select();return;}update(true);section.open=true;row.keyField.focus();row.keyField.select();}
        actions.append(button(name==='tabs'?'Add tab':'Add field',name==='tabs'?'Add navigation tab':'Add field',()=>addRow(name==='tabs'?'New tab':'New field')));
        if(['infobox','character'].includes(name)){actions.append(button('Section','Add infobox section',()=>addRow('section')),button('Image','Add infobox image',()=>addRow('image')));}
        if(name==='tabs')actions.append(make('small','','Use an empty destination for an article tab. Insert a Tab section for its content.'));
        section.append(actions);
      }
      root.append(section);
    }article(position,source.length);
    panelCounts.clear();
    for(const panel of root.querySelectorAll('details.visual-template')){const name=panel.dataset.blockName,index=panelCounts.get(name)||0;panelCounts.set(name,index+1);const key=name+':'+index;if(panelStates.has(key))panel.open=panelStates.get(key);}
    compose();
    root.onclick=event=>{if(event.target.closest('a'))event.preventDefault();};
    root.ondblclick=event=>{const category=event.target.closest('[data-wiki-category]');if(category){const name=prompt('Category name:',category.dataset.wikiCategory);if(name===null)return;const clean=name.replace(/[|\[\]\r\n]/g,'').replace(/^Category:/i,'').trim();if(!clean)return;category.dataset.wikiToken='[[Category:'+clean+']]';category.dataset.wikiCategory=clean;category.firstElementChild.textContent=clean;category.querySelector('button').setAttribute('aria-label','Remove category '+clean);category.closest('.visual-editable')?.dispatchEvent(new Event('input',{bubbles:true}));return;}const link=event.target.closest('a');if(!link)return;const target=prompt('Link destination:',link.dataset.wikiTarget);if(target===null)return;link.dataset.wikiTarget=target;link.closest('.visual-editable')?.dispatchEvent(new Event('input',{bubbles:true}));};
  }
  window.WikiVisual={render,serialize,inline,selectParagraph,compactSource};
})();
