// Pinned Blockly 13 renderer extension: align body labels to the child's first row.
export const BLOCK_WRAP_WIDTH=800;
const installed=new WeakSet();
export function installRenderer(Blockly){
    if(installed.has(Blockly))return;installed.add(Blockly);
    class RenderInfo extends Blockly.zelos.RenderInfo{
        shouldStartNewRow_(input,previous){
            if(super.shouldStartNewRow_(input,previous))return true;
            if(!input.name.startsWith('ARG')||!this.block_.getInputsInline())return false;
            const row=this.inputRows.at(-1);if(!row?.elements.length)return false;
            const upcoming=input.fieldRow.map(field=>new Blockly.blockRendering.Field(this.constants_,field,input));
            upcoming.push(new Blockly.blockRendering.InlineInput(this.constants_,input));
            const elements=[...row.elements,...upcoming];let width=40,prior=null;
            for(const element of elements){width+=this.getInRowSpacing_(prior,element)+element.width;prior=element;}
            width+=this.getInRowSpacing_(prior,null);
            // Wrap between complete arguments; never split a value or reporter.
            return width>BLOCK_WRAP_WIDTH;
        }

        getElemCenterline_(row,element){
            if(row.hasStatement&&Blockly.blockRendering.Types.isField(element)){
                const child=row.getLastInput()?.connectedBlock;
                const field=child?.getInput('TITLE')?.fieldRow[0];
                const transform=field?.getSvgRoot()?.getAttribute('transform');
                const match=transform?.match(/translate\([^,]+,\s*([\d.-]+)/);
                if(match){const previous=child.previousConnection?.getOffsetInBlock().y??0;return row.yPos+Number(match[1])+field.getSize().height/2-previous;}
            }
            return super.getElemCenterline_(row,element);
        }
    }
    class Renderer extends Blockly.zelos.Renderer{makeRenderInfo_(block){return new RenderInfo(this,block);}}
    Blockly.blockRendering.register('jscratch',Renderer);
}
