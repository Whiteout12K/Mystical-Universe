// Palette previews have their own scale; dragged copies use the canvas scale.
export const PALETTE_SCALE=.8;
export function palettePlugins(Blockly){
    class FixedScaleFlyout extends Blockly.VerticalFlyout{
        // Explicit panel controls own visibility, so workspace zoom does not close it.
        constructor(options){super(options);this.autoClose=false;}
        getFlyoutScale(){return PALETTE_SCALE;}
    }
    return {flyoutsVerticalToolbox:FixedScaleFlyout};
}
