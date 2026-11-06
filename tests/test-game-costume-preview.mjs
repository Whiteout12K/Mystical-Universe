import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../webpages/game-c.html',import.meta.url),'utf8');
const functions=html.slice(html.indexOf('function isVideoFile('),html.indexOf('function loadCharacterStyles('));
function preview(costume){return runInNewContext(functions+'\ncreateCostumePreview(costume)',{costume,document:{createElement:tag=>({tag,style:{setProperty(k,v){this[k]=v}}})}})}
test('configured idle GIF uses its case-sensitive asset path and four-times 24 by 48 sizing',()=>{
 const roster=JSON.parse(readFileSync(new URL('../images/mlg-assets/data-character.json',import.meta.url),'utf8'));const costume=roster.c1.costume_1;assert.ok(costume);assert.ok(existsSync(new URL('..'+costume.preview_path,import.meta.url)));const image=preview(costume);assert.equal(image.tag,'img');assert.equal(image.width,24);assert.equal(image.height,48);assert.equal(image.style['--sprite-width'],'96px');assert.equal(image.style['--sprite-height'],'192px');
});
test('PNG previews support the same dimensions while existing costumes keep their display',()=>{const image=preview({preview_path:'/costume.png',preview_size:[24,48]});assert.equal(image.tag,'img');assert.equal(image.style['--sprite-height'],'192px');const old=preview({preview_path:'/costume.png'});assert.equal(old.className,'card-img-top pixel-portrait');assert.equal(old.width,undefined)});
test('video previews retain autoplay and looping',()=>{const video=preview({preview_path:'/costume.webm'});assert.equal(video.tag,'video');assert.equal(video.loop,true);assert.equal(video.muted,true)});
