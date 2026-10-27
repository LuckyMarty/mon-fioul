import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function start(dbPath) {
  const child=spawn(process.execPath,['server/index.js'], {env:{...process.env,DB_PATH:dbPath,PORT:'0',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
  let logs=''; child.stderr.on('data',d=>logs+=d);
  return await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{child.kill();reject(new Error('Server startup timeout: '+logs))},10000);
    child.once('exit',code=>{clearTimeout(timeout);reject(new Error('Server exited: '+code+' '+logs))});
    child.stdout.on('data',d=>{const match=String(d).match(/disponible sur :(\d+)/);if(match){clearTimeout(timeout);resolve({child,url:'http://127.0.0.1:'+match[1]})}});
  });
}
async function stop(child){const done=once(child,'exit');child.kill();await done;}
test('legacy SQLite upgrade preserves history; prices validate, persist and update without changing stock', async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'fioul-test-')); const file=path.join(dir,'legacy.db');
  let running;
  try {
    const db=new Database(file);
    db.exec(`CREATE TABLE tanks(id INTEGER PRIMARY KEY,label TEXT,position INTEGER,capacity REAL,initial_level REAL);
      CREATE TABLE actions(id INTEGER PRIMARY KEY,type TEXT,date TEXT,volume REAL,from_tank_id INTEGER,to_tank_id INTEGER,note TEXT,created_at TEXT);
      INSERT INTO tanks VALUES(1,'A',0,1000,0),(2,'B',1,1000,500);
      INSERT INTO actions VALUES(1,'delivery','2026-01-01',100,NULL,1,'ancienne livraison','2026-01-01');`);
    db.close();
    running=await start(file);
    const request=async(route,method='GET',body)=>{const res=await fetch(running.url+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,body:await res.json()}};
    let result=await request('/api/state');
    assert.equal(result.body.actions[0].purchase_price_cents,null);
    assert.equal(result.body.actions[0].note,'ancienne livraison');
    result=await request('/api/actions/1/price','PATCH',{purchasePrice:'120,50'});
    assert.equal(result.body.actions[0].purchase_price_cents,12050);
    assert.equal(result.body.tanks[0].level,100);
    assert.equal((await request('/api/actions/1/price','PATCH',{purchasePrice:'-1'})).status,400);
    assert.equal((await request('/api/actions','POST',{type:'delivery',date:'2026-02-01',volume:50,toTankId:1,purchasePrice:'1.234'})).status,400);
    result=await request('/api/actions','POST',{type:'delivery',date:'2026-02-01',volume:50,toTankId:1,purchasePrice:'60.25'});
    assert.equal(result.status,201); assert.equal(result.body.actions[0].purchase_price_cents,6025);
    result=await request('/api/actions','POST',{type:'transfer',date:'2026-03-01',volume:50,fromTankId:2,toTankId:1,purchasePrice:'100'});
    const transfer=result.body.actions[0]; assert.equal(transfer.purchase_price_cents,null);
    assert.equal((await request(`/api/actions/${transfer.id}/price`,'PATCH',{purchasePrice:10})).status,400);
    await stop(running.child); running=await start(file);
    result=await request('/api/state'); assert.equal(result.body.actions.find(a=>a.id===1).purchase_price_cents,12050);
    assert.equal(result.body.tanks[0].level,200);
    result=await request('/api/actions/1/price','PATCH',{purchasePrice:''});
    assert.equal(result.body.actions.find(a=>a.id===1).purchase_price_cents,null);
    // A cuve with history must never silently accept a changed opening level.
    assert.equal((await request('/api/tanks/1','PATCH',{initialLevel:20})).status,400);
    result=await request('/api/tanks','POST',{label:'D',capacity:1000,initialLevel:800});
    const added=result.body.tanks.at(-1);
    // Capacity and opening level can be reduced together before any movement.
    result=await request(`/api/tanks/${added.id}`,'PATCH',{label:'Réserve',capacity:500,initialLevel:250});
    assert.equal(result.status,200);
    assert.equal(result.body.tanks.find(t=>t.id===added.id).level,250);
    assert.equal((await request(`/api/tanks/${added.id}`,'PATCH',{capacity:100,initialLevel:200})).status,400);
    assert.equal((await request('/api/tanks/1','DELETE')).status,400);
    assert.equal((await request(`/api/tanks/${added.id}`,'DELETE')).status,200);

  } finally {if(running) await stop(running.child);await rm(dir,{recursive:true,force:true})}
});
