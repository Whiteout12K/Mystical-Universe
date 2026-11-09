const $=id=>document.getElementById(id),session=new URLSearchParams(location.search).get('inspect');
const ROW_HEIGHT=44,ROW_BUFFER=4;
let channel=null,sprites=[],filtered=[],selectedId=null,lastResponse=0,requestId=0,pendingAt=0,listVersion='',windowVersion='',emptyReason='Select a sprite to inspect its live properties and variables.';
const tables=new Map();
const setText=(element,value)=>{const text=String(value??'');if(element.textContent!==text)element.textContent=text;};
const number=value=>typeof value==='number'?String(Math.round(value*1000)/1000):String(value??'—');
function valueText(value){if(typeof value==='string')return value;return JSON.stringify(value,null,2)??'[undefined]';}
function status(text,connected=false){setText($('connection'),text);$('connection').classList.toggle('connected',connected);}
function values(id,object,empty){
    const container=$(id);let state=tables.get(id);
    if(!state){state={rows:new Map(),empty:document.createElement('p')};state.empty.className='none';state.empty.textContent=empty;container.className='values';container.append(state.empty);tables.set(id,state);}
    const keys=Object.keys(object??{}).sort((a,b)=>a.localeCompare(b));state.empty.hidden=keys.length>0;
    for(const [key,row] of state.rows)if(!Object.hasOwn(object??{},key)){row.element.remove();state.rows.delete(key);}
    for(const key of keys){
        let row=state.rows.get(key);
        if(!row){const element=document.createElement('div'),label=document.createElement('span'),value=document.createElement('pre');element.className='value-row';label.className='value-name';value.className='value-text';label.textContent=key;element.append(label,value);row={element,value};state.rows.set(key,row);container.append(element);}
        setText(row.value,valueText(object[key]));
    }
}
function showDetails(data){
    $('selected').hidden=!data;$('empty-detail').hidden=!!data;
    if(!data){setText($('empty-detail'),emptyReason);return;}
    setText($('selected-name'),data.name);setText($('selected-type'),data.isClone&&data.type==='UI'?'UI clone':data.type);
    setText($('selected-source'),data.isClone?'Clone of '+data.source:'Original '+(data.type==='UI'?'UI object':'sprite'));
    setText($('pos-x'),number(data.properties.x));setText($('pos-y'),number(data.properties.y));setText($('pos-scale'),number(data.properties.scale));
    setText($('vars-count'),Object.keys(data.variables).length);setText($('private-count'),Object.keys(data.privateVariables).length);
    values('sprite-vars',data.variables,'No sprite vars.');values('private-vars',data.privateVariables,'No private vars.');values('properties',data.properties,'No properties.');
}
function select(id){selectedId=id;emptyReason='Loading sprite…';showDetails(null);renderRows(true);requestSnapshot(true);}
function renderRows(force=false){
    const list=$('sprite-list'),start=Math.max(0,Math.floor(list.scrollTop/ROW_HEIGHT)-ROW_BUFFER),end=Math.min(filtered.length,start+Math.ceil(list.clientHeight/ROW_HEIGHT)+ROW_BUFFER*2);
    const signature=start+':'+end+':'+selectedId+':'+listVersion;if(!force&&signature===windowVersion)return;windowVersion=signature;
    const focused=document.activeElement?.dataset.spriteId;
    const fragment=document.createDocumentFragment();
    for(let index=start;index<end;index++){
        const sprite=filtered[index],button=document.createElement('button'),name=document.createElement('span'),kind=document.createElement('span');
        button.className='sprite'+(sprite.visible?'':' invisible');button.dataset.spriteId=sprite.id;button.setAttribute('role','option');button.setAttribute('aria-selected',String(sprite.id===selectedId));button.setAttribute('aria-posinset',String(index+1));button.setAttribute('aria-setsize',String(filtered.length));button.title=sprite.isClone?'Clone of '+sprite.source:sprite.name;
        name.className='name';name.textContent=sprite.name;kind.className='kind';kind.textContent=sprite.isClone?'clone':sprite.type==='UI'?'UI':'sprite';button.append(name,kind);button.onclick=()=>select(sprite.id);
        button.onkeydown=event=>{const delta=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0;if(!delta)return;event.preventDefault();const next=filtered[index+delta];if(!next)return;const top=(index+delta)*ROW_HEIGHT;if(top<list.scrollTop)list.scrollTop=top;else if(top+ROW_HEIGHT>list.scrollTop+list.clientHeight)list.scrollTop=top+ROW_HEIGHT-list.clientHeight;select(next.id);[...$('list-rows').children].find(e=>e.dataset.spriteId===next.id)?.focus({preventScroll:true});};
        fragment.append(button);
    }
    $('list-rows').style.transform=`translateY(${start*ROW_HEIGHT}px)`;$('list-rows').replaceChildren(fragment);
    if(focused)[...$('list-rows').children].find(e=>e.dataset.spriteId===focused)?.focus({preventScroll:true});
}
function filterList(){
    const query=$('filter').value.trim().toLowerCase();filtered=sprites.filter(s=>!query||`${s.name} ${s.source??''} ${s.type}`.toLowerCase().includes(query));
    $('list-spacer').style.height=filtered.length*ROW_HEIGHT+'px';$('empty-list').hidden=filtered.length>0;setText($('empty-list'),sprites.length?'No matching sprites.':'No active sprites.');
    setText($('count'),query?`${filtered.length} / ${sprites.length}`:sprites.length+' active');
    const maxScroll=Math.max(0,filtered.length*ROW_HEIGHT-$('sprite-list').clientHeight);$('sprite-list').scrollTop=Math.min($('sprite-list').scrollTop,maxScroll);renderRows();
}
function requestSnapshot(force=false){
    if(!channel)return;const now=performance.now();
    if(!force&&pendingAt&&now-pendingAt<1500)return;
    pendingAt=now;channel.postMessage({type:'snapshot',requestId:++requestId,selectedId});
}
$('filter').oninput=()=>{windowVersion='';$('sprite-list').scrollTop=0;filterList();};$('sprite-list').onscroll=()=>renderRows();
new ResizeObserver(()=>{windowVersion='';renderRows();}).observe($('sprite-list'));
let timer=null;
if(!session||!/^[a-zA-Z0-9-]{16,80}$/.test(session)){status('No game session');setText($('empty-list'),'Open this inspector with Run in the editor.');}
else if(typeof BroadcastChannel==='undefined'){status('Unsupported browser');setText($('empty-list'),'This browser cannot connect to the live inspector.');}
else{
    channel=new BroadcastChannel('jscratch-inspector:'+session);
    channel.onmessage=event=>{
        const data=event.data;if(data?.type==='closed'){status('Game closed');pendingAt=0;lastResponse=0;return;}
        if(data?.type==='unavailable'){status('Snapshot unavailable');pendingAt=0;return;}
        if(data?.type!=='snapshot'||!Array.isArray(data.sprites)||data.requestId<requestId)return;
        lastResponse=performance.now();pendingAt=0;status(data.state,true);setText($('updated'),'Updating');
        const version=JSON.stringify(data.sprites.map(s=>[s.id,s.name,s.type,s.visible]));sprites=data.sprites;
        if(version!==listVersion){listVersion=version;filterList();}
        else if(!sprites.length)filterList();
        if(selectedId&&!data.selected){emptyReason='This sprite no longer exists. Select another sprite.';selectedId=null;renderRows(true);}
        showDetails(data.selected);
    };
    requestSnapshot();timer=setInterval(()=>{if(document.hidden)return;if(lastResponse&&performance.now()-lastResponse>2500){status('Game not responding');setText($('updated'),'Last received values');}requestSnapshot();},250);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestSnapshot(true);});
}
addEventListener('pagehide',()=>{clearInterval(timer);channel?.close();},{once:true});
