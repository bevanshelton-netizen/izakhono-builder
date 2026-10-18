import assert from 'node:assert/strict';
import { createNodeControlApi } from './services/node-control-api.mjs';

const store = {
  contract:{persistence:'supabase'},
  nodes:new Map(),
  events:[],
  async read(id){return {ok:true,node:this.nodes.get(id)||null};},
  async listReady(){return {ok:true,nodes:[...this.nodes.values()].filter(n=>n.state==='ready'&&n.health==='healthy'&&n.security_posture==='ready')};},
  async upsert(node){this.nodes.set(node.node_id,structuredClone(node));return {ok:true,node};},
  async appendEvent(event){this.events.push(event);return {ok:true};}
};
const api=createNodeControlApi({store,controlToken:'control-secret',nodeTokens:JSON.stringify({'node-01':'node-secret'})});
assert.equal(api.store,store);
assert.equal(api.control.contract.persistence,'supabase');
const r=await api.control.register({authorization:'Bearer control-secret'},{node:{node_id:'node-01',health:'healthy',security_posture:'ready'}});
assert.equal(r.ok,true);
const h=await api.control.heartbeat({authorization:'Bearer node-secret'},{node_id:'node-01',health:'healthy'});
assert.equal(h.ok,true);
assert.equal(h.node.state,'ready');
console.log('NODE_CONTROL_API_TEST=PASS');
