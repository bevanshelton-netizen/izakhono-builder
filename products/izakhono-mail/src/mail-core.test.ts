import { MailCore } from './mail-core';

const mail = new MailCore();
const bevan = mail.createIdentity('bevan@izakhono', 'Bevan Shelton');
mail.createIdentity('admin@izakhono', 'IZAKHONO Admin');

if (bevan.address !== 'bevan@izakhono') throw new Error('identity creation failed');
if (mail.mailboxes.get(bevan.mailboxId)?.folders.length !== 6) throw new Error('standard folders missing');

const draft = mail.createDraft('bevan@izakhono', ['admin@izakhono'], 'IZAKHONO Mail Core', 'Local delivery test');
mail.submit(draft.id);
mail.processLocalDelivery(draft.id);

const inbox = mail.listMailbox('admin@izakhono');
if (inbox.length !== 1) throw new Error('local delivery failed');
if (inbox[0].subject !== 'IZAKHONO Mail Core') throw new Error('message retrieval failed');
if (mail.listMailbox('bevan@izakhono', 'SENT').length !== 1) throw new Error('sent copy missing');
if (mail.audit.length < 3) throw new Error('audit trail incomplete');

console.log('IZAKHONO MAIL CORE V1: PASS');
