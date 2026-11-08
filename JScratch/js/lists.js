/* Named Scratch-style lists: 1-based item positions, live reporters. */
const recordList=(type,data={})=>ENGINE.recordBlock(createBlock(type,data));
function makeList(name,items=[]){return recordList("makeList",{name,items});}
function setList(name,items){return recordList("setList",{name,items});}
function addToList(name,item){return recordList("addToList",{name,item});}
function insertInList(name,index,item){return recordList("insertInList",{name,index,item});}
function replaceInList(name,index,item){return recordList("replaceInList",{name,index,item});}
function deleteFromList(name,index){return recordList("deleteFromList",{name,index});}
function clearList(name){return recordList("clearList",{name});}
function deleteList(name){return recordList("deleteList",{name});}
function getList(name){return createReporter("getList",{name});}
function listItem(name,index){return createReporter("listItem",{name,index});}
function listLength(name){return createReporter("listLength",{name});}
function listContains(name,item){return createReporter("listContains",{name,item});}
function namedList(name,c,create=false){
    const key=String(resolveValue(name,c));
    if(create&&!Object.hasOwn(ENGINE.lists,key))ENGINE.lists[key]=[];
    return ENGINE.lists[key];
}
function listValues(value,c){
    const values=resolveValue(value,c);if(!Array.isArray(values))throw new Error("List items must be an array or getList() reporter");
    return values.map(item=>resolveValue(item,c));
}
function listIndex(value,count,c,insert=false){
    const index=resolveValue(value,c),word=String(index).toLowerCase(),length=count+(insert?1:0);
    if(word==="last")return length-1;
    if(word==="random"||word==="any")return length?Math.floor(Math.random()*length):-1;
    const n=Number(index);return Number.isInteger(n)&&n>=1&&n<=length?n-1:-1;
}
registerBlock("makeList",(b,c)=>{
    const key=String(resolveValue(b.name,c));if(!Object.hasOwn(ENGINE.lists,key))ENGINE.lists[key]=listValues(b.items,c);
});
registerBlock("setList",(b,c)=>{ENGINE.lists[String(resolveValue(b.name,c))]=listValues(b.items,c);});
registerBlock("addToList",(b,c)=>{namedList(b.name,c,true).push(resolveValue(b.item,c));});
registerBlock("insertInList",(b,c)=>{const list=namedList(b.name,c,true),i=listIndex(b.index,list.length,c,true);if(i>=0)list.splice(i,0,resolveValue(b.item,c));});
registerBlock("replaceInList",(b,c)=>{const list=namedList(b.name,c);if(!list)return;const i=listIndex(b.index,list.length,c);if(i>=0)list[i]=resolveValue(b.item,c);});
registerBlock("deleteFromList",(b,c)=>{const list=namedList(b.name,c);if(!list)return;if(String(resolveValue(b.index,c)).toLowerCase()==="all"){list.length=0;return;}const i=listIndex(b.index,list.length,c);if(i>=0)list.splice(i,1);});
registerBlock("clearList",(b,c)=>{const list=namedList(b.name,c);if(list)list.length=0;});
registerBlock("deleteList",(b,c)=>{delete ENGINE.lists[String(resolveValue(b.name,c))];});
registerReporter("getList",(b,c)=>namedList(b.name,c)||[]);
registerReporter("listItem",(b,c)=>{const list=namedList(b.name,c)||[],i=listIndex(b.index,list.length,c);return i<0?"":list[i]??"";});
registerReporter("listLength",(b,c)=>namedList(b.name,c)?.length||0);
registerReporter("listContains",(b,c)=>(namedList(b.name,c)||[]).includes(resolveValue(b.item,c)));
