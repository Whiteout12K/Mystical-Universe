/* Opt-in, directional top-down solid collision. No gravity or pushing. */
const SOLID_SKIN=1e-7;
const recordSolid=(type,data)=>ENGINE.recordBlock(createBlock(type,data));
function spriteSolid(name,enabled=true){return recordSolid("spriteSolid",{name,enabled});}
function spriteCollisionTargets(name,targets){return recordSolid("spriteCollisionTargets",{name,targets});}
function solidEnabled(name){return createReporter("solidEnabled",{name});}
function solidTargets(name){return createReporter("solidTargets",{name});}
function solidBlocked(name){return createReporter("solidBlocked",{name});}
function solidContacts(name){return createReporter("solidContacts",{name});}
function solidTargetNames(sprite,c){
    const raw=resolveValue(sprite.solidCollision.targets,c);
    const values=Array.isArray(raw)?raw:typeof raw==="string"?[raw]:null;
    if(!values)throw new Error("Collision targets must be a sprite name, an array, or a list reporter");
    return [...new Set(values.map(value=>String(resolveValue(value,c))).filter(Boolean))];
}
registerBlock("spriteSolid",(b,c)=>{
    const s=getContextSprite(b.name,c);if(!s)return;
    s.solidCollision.enabled=mediaBoolean(b.enabled,c);
    if(!s.solidCollision.enabled){s.solidCollision.blocked=false;s.solidCollision.contacts=[];}
});
registerBlock("spriteCollisionTargets",(b,c)=>{
    const s=getContextSprite(b.name,c);if(!s)return;
    const previous=s.solidCollision.targets;s.solidCollision.targets=b.targets;
    try{solidTargetNames(s,c);}catch(error){s.solidCollision.targets=previous;throw error;}
});
registerReporter("solidEnabled",(b,c)=>!!getContextSprite(b.name,c)?.solidCollision.enabled);
registerReporter("solidTargets",(b,c)=>{const s=getContextSprite(b.name,c);return s?solidTargetNames(s,c):[];});
registerReporter("solidBlocked",(b,c)=>!!getContextSprite(b.name,c)?.solidCollision.blocked);
registerReporter("solidContacts",(b,c)=>[...(getContextSprite(b.name,c)?.solidCollision.contacts||[])]);
function solidObstacles(sprite,c){
    const names=new Set(solidTargetNames(sprite,c)),targets=new Set();
    if(!names.size)return [];
    for(const name of names){const target=name.trim().toLowerCase()==="self"?getContextSprite(name,c):ENGINE.sprites[name];if(target&&target!==sprite&&sensingTarget(target))targets.add(target);}
    for(const clone of ENGINE.clones)if(clone!==sprite&&sensingTarget(clone)&&(names.has(clone.cloneName)||names.has(clone.cloneIdName)))targets.add(clone);
    return [...targets];
}
function sweptBounds(rect,dx,dy){
    return {left:rect.left+Math.min(0,dx),right:rect.right+Math.max(0,dx),bottom:rect.bottom+Math.min(0,dy),top:rect.top+Math.max(0,dy)};
}
function solidProjection(points,axis){
    let min=Infinity,max=-Infinity;
    for(const p of points){const n=p.x*axis.x+p.y*axis.y;min=Math.min(min,n);max=Math.max(max,n);}
    return {min,max};
}
function sweepSolidRect(a,b,axes,dx,dy){
    if(!collisionBoundsOverlap(sweptBounds(a,dx,dy),b))return null;
    let entry=-Infinity,exit=Infinity,normal=null,separation=Infinity,escape=null;
    for(const axis of axes){
        const A=solidProjection(a.points,axis),B=solidProjection(b.points,axis),velocity=dx*axis.x+dy*axis.y;
        for(const [depth,sign] of [[A.max-B.min,-1],[B.max-A.min,1]]){
            const candidate={x:axis.x*sign,y:axis.y*sign};
            if(depth>=0&&(depth<separation-1e-10||(Math.abs(depth-separation)<=1e-10&&(!escape||dx*candidate.x+dy*candidate.y>dx*escape.x+dy*escape.y)))){
                separation=depth;escape=candidate;
            }
        }
        if(Math.abs(velocity)<1e-12){if(A.max<=B.min||B.max<=A.min)return null;continue;}
        const enter=(velocity>0?B.min-A.max:B.max-A.min)/velocity;
        const leave=(velocity>0?B.max-A.min:B.min-A.max)/velocity;
        if(enter>entry){entry=enter;normal={x:velocity>0?-axis.x:axis.x,y:velocity>0?-axis.y:axis.y};}
        exit=Math.min(exit,leave);if(entry>=exit)return null;
    }
    // A changing GIF frame or explicit placement can begin overlapped. Allow
    // escape/tangential movement, but do not let that overlap bypass a wall.
    if(entry>=1||exit<=0||!normal)return null;
    if(entry<0)return escape&&dx*escape.x+dy*escape.y<-1e-12?{time:0,normal:escape}:null;
    return {time:entry,normal};
}
function sweepSolidSprite(sprite,targets,dx,dy){
    const shape=spriteCollisionGeometry(sprite);if(!shape?.rectangles.length)return null;
    const path=sweptBounds(shape,dx,dy);let earliest=null;
    for(const target of targets){
        const points=spriteCorners(target),bounds={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.min(...points.map(p=>p.y)),top:Math.max(...points.map(p=>p.y))};
        if(!collisionBoundsOverlap(path,bounds))continue;
        const obstacle=spriteCollisionGeometry(target);if(!obstacle||!collisionBoundsOverlap(path,obstacle))continue;
        const axes=[...shape.axes,...obstacle.axes];
        for(const a of shape.rectangles)for(const b of obstacle.rectangles){
            const hit=sweepSolidRect(a,b,axes,dx,dy);
            if(hit&&(!earliest||hit.time<earliest.time))earliest={...hit,target};
        }
    }
    return earliest;
}
function moveSpriteWithSolids(sprite,x,y,c=null){
    const state=sprite.solidCollision;state.blocked=false;state.contacts=[];
    const dx=x-sprite.x,dy=y-sprite.y;
    if(!state.enabled||!sensingTarget(sprite)||(!dx&&!dy)){sprite.x=x;sprite.y=y;return;}
    const targets=solidObstacles(sprite,c);
    if(!targets.length){sprite.x=x;sprite.y=y;return;}
    const motion=spriteMotionToWorld(sprite,dx,dy);
    const first=sweepSolidSprite(sprite,targets,motion.x,motion.y);
    if(!first){sprite.x=x;sprite.y=y;return;}
    const apply=(hit,vx,vy)=>{
        const distance=Math.hypot(vx,vy),time=hit?Math.max(0,hit.time-SOLID_SKIN/distance):1;
        const native=spriteMotionFromWorld(sprite,vx,vy);sprite.x+=native.x*time;sprite.y+=native.y*time;
        if(hit){state.blocked=true;state.contacts.push(hit.target.isClone?hit.target.cloneIdName:hit.target.name);}
    };
    apply(first,motion.x,motion.y);
    // Project the remaining motion along the contact surface. A second sweep
    // prevents sliding through another wall at corners; no gravity is applied.
    const remain=1-first.time,n=first.normal,dot=(motion.x*n.x+motion.y*n.y)*remain;
    const slideX=motion.x*remain-n.x*dot,slideY=motion.y*remain-n.y*dot;
    if(Math.hypot(slideX,slideY)>SOLID_SKIN)apply(sweepSolidSprite(sprite,targets,slideX,slideY),slideX,slideY);
    state.contacts=[...new Set(state.contacts)];
}
