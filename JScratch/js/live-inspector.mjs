import {inspectorSnapshot} from './inspector-model.mjs';
const session=new URLSearchParams(location.search).get('inspect');
// Normal game visits do not open a channel or collect inspector snapshots.
if(session&&/^[a-zA-Z0-9-]{16,80}$/.test(session)&&typeof BroadcastChannel!=='undefined'){
    const channel=new BroadcastChannel('jscratch-inspector:'+session);
    channel.onmessage=event=>{
        const request=event.data;
        if(request?.type!=='snapshot')return;
        try{channel.postMessage({type:'snapshot',requestId:request.requestId,...inspectorSnapshot(MLGame.ENGINE,typeof request.selectedId==='string'?request.selectedId:null)});}
        catch{channel.postMessage({type:'unavailable'});}
    };
    addEventListener('pagehide',()=>{channel.postMessage({type:'closed'});channel.close();},{once:true});
}
