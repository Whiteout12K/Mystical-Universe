export const accents={control:'#cc8d24',motion:'#4b7dde',sprite:'#8c56c5',ui:'#269d96',operator:'#4b9c51',sensing:'#269ebc',clone:'#cc8d24',camera:'#4b7dde',lists:'#c45a89',sound:'#a450be',canvas:'#8c56c5',data:'#c45a89',json:'#c45a89',media:'#8c56c5',solid:'#b56e38','back-process':'#637dba',custom:'#686cc6'};
const fills=accents;
// Keep borders in the block's own hue so nested reporters remain distinct.
const darker=hex=>'#'+hex.slice(1).match(/../g).map(channel=>Math.round(parseInt(channel,16)*.78).toString(16).padStart(2,'0')).join('');
export function createEditorTheme(Blockly,dark){
    const blockStyles=Object.fromEntries(Object.entries(accents).map(([category,accent])=>['js_'+category,{colourPrimary:dark?fills[category]:accent,colourSecondary:dark?fills[category]:accent,colourTertiary:darker(dark?fills[category]:accent)}]));
    blockStyles.js_value={colourPrimary:'#ffffff',colourSecondary:'#ffffff',colourTertiary:'#d1d4dc'};
    blockStyles.js_code={colourPrimary:dark?'#334358':'#667e9f',colourSecondary:'#263449',colourTertiary:darker(dark?'#334358':'#667e9f')};
    return Blockly.Theme.defineTheme('jscratch_'+(dark?'dark':'light'),{base:Blockly.Themes.Classic,blockStyles,componentStyles:{workspaceBackgroundColour:dark?'#202127':'#f3f6fb',toolboxBackgroundColour:dark?'#292b34':'#ffffff',toolboxForegroundColour:dark?'#cbd5e6':'#34455e',flyoutBackgroundColour:dark?'#292b34':'#e8eef7',flyoutForegroundColour:dark?'#e4ebf8':'#34455e',flyoutOpacity:1,scrollbarColour:dark?'#53647f':'#93a7c4',scrollbarOpacity:.55,insertionMarkerColour:'#9abaff',insertionMarkerOpacity:.5,cursorColour:'#a7c5ff'},fontStyle:{family:'system-ui',weight:'500',size:12},startHats:true});
}
