// Palette previews have their own scale; dragged copies use the canvas scale.
export const PALETTE_SCALE=.8;
export function palettePlugins(Blockly){
    class FixedScaleFlyout extends Blockly.VerticalFlyout{
        // Explicit panel controls own visibility, so workspace zoom does not close it.
        constructor(options){super(options);this.autoClose=false;}
        getFlyoutScale(){return PALETTE_SCALE;}
        getX(){return super.getX()+12;}
        getY(){return super.getY()+98;}
        position(){
            if(!this.isVisible()||!this.targetWorkspace.isVisible())return;
            // Float the palette below the controls without shrinking the canvas.
            const view=this.targetWorkspace.getMetricsManager().getViewMetrics();
            this.height_=Math.max(1,view.height-151);
            this.setBackgroundPath(this.getWidth()-this.CORNER_RADIUS,Math.max(1,this.height_-2*this.CORNER_RADIUS));
            this.positionAt_(this.getWidth(),this.getHeight(),this.getX(),this.getY());
        }
    }
    return {flyoutsVerticalToolbox:FixedScaleFlyout};
}
