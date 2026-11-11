import {inspectorSnapshot} from './inspector-model.mjs';
export function connectInspector(runtime,session,realm=globalThis){
    if(!runtime||!session||!/^[a-zA-Z0-9-]{16,80}$/.test(session)||typeof BroadcastChannel==='undefined')return ()=>{};
    const channel=new BroadcastChannel('jscratch-inspector:'+session);let closed=false;
    channel.onmessage=event=>{
        const request=event.data;if(request?.type!=='snapshot'||closed)return;
        try{channel.postMessage({type:'snapshot',requestId:request.requestId,...inspectorSnapshot(runtime.ENGINE,typeof request.selectedId==='string'?request.selectedId:null,realm)});}
        catch{channel.postMessage({type:'unavailable'});}
    };
    const disconnect=()=>{if(closed)return;closed=true;channel.postMessage({type:'closed'});channel.close();removeEventListener('pagehide',disconnect);};
    addEventListener('pagehide',disconnect,{once:true});return disconnect;
}
