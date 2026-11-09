import {argumentPicker,stringLiteral,namedPicker} from './symbols.mjs';
import {parseColor,colorCss,hsvToRgb} from './color.mjs';
const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
export function smartFieldClass(Blockly,catalog,getLibrary){
    const definitions=new Map(catalog.map(d=>['js_'+d.name+(d.reporter?'_value':''),d]));
    function context(field){
        const block=field.getSourceBlock(),parent=block?.getParent(),def=parent&&definitions.get(parent.type);if(!def)return null;
        const index=parent.inputList.findIndex(input=>input.name.startsWith('ARG')&&input.connection?.targetBlock()===block);
        const input=parent.inputList[index];if(!input)return null;const arg=Number(input.name.slice(3));
        const read=i=>{const child=parent.getInputTargetBlock('ARG'+i);return child?.type==='js_expression'?stringLiteral(child.getFieldValue('VALUE')):null;};
        let owner=null;for(let ancestor=parent;ancestor;ancestor=ancestor.getParent())if(ancestor.type==='js_whenClone'){owner=stringLiteral(ancestor.getInputTargetBlock('ARG0')?.getFieldValue('VALUE')??'');break;}
        const spec=argumentPicker(def,arg,read,owner);
        // Computed targets have no statically knowable private name collection.
        return ['costume','spriteVar'].includes(spec?.kind)&&['@dynamic','@self'].includes(spec.scope)?null:spec;
    }
    return class SmartValueField extends Blockly.FieldTextInput{
        getText(){const raw=String(this.getValue()??'');try{const spec=context(this),value=stringLiteral(raw);return spec&&value!==null?(value||'(none)')+' ▾':raw;}catch{return raw;}}
        showEditor_(){
            const spec=context(this);if(!spec){super.showEditor_();return;}
            Blockly.DropDownDiv.getContentDiv();Blockly.DropDownDiv.clearContent();const content=Blockly.DropDownDiv.getContentDiv();Blockly.DropDownDiv.setColour('#292b34','#414450');
            const panel=element('div','smart-field'),advanced=()=>{Blockly.DropDownDiv.hideIfOwner(this,true);super.showEditor_();};content.append(panel);
            if(spec.kind==='color')this.colorPanel(panel,advanced);
            else this.choicePanel(panel,spec,advanced);
            Blockly.DropDownDiv.showPositionedByField(this,()=>{if(this.colorGroup){Blockly.Events.setGroup(false);this.colorGroup=false;}});
            panel.querySelector('input')?.focus({preventScroll:true});
        }
        choicePanel(panel,spec,advanced){
            const library=getLibrary(),named=namedPicker(spec),current=spec.kind==='boolean'?String(this.getValue()):stringLiteral(this.getValue());
            panel.append(element('div','smart-heading',named?(spec.kind==='spriteVar'?'Sprite var':spec.kind[0].toUpperCase()+spec.kind.slice(1))+(spec.scope?' · '+(spec.scope==='@stage'?'Stage':spec.scope):''):'Choose value'));
            const search=element('input','smart-search');search.placeholder=named?'Find or add a name…':'Find a value…';search.setAttribute('aria-label','Find or add value');
            const list=element('div','smart-options'),footer=element('div','smart-footer'),add=element('button','smart-add',named?'+ Add new':'+ Use text'),code=element('button','smart-code','Expression…');footer.append(add,code);panel.append(search,list,footer);code.onclick=advanced;
            const choose=value=>{this.setValue(spec.kind==='boolean'?String(value):JSON.stringify(value));Blockly.DropDownDiv.hideIfOwner(this,true);this.forceRerender();};
            let cachedChoices=null;
            const draw=(refresh=false)=>{
                const choices=cachedChoices&&!refresh?[...cachedChoices]:spec.kind==='boolean'?['true','false']:spec.kind==='choice'?spec.options.map(String):library?.names(spec)??[];
                if(spec.kind==='costume'&&!choices.includes(''))choices.unshift('');
                cachedChoices=[...choices];
                if(current!==null&&!choices.includes(current))choices.unshift(current);
                const query=search.value.trim().toLowerCase();list.replaceChildren();
                for(const value of choices.filter(value=>value.toLowerCase().includes(query))){
                    const row=element('div','smart-option-row'),button=element('button','smart-option',value||'(none)');button.setAttribute('aria-pressed',String(value===current));button.onclick=()=>choose(value);row.append(button);
                    if(named&&library&&value){const usage=library.uses(spec,value),remove=element('button','smart-remove','×');remove.setAttribute('aria-label','Delete '+value);remove.disabled=usage.count>0||usage.uncertain;remove.title=usage.uncertain?'Dynamic or incomplete code prevents safe deletion.':usage.count?`${usage.count} use(s). Remove all uses before deleting.`:'Delete unused item';remove.onclick=()=>{if(library.remove(spec,value))draw(true);};row.append(remove);}
                    list.append(row);
                }
                if(!list.childElementCount)list.append(element('p','smart-empty','No matching items.'));
                add.hidden=spec.kind==='boolean';add.disabled=!search.value.trim();
            };
            const create=()=>{const value=search.value.trim();if(!value)return;if(named)library?.add(spec,value);choose(value);};
            search.oninput=()=>draw();search.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();create();}};add.onclick=create;draw();
        }
        colorPanel(panel,advanced){
            const raw=stringLiteral(this.getValue())??'#ffffff';let hsv=parseColor(raw);
            if(!hsv){const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillStyle=raw;hsv=parseColor(ctx.fillStyle)??parseColor('#ffffff');}
            panel.classList.add('smart-color');panel.append(element('div','smart-heading','Color'));
            const plane=element('div','color-plane'),cursor=element('span','color-cursor');plane.tabIndex=0;plane.setAttribute('role','slider');plane.setAttribute('aria-label','Saturation and brightness');plane.append(cursor);panel.append(plane);
            const controls={};
            for(const [key,label,max] of [['h','Hue',360],['s','Saturation',100],['v','Brightness',100],['a','Opacity',100]]){
                const row=element('label','color-control'),name=element('span','',label),range=element('input'),output=element('output');range.type='range';range.min='0';range.max=String(max);range.step='1';range.setAttribute('aria-label',label);row.append(name,range,output);panel.append(row);controls[key]={range,output};range.oninput=()=>{hsv[key]=Number(range.value)/(key==='h'?1:100);update(true);};
            }
            const preview=element('div','color-preview'),swatch=element('span','color-swatch'),code=element('code'),advancedButton=element('button','smart-code','Expression…');preview.append(swatch,code);panel.append(preview,advancedButton);advancedButton.onclick=advanced;
            const update=commit=>{
                const css=colorCss(hsv);plane.style.background=`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hsv.h},100%,50%))`;cursor.style.left=hsv.s*100+'%';cursor.style.top=(1-hsv.v)*100+'%';plane.setAttribute('aria-valuetext',`Saturation ${Math.round(hsv.s*100)}%, brightness ${Math.round(hsv.v*100)}%`);
                for(const [key,{range,output}] of Object.entries(controls)){const value=Math.round(hsv[key]*(key==='h'?1:100));range.value=String(value);output.textContent=value+(key==='h'?'°':'%');}
                swatch.style.backgroundColor=css;code.textContent=css;
                const {r,g,b}=hsvToRgb(hsv);controls.a.range.style.background=`linear-gradient(to right,transparent,rgb(${r},${g},${b}))`;
                if(commit){if(!this.colorGroup){Blockly.Events.setGroup(true);this.colorGroup=true;}this.setValue(JSON.stringify(css));}
            };
            const point=event=>{const rect=plane.getBoundingClientRect();hsv.s=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));hsv.v=1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));update(true);};
            plane.onpointerdown=event=>{plane.setPointerCapture(event.pointerId);point(event);};plane.onpointermove=event=>{if(plane.hasPointerCapture(event.pointerId))point(event);};plane.onpointerup=event=>{if(plane.hasPointerCapture(event.pointerId))plane.releasePointerCapture(event.pointerId);};
            plane.onkeydown=event=>{if(!event.key.startsWith('Arrow'))return;event.preventDefault();if(event.key==='ArrowLeft')hsv.s=Math.max(0,hsv.s-.01);if(event.key==='ArrowRight')hsv.s=Math.min(1,hsv.s+.01);if(event.key==='ArrowUp')hsv.v=Math.min(1,hsv.v+.01);if(event.key==='ArrowDown')hsv.v=Math.max(0,hsv.v-.01);update(true);};update(false);
        }
    };
}
