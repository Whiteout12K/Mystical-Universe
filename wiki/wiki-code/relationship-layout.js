/* Deterministic degree-aware layout: central hubs, nearby groups, peripheral isolates. */
window.layoutWikiRelationships = (count, edges) => {
  if (!count) return [];
  const center={x:900,y:750},degree=Array(count).fill(0);
  for(const {i,j} of edges){degree[i]++;degree[j]++;}
  const order=Array.from({length:count},(_,i)=>i).sort((a,b)=>degree[b]-degree[a]||a-b);
  const hub=order[0],maximum=Math.max(1,degree[hub]);
  const radii=degree.map((d,i)=>i===hub&&d?0:d?170+395*Math.pow(1-d/maximum,.8):625);
  // Close ties take priority over the usual degree-based outer rings.
  for(let pass=0;pass<count;pass++)for(const {i,j,close} of edges)if(close){
    radii[i]=Math.min(radii[i],radii[j]+160);
    radii[j]=Math.min(radii[j],radii[i]+160);
  }
  const points=Array(count);
  // Allocate neighboring groups to nearby sectors before relaxing the layout.
  const visited=new Set(),groups=[];
  for(const first of order){if(visited.has(first))continue;const group=[],queue=[first];visited.add(first);while(queue.length){const i=queue.shift();group.push(i);for(const edge of edges){const j=edge.i===i?edge.j:edge.j===i?edge.i:-1;if(j>=0&&!visited.has(j)){visited.add(j);queue.push(j);}}}groups.push(group);}
  let slot=0;
  for(const group of groups)for(const i of group){const angle=slot++/count*Math.PI*2-.5*Math.PI;points[i]={x:center.x+Math.cos(angle)*radii[i],y:center.y+Math.sin(angle)*radii[i]};}
  for(let step=0;step<480;step++){
    const forces=points.map(()=>({x:0,y:0}));
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      let dx=points[i].x-points[j].x,dy=points[i].y-points[j].y;
      if(Math.abs(dx)+Math.abs(dy)<.01){dx=Math.cos(i*2.4);dy=Math.sin(i*2.4);}
      const distance=Math.max(1,Math.hypot(dx,dy));
      const force=10000/(distance*distance)+Math.max(0,190-distance)*.17;
      forces[i].x+=dx/distance*force;forces[i].y+=dy/distance*force;forces[j].x-=dx/distance*force;forces[j].y-=dy/distance*force;
    }
    for(const {i,j,type,close} of edges){
      const dx=points[j].x-points[i].x,dy=points[j].y-points[i].y,distance=Math.max(1,Math.hypot(dx,dy));
      const ideal=close?160:type==='personal'?220:265;
      const force=(distance-ideal)*(close?.3:type==='personal'?.027:.018)+Math.max(0,distance-420)*.035;
      forces[i].x+=dx/distance*force;forces[i].y+=dy/distance*force;forces[j].x-=dx/distance*force;forces[j].y-=dy/distance*force;
    }
    points.forEach((point,i)=>{
      if(i===hub&&degree[i]){point.x=center.x;point.y=center.y;return;}
      const dx=point.x-center.x,dy=point.y-center.y,distance=Math.max(1,Math.hypot(dx,dy));
      const radial=(radii[i]-distance)*.065;
      forces[i].x+=dx/distance*radial;forces[i].y+=dy/distance*radial;
      const cooling=1-step/600;
      point.x+=Math.max(-7,Math.min(7,forces[i].x))*cooling;point.y+=Math.max(-7,Math.min(7,forces[i].y))*cooling;
      // Degree bands preserve the density hierarchy while allowing shorter links.
      const x=point.x-center.x,y=point.y-center.y,r=Math.max(1,Math.hypot(x,y));
      const lower=degree[i]?Math.max(150,radii[i]-65):580,upper=degree[i]?radii[i]+65:670;
      const bounded=Math.max(lower,Math.min(upper,r));point.x=center.x+x/r*bounded;point.y=center.y+y/r*bounded;
    });
  }
  return window.refineWikiRelationshipPositions(points, edges, radii, hub);
};

/* Move portraits instead of bending links. Penalize straight segments near other nodes. */
window.refineWikiRelationshipPositions = (points, edges, radii, hub) => {
  const center={x:900,y:750},minimum=56;
  function clearance(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);}
  function cost(id){
    let score=0;
    const radius=Math.hypot(points[id].x-center.x,points[id].y-center.y);
    score+=Math.pow(radius-radii[id],2)*.12;
    for(let j=0;j<points.length;j++)if(j!==id)score+=Math.pow(Math.max(0,160-Math.hypot(points[id].x-points[j].x,points[id].y-points[j].y)),2)*4;
    for(const edge of edges){
      const a=points[edge.i],b=points[edge.j];
      if(edge.i===id||edge.j===id){const length=Math.hypot(a.x-b.x,a.y-b.y);score+=edge.close?Math.pow(length-160,2)*40:Math.pow(Math.max(0,length-360),2)*.05;
        for(let k=0;k<points.length;k++)if(k!==edge.i&&k!==edge.j)score+=Math.pow(Math.max(0,minimum-clearance(points[k],a,b)),2)*1200;
      }else score+=Math.pow(Math.max(0,minimum-clearance(points[id],a,b)),2)*1200;
    }
    return score;
  }
  const distances=[60,40,24,14,8,4,2];
  for(const distance of distances)for(let sweep=0;sweep<35;sweep++){
    let moved=false;
    for(let id=0;id<points.length;id++){
      if(id===hub&&radii[id]===0)continue;
      const original={...points[id]};let best={...original},bestCost=cost(id);
      for(let direction=0;direction<16;direction++){
        const angle=direction*Math.PI/8;
        points[id]={x:Math.max(100,Math.min(1700,original.x+Math.cos(angle)*distance)),y:Math.max(100,Math.min(1400,original.y+Math.sin(angle)*distance))};
        const candidate=cost(id);if(candidate<bestCost-.01){bestCost=candidate;best={...points[id]};}
      }
      points[id]=best;if(Math.hypot(best.x-original.x,best.y-original.y)>.1)moved=true;
    }
    if(!moved)break;
  }
  return points;
};
