import {previewValue} from './inspector-model.mjs';

const builtins=new Set(`cameraX cameraY cameraZoom getUsername getLoggedIn getData jsonLoaded jsonValue jsonExists
jsonKeys jsonLength jsonType getList listItem listLength listContains spriteX spriteY spriteDirection isMobile
coordinateModeOfSprite round abs cos sin equal not join letter length contain touchingMouse touchingSprite
distanceMouse distanceSprite keyPressed mouseX mouseY currentYear currentMonth currentDay currentHour currentMin
deltaTime solidEnabled solidTargets solidBlocked solidContacts volumeOfSound costumeOfSprite sizeOfSprite
uiExists uiGet canvasWidth canvasHeight screenWidth screenHeight`.split(/\s+/));
const numeric={
    add:(a,b)=>a+b,sub:(a,b)=>a-b,mult:(a,b)=>a*b,div:(a,b)=>a/b,mod:(a,b)=>a%b,
    gThan:(a,b)=>a>b,lThan:(a,b)=>a<b,gEqThan:(a,b)=>a>=b,lEqThan:(a,b)=>a<=b
};
const primitive=value=>value===null||['string','number','boolean','undefined'].includes(typeof value);

function ownValue(object,key){
    if(!object)return '';
    const property=Object.getOwnPropertyDescriptor(object,key);
    if(property&&!Object.hasOwn(property,'value'))throw new Error('This value uses a getter.');
    return property?.value??'';
}

export function inspectReporter(runtime,realm,expression){
    let remaining=100;
    function read(node,depth=0){
        if(!node||depth>24||--remaining<0)throw new Error('This expression is too large to inspect.');
        if(node.kind==='literal'&&primitive(node.value))return node.value;
        if(node.kind!=='reporter'||!Array.isArray(node.args)||node.args.length>8)throw new Error('Use a literal or a supported reporter.');
        const {name,args}=node;
        if(name==='and'||name==='or'){
            const first=Boolean(read(args[0],depth+1));
            return name==='and'?first&&Boolean(read(args[1],depth+1)):first||Boolean(read(args[1],depth+1));
        }
        if(name==='truthy')return Boolean(read(args[0],depth+1));
        if(name==='cameraZoom'&&args.length)throw new Error('Inspect the camera zoom reporter.');
        const variables=name==='getVar'||name==='getSpriteVar';
        if(!variables&&!Object.hasOwn(numeric,name)&&!builtins.has(name)){
            throw new Error('This reporter needs a script context or has no live preview.');
        }
        const values=args.map(arg=>read(arg,depth+1));
        if(values.some(value=>!primitive(value)))throw new Error('This reporter uses a value that cannot be inspected as an input.');
        if(Object.hasOwn(numeric,name))return numeric[name](...values.map(value=>Number(value??'')));
        if(name==='getVar')return ownValue(runtime.ENGINE.variables,String(values[0]??''));
        if(name==='getSpriteVar'){
            const sprite=runtime.getContextSprite(values[0],null,false);
            return ownValue(ownValue(sprite,'variables'),String(values[1]??''));
        }
        const factory=Object.getOwnPropertyDescriptor(realm,name)?.value;
        if(typeof factory!=='function')throw new Error('This reporter is unavailable in the running game.');
        return runtime.resolveValue(factory(...values));
    }
    return previewValue(read(expression),undefined,undefined,undefined,realm);
}
