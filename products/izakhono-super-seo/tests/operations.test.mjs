import test from "node:test";
import assert from "node:assert/strict";
import {buildOperations,approveOperation,buildManifest} from "../operations-engine.mjs";

test("builds approval-gated commercial operation",()=>{
 const [op]=buildOperations([{query:"school uniforms price",opportunity:90,intent:"commercial"}],"izakhono.co.za");
 assert.equal(op.priority,"P1"); assert.equal(op.status,"needs_review"); assert.equal(op.publish.approved,false); assert.match(op.target_url,/school-uniforms-price/);
});

test("approval is explicit and manifest contains only approved work",()=>{
 const [op]=buildOperations([{query:"PPE suppliers",opportunity:80}],"izakhono.co.za");
 assert.equal(buildManifest([op]).count,0);
 const approved=approveOperation(op,"human-reviewer");
 const manifest=buildManifest([approved]);
 assert.equal(manifest.count,1); assert.equal(manifest.items[0].id,op.id);
});

test("rejects approving an already approved operation",()=>{
 const [op]=buildOperations([{query:"workwear",opportunity:60}],"izakhono.co.za");
 const approved=approveOperation(op,"human");
 assert.throws(()=>approveOperation(approved,"human"),/not awaiting review/);
});
