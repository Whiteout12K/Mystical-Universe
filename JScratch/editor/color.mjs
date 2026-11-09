const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
export function rgbToHsv(r,g,b,a=1){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;}return {h,s:max?d/max:0,v:max,a:clamp(a,0,1)};}
export function hsvToRgb({h,s,v,a=1}){h=((Number(h)%360)+360)%360;s=clamp(s,0,1);v=clamp(v,0,1);const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return {r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255),a:clamp(a,0,1)};}
export function colorCss(hsv){const {r,g,b,a}=hsvToRgb(hsv);return a>=1?'#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''):`rgba(${r}, ${g}, ${b}, ${Math.round(a*1000)/1000})`;}
export function parseColor(text){
    let match=String(text).trim().match(/^#([0-9a-f]{3,8})$/i);
    if(match){let hex=match[1];if(hex.length===3||hex.length===4)hex=[...hex].map(c=>c+c).join('');if(hex.length!==6&&hex.length!==8)return null;return rgbToHsv(parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),hex.length===8?parseInt(hex.slice(6,8),16)/255:1);}
    match=String(text).trim().match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
    if(match)return rgbToHsv(...match.slice(1,4).map(n=>clamp(n,0,255)),match[4]===undefined?1:clamp(match[4],0,1));return null;
}
