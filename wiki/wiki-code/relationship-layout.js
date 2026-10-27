/* Bond distances are soft targets: labels and portraits always have room. */
window.layoutWikiRelationships = async (count, edges, bounds=[]) => {
  if(!count)return [];
  const boxes=Array.from({length:count},(_,i)=>bounds[i]||{x:-65,y:-38,width:130,height:108});
  const target=edge=>edge.close?150:edge.former?365:edge.loveInterest?180:edge.type==='personal'?285:450;
  const links=Array.from({length:count},()=>[]),distances=Array.from({length:count},(_,i)=>Array.from({length:count},(_,j)=>i===j?0:Infinity));
  for(const edge of edges){const length=target(edge);links[edge.i].push(edge);links[edge.j].push(edge);distances[edge.i][edge.j]=distances[edge.j][edge.i]=length;}
  // Graph distance keeps extended families together without pinning them to rings.
  for(let k=0;k<count;k++)for(let i=0;i<count;i++)for(let j=0;j<count;j++)distances[i][j]=Math.min(distances[i][j],distances[i][k]+distances[k][j]);
  const points=Array(count),seen=new Set();let cluster=0;
  // Seed immediate family/spirit groups together, so collision resolution does
  // not trap a parent on the far side of an unrelated cluster.
  const order=Array.from({length:count},(_,i)=>i).sort((a,b)=>links[b].filter(e=>e.close).length-links[a].filter(e=>e.close).length||a-b);
  for(const root of order){
    if(seen.has(root))continue;
    const angle=cluster*2.399963229728653,r=380*Math.sqrt(cluster++),origin={x:Math.cos(angle)*r,y:Math.sin(angle)*r};
    const queue=[root];seen.add(root);points[root]={...origin};
    for(let cursor=0;cursor<queue.length;cursor++){
      const i=queue[cursor],children=links[i].filter(edge=>edge.close).map(edge=>edge.i===i?edge.j:edge.i).filter(j=>!seen.has(j));
      children.forEach((j,k)=>{seen.add(j);const theta=angle+(k+.5)/Math.max(1,children.length)*Math.PI*2;points[j]={x:points[i].x+Math.cos(theta)*160,y:points[i].y+Math.sin(theta)*160};queue.push(j);});
    }
  }
  const weakDegree=links.map(list=>Math.max(1,list.filter(edge=>!edge.close).length));
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  for(let step=0;step<260;step++){
    const forces=points.map(()=>({x:0,y:0}));
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      const a=points[i],b=points[j];let dx=b.x-a.x,dy=b.y-a.y;
      if(Math.abs(dx)+Math.abs(dy)<.01){dx=Math.cos(i+j);dy=Math.sin(i+j);}
      const length=Math.max(1,Math.hypot(dx,dy)),ideal=Number.isFinite(distances[i][j])?Math.min(1100,distances[i][j]):1250;
      // Weak graph-wide stress separates unrelated groups, without overwhelming
      // direct family/spiritual springs when many affiliations are documented.
      const pull=(length-ideal)*.012*Math.pow(150/ideal,1.3)-1800/(length*length);
      forces[i].x+=dx/length*pull;forces[i].y+=dy/length*pull;forces[j].x-=dx/length*pull;forces[j].y-=dy/length*pull;
    }
    for(const edge of edges){
      const {i,j}=edge,dx=points[j].x-points[i].x,dy=points[j].y-points[i].y,length=Math.max(1,Math.hypot(dx,dy));
      const strength=edge.close?.38:edge.loveInterest&&!edge.former?.28:(edge.type==='personal'?.08:.035)/Math.sqrt(Math.max(weakDegree[i],weakDegree[j]));
      const pull=(length-target(edge))*strength;
      forces[i].x+=dx/length*pull;forces[i].y+=dy/length*pull;forces[j].x-=dx/length*pull;forces[j].y-=dy/length*pull;
    }
    const limit=step<180?12:Math.max(.6,12*(260-step)/80);
    points.forEach((point,i)=>{point.x+=Math.max(-limit,Math.min(limit,forces[i].x));point.y+=Math.max(-limit,Math.min(limit,forces[i].y));});
    // Resolve measured label rectangles locally; never enlarge the entire graph
    // because one pair of names overlaps. Recheck after every relaxation step.
    for(let pass=0;pass<2;pass++)for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      const a=boxes[i],b=boxes[j],p=points[i],q=points[j];
      const dx=(q.x+b.x+b.width/2)-(p.x+a.x+a.width/2),dy=(q.y+b.y+b.height/2)-(p.y+a.y+a.height/2);
      const overlapX=(a.width+b.width)/2+18-Math.abs(dx),overlapY=(a.height+b.height)/2+18-Math.abs(dy);
      if(overlapX>0&&overlapY>0){if(overlapX<overlapY){const move=(Math.sign(dx)||1)*(overlapX+.1)/2;p.x-=move;q.x+=move;}else{const move=(Math.sign(dy)||1)*(overlapY+.1)/2;p.y-=move;q.y+=move;}}
    }
    if(step%12===11)await pause();
  }
  // Finish collision resolution without introducing fresh spring movement.
  for(let pass=0;pass<80;pass++){
    let moved=false;
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      const a=boxes[i],b=boxes[j],p=points[i],q=points[j],dx=q.x+b.x+b.width/2-p.x-a.x-a.width/2,dy=q.y+b.y+b.height/2-p.y-a.y-a.height/2;
      const x=(a.width+b.width)/2+18-Math.abs(dx),y=(a.height+b.height)/2+18-Math.abs(dy);
      if(x>0&&y>0){moved=true;if(x<y){const d=(Math.sign(dx)||1)*(x+.1)/2;p.x-=d;q.x+=d;}else{const d=(Math.sign(dy)||1)*(y+.1)/2;p.y-=d;q.y+=d;}}
    }
    if(!moved)break;
    if(pass%12===11)await pause();
  }
  return points;
};
