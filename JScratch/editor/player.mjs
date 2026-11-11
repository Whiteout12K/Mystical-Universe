import {connectInspector} from './live-inspector.mjs';
// The optional development host owns inspection. canvas.html never imports it.
const params=new URLSearchParams(location.search),frame=document.getElementById('game'),url=new URL('../canvas.html',import.meta.url);
if(params.has('startBroadcast'))url.searchParams.set('startBroadcast',params.get('startBroadcast'));
let disconnect=()=>{};
frame.addEventListener('load',()=>{const runtime=frame.contentWindow?.MLGame;if(!runtime)return;disconnect();disconnect=connectInspector(runtime,params.get('inspect'),frame.contentWindow);frame.contentWindow.focus();});
frame.src=url.href;
