// Load once before wiki rendering so every consumer uses the same saved data.
window.wikiRelationsReady=(async()=>{
 try{
  const {createRelationsStore}=await import('/wiki/wiki-code/relations-data.js');
  const response=await fetch('/wiki/relations.json',{cache:'no-cache'});
  if(!response.ok)throw Error('The shared relationships could not load. Please refresh.');
  window.wikiRelations=createRelationsStore(await response.json());
 }catch(error){window.wikiRelationsError=error.message;console.error(error);}
})();
