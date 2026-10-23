import assert from "node:assert/strict";
import { MailEventLedger } from "./mail-events.mjs";

const ledger = new MailEventLedger({ clock: () => "2026-10-23T00:00:00.000Z" });

ledger.append({ eventId: "evt-1", messageId: "msg-1", type: "mail.queued" });
ledger.append({ eventId: "evt-2", messageId: "msg-1", type: "mail.sending" });
ledger.append({ eventId: "evt-3", messageId: "msg-1", type: "mail.accepted" });
ledger.append({ eventId: "evt-4", messageId: "msg-1", recipientId: "rcpt-1", type: "mail.delivered", occurredAt: "2026-10-23T00:00:04.000Z" });

assert.equal(ledger.getMessage("msg-1").status, "delivered");
assert.equal(ledger.listEvents("msg-1").length, 4);

const duplicate = ledger.append({ eventId: "evt-4", messageId: "msg-1", recipientId: "rcpt-1", type: "mail.delivered" });
assert.equal(duplicate.duplicate, true);
assert.equal(ledger.listEvents("msg-1").length, 4);

// A late, lower-ranked event must not regress a terminal delivery state.
ledger.append({ eventId: "evt-late", messageId: "msg-1", type: "mail.sending", occurredAt: "2026-10-23T00:00:05.000Z" });
assert.equal(ledger.getMessage("msg-1").status, "delivered");

console.log("mail-events tests passed");
