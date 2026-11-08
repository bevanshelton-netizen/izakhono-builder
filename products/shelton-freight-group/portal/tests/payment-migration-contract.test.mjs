import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const sql=readFileSync(join(root,"supabase/migrations/202611070007_sfg_payment_intents.sql"),"utf8");
test("payment confirmation requires a verified matching provider event",()=>{
  assert.match(sql,/signature_verified\s*=\s*true/i);
  assert.match(sql,/external_transaction_id\s+is\s+not\s+distinct\s+from\s+p_external_transaction_id/i);
  assert.match(sql,/provider_paylink_id\s+is\s+not\s+distinct\s+from\s+p_paylink_id/i);
  assert.match(sql,/event_status\s+is\s+not\s+distinct\s+from\s+p_provider_status/i);
  assert.match(sql,/response_code\s+is\s+not\s+distinct\s+from\s+p_response_code/i);
  assert.match(sql,/if\s+not\s+found\s+then\s+raise\s+exception\s+'Verified matching iKhokha event not found'/i);
});
test("payment migration is one transaction through its final grant",()=>{
  assert.equal((sql.match(/\bbegin;/gi)||[]).length,1);
  assert.equal((sql.match(/\bcommit;/gi)||[]).length,1);
  assert.ok(sql.lastIndexOf("commit;")>sql.lastIndexOf("grant execute on function public.sfg_confirm_ikhokha_payment"));
});
