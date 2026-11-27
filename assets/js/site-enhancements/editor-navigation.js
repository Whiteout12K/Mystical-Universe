// Authoring shortcuts are shown on localhost, including loopback and .localhost hosts.
export function isLocalEditorHost(hostname){return /^(localhost|.*\.localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(hostname||'');}
export const editorLinks=[
 {label:'Wiki Editor',href:'/wiki/wiki-editor/index.html'},
 {label:'Relations Edit',href:'/wiki/wiki-editor/relations.html'},
 {label:'Skill Editor',href:'/webpages/apps/skill_editor.html'},
 {label:'JScratch Editor',href:'/JScratch/editor/index.html'},
 {label:'Info Export',href:'/webpages/info-export/info-export.html'},
 {label:'Profile Card Maker',href:'/webpages/apps/tcg/card_maker.html'}
];
