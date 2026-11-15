import {parse} from './vendor/acorn.mjs';

function literal(text){
    const expression=parse('('+text+'\n)',{ecmaVersion:'latest'}).body[0]?.expression;
    if(expression?.type==='Literal'&&
        (expression.value===null||['string','number','boolean'].includes(typeof expression.value)))return expression.value;
    if(expression?.type==='UnaryExpression'&&['-','+'].includes(expression.operator)&&
        expression.argument.type==='Literal'&&typeof expression.argument.value==='number'){
        return expression.operator==='-'?-expression.argument.value:expression.argument.value;
    }
    throw new Error('Live preview supports literal inputs and connected reporters.');
}

export function reporterExpression(node,depth=0){
    if(!node)throw new Error('Fill in the reporter input.');
    if(depth>24)throw new Error('This expression is too deeply nested to inspect.');
    if(node.kind==='expression')return {kind:'literal',value:literal(node.text)};
    if(node.kind==='call'&&node.reporter)return {kind:'reporter',name:node.name,
        args:node.args.map(arg=>reporterExpression(arg,depth+1))};
    throw new Error('Click a reporter block to inspect its value.');
}

export function setupReporterClick(Blockly,workspace,bridge,popup){
    const title=popup.querySelector('strong'),output=popup.querySelector('output');
    let channel,requestId=0,timeout,anchor;
    const position=()=>{
        popup.style.left=Math.max(8,Math.min(anchor.left,innerWidth-popup.offsetWidth-8))+'px';
        popup.style.top=(anchor.bottom+8+popup.offsetHeight<=innerHeight?anchor.bottom+8:
            Math.max(8,anchor.top-popup.offsetHeight-8))+'px';
    };
    const close=()=>{clearTimeout(timeout);requestId++;popup.hidden=true;};
    function connect(session){
        channel?.close();close();
        if(typeof BroadcastChannel==='undefined')return;
        channel=new BroadcastChannel('jscratch-inspector:'+session);
        channel.onmessage=({data})=>{
            if(data?.type!=='reporter-value'||data.requestId!==requestId||popup.hidden)return;
            clearTimeout(timeout);
            output.textContent=data.error??JSON.stringify(data.value,null,2)??'undefined';
            position();
        };
    }
    workspace.addChangeListener(event=>{
        if(event.type!==Blockly.Events.CLICK)return;
        const block=workspace.getBlockById(event.blockId);
        if(event.targetType!=='block'||!block?.outputConnection){close();return;}
        if(block.isShadow()||['js_expression','js_boolean_expression'].includes(block.type)){close();return;}
        close();
        anchor=block.getSvgRoot().getBoundingClientRect();
        title.textContent=block.getInput('TITLE')?.fieldRow[0]?.getText()||'Reporter value';
        output.textContent='Checking the running game…';
        popup.hidden=false;
        position();
        if(!channel){output.textContent='Press Run to inspect live values.';return;}
        try{
            const expression=block.type==='js_boolean_test'?
                {kind:'reporter',name:'truthy',args:[reporterExpression(block.getInputTargetBlock('VALUE')&&bridge.fromBlock(block.getInputTargetBlock('VALUE')))]}:
                reporterExpression(bridge.fromBlock(block));
            channel.postMessage({type:'reporter-value',requestId,expression});
            timeout=setTimeout(()=>{output.textContent='The preview is unavailable. Press Run to start it again.';},1800);
        }catch(error){output.textContent=error.message;}
    });
    window.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    document.addEventListener('pointerdown',event=>{if(!popup.contains(event.target))close();});
    window.addEventListener('pagehide',()=>{close();channel?.close();});
    return connect;
}
