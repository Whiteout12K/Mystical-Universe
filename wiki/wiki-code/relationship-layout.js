/* Deterministic degree-aware layout: central hubs, nearby groups, peripheral isolates. */
window.layoutWikiRelationships = (count, edges) => {
  if (!count) return [];
  const center={x:900,y:750},degree=Array(count).fill(0);
  for(const {i,j} of edges){degree[i]++;degree[j]++;}
  const order=Array.from({length:count},(_,i)=>i).sort((a,b)=>degree[b]-degree[a]||a-b);
  const hub=order[0],maximum=Math.max(1,degree[hub]);
  const radii=degree.map((d,i)=>i===hub&&d?0:d?150+360*Math.pow(1-d/maximum,.8):600);
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
      const force=10000/(distance*distance)+Math.max(0,170-distance)*.14;
      forces[i].x+=dx/distance*force;forces[i].y+=dy/distance*force;forces[j].x-=dx/distance*force;forces[j].y-=dy/distance*force;
    }
    for(const {i,j,type} of edges){
      const dx=points[j].x-points[i].x,dy=points[j].y-points[i].y,distance=Math.max(1,Math.hypot(dx,dy));
      const ideal=type==='personal'?200:240;
      const force=(distance-ideal)*(type==='personal'?.027:.018)+Math.max(0,distance-380)*.035;
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
      const lower=degree[i]?Math.max(130,radii[i]-65):550,upper=degree[i]?radii[i]+65:650;
      const bounded=Math.max(lower,Math.min(upper,r));point.x=center.x+x/r*bounded;point.y=center.y+y/r*bounded;
    });
  }
  return points;
};
