const PYODIDE='https://cdn.jsdelivr.net/pyodide/v0.28.3/full/';
let runtime;
const ready=(async()=>{
  self.postMessage({status:'Loading the browser runtime… The first visit takes longer; later visits use the cache.'});
  const {loadPyodide}=await import(`${PYODIDE}pyodide.mjs`);
  runtime=await loadPyodide({indexURL:PYODIDE});
  self.postMessage({status:'Loading NumPy and the frozen model weights…'});
  await runtime.loadPackage('numpy');
  const response=await fetch('duel/manifest.json');
  if(!response.ok)throw new Error('Could not read the model manifest');
  const manifest=await response.json();
  runtime.FS.mkdirTree('/duel');
  runtime.FS.writeFile('/duel/manifest.json',JSON.stringify(manifest));
  await Promise.all(Object.entries(manifest.files).map(async([name,expected])=>{
    if(!['runtime.zip','model.npz','catalog.json','parity.npz'].includes(name))throw new Error('Unknown model file');
    const response=await fetch(`duel/${name}`);
    if(!response.ok)throw new Error(`Model download failed: ${name}`);
    const data=new Uint8Array(await response.arrayBuffer());
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==expected)throw new Error(`Model integrity check failed: ${name}. Please reload the page.`);
    runtime.FS.writeFile(`/duel/${name}`,data);
  }));
  const metadata=JSON.parse(runtime.runPython(`
import sys, zipfile
with zipfile.ZipFile('/duel/runtime.zip') as archive:
    archive.extractall('/duel')
sys.path.insert(0, '/duel')
from sap_web.duel import initialize, dispatch
initialize('/duel')
`));
  self.postMessage({metadata});
})();
ready.catch(error=>self.postMessage({fatal:true,error:String(error)}));
let queue=ready;
self.onmessage=event=>{
  queue=queue.then(()=>{
    runtime.globals.set('request_json',JSON.stringify(event.data));
    const state=JSON.parse(runtime.runPython('dispatch(request_json)'));
    self.postMessage({state,id:event.data.id});
  }).catch(error=>self.postMessage({error:String(error),id:event.data.id}));
};
