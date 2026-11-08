import {parse} from './vendor/acorn.mjs';

// Import is deliberately syntax-only: game files are never evaluated here.
export function parseProgram(source,catalog){
    const comments=[];
    const ast=parse(source,{ecmaVersion:'latest',sourceType:'script',onComment:comments});
    const definitions=new Map(catalog.map(d=>[`${d.name}:${d.reporter}`,d]));
    const commandNodes=[];
    const raw=n=>({kind:'expression',text:source.slice(n.start,n.end)});
    function expression(n){
        if(n.type==='CallExpression'&&n.callee.type==='Identifier'){
            const d=definitions.get(`${n.callee.name}:true`);
            if(d&&!n.arguments.some(a=>a.type==='SpreadElement'))return call(n,d);
        }
        return raw(n);
    }
    function command(n,nested=false){
        if(n.type==='CallExpression'&&n.callee.type==='Identifier'){
            const d=definitions.get(`${n.callee.name}:false`);
            if(d&&!(nested&&['whenStart','whenBroadcast','whenClone'].includes(d.name))&&!n.arguments.some(a=>a.type==='SpreadElement'))return call(n,d);
        }
        const result={kind:'code',text:source.slice(n.start,n.end),comments:''};commandNodes.push({start:n.start,result});return result;
    }
    function call(n,d){
        const result={kind:'call',name:d.name,reporter:d.reporter,container:d.container,args:[],body:[],elseBody:[],hasElse:false,comments:''};
        if(!d.reporter)commandNodes.push({start:n.start,result});
        const fixed=d.container?d.params.length:n.arguments.length;
        result.args=n.arguments.slice(0,fixed).map(expression);
        if(d.container){
            let target=result.body;
            for(const arg of n.arguments.slice(fixed)){
                if(d.name==='ifBlock'&&arg.type==='Literal'&&arg.value==='else'){target=result.elseBody;result.hasElse=true;}
                else target.push(command(arg,true));
            }
        }
        return result;
    }
    const blocks=ast.body.map(n=>{
        const e=n.type==='ExpressionStatement'?n.expression:null;
        const known=e?.type==='CallExpression'&&e.callee.type==='Identifier'&&definitions.has(`${e.callee.name}:false`)&&!e.arguments.some(a=>a.type==='SpreadElement');
        return command(known?e:n);
    });
    commandNodes.sort((a,b)=>a.start-b.start);
    let footer='';
    for(const c of comments){
        // Comments inside raw JavaScript already survive in its original source.
        const inRaw=commandNodes.some(x=>x.result.kind==='code'&&c.start>x.start&&c.end<x.start+x.result.text.length);
        if(inRaw)continue;
        const next=commandNodes.find(x=>x.start>=c.end);
        const text=c.type==='Line'?'//'+c.value:'/*'+c.value+'*/';
        if(next)next.result.comments+=(next.result.comments?'\n':'')+text;
        else footer+=(footer?'\n':'')+text;
    }
    return {blocks,footer};
}
function indent(text,depth){const prefix='    '.repeat(depth);return text.split('\n').map(line=>prefix+line).join('\n');}
export function expressionCode(node){
    if(node.kind==='expression'){
        const comments=[],ast=parse(`(${node.text}\n)`,{ecmaVersion:'latest',onComment:comments});
        return ast.body[0].expression.type==='SequenceExpression'||comments.length?`(${node.text}\n)`:node.text;
    }
    if(node.kind==='code')return node.text.replace(/;\s*$/,'');
    return `${node.name}(${node.args.map(expressionCode).join(', ')})`;
}
function commandCode(node,depth=0){
    let text;
    if(node.kind==='code')text=node.text;
    else if(node.container||node.body.length||node.elseBody.length){
        const lines=node.args.map(a=>indent(expressionCode(a)+',',depth+1));
        lines.push(...node.body.map(n=>commandCode(n,depth+1)+','));
        if(node.elseBody.length||node.hasElse){lines.push(indent('"else",',depth+1));lines.push(...node.elseBody.map(n=>commandCode(n,depth+1)+','));}
        text=`${node.name}(\n${lines.join('\n')}\n${'    '.repeat(depth)})`;
        return (node.comments?indent(node.comments,depth)+'\n':'')+'    '.repeat(depth)+text;
    }else text=expressionCode(node);
    return (node.comments?indent(node.comments,depth)+'\n':'')+indent(text,depth);
}
export function generateProgram(model){
    const text=model.blocks.map(node=>commandCode(node)+';').join('\n\n')+(model.footer?'\n\n'+model.footer:'')+'\n';
    parse(text,{ecmaVersion:'latest'}); // Never save syntactically broken output.
    return text;
}
export function validateExpression(text){parse(`(${text}\n)`,{ecmaVersion:'latest'});return text;}
