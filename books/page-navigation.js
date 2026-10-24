// Pagination numbers are layout-dependent; never substitute text-location estimates.
export function edgeDirection(x,width){
 const edge=width<=600?width*.24:Math.min(200,width*.18);
 return x>=0&&x<=edge?-1:x<=width&&x>=width-edge?1:0;
}
export function wholeBookPage(counts,section,page){
 if(!Array.isArray(counts)||!counts.length||counts.some(n=>!Number.isInteger(n)||n<1)||!Number.isInteger(section)||section<0||section>=counts.length)return null;
 const local=Math.max(1,Math.min(counts[section],Math.floor(Number(page)||1)));
 return {page:counts.slice(0,section).reduce((sum,n)=>sum+n,0)+local,total:counts.reduce((sum,n)=>sum+n,0)};
}

// Small finger movement is a tap; dragging vertically or holding selects text.
export function touchAction(dx,dy,elapsed){
 if(elapsed<0||elapsed>650)return null;
 if(Math.abs(dx)<=16&&Math.abs(dy)<=16)return 'tap';
 if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)return dx<0?'next':'previous';
 return null;
}
