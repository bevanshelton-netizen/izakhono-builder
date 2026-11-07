'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'hey-nav-runtime.js'), 'utf8');

let recognitionStarts = 0;
let recognitionStops = 0;
class FakeRecognition {
  start() { recognitionStarts += 1; if (this.onstart) this.onstart(); }
  stop() { recognitionStops += 1; if (this.onend) this.onend(); }
}
class FakeUtterance { constructor(text) { this.text = text; } }
const events = [];
const root = {
  SpeechRecognition: FakeRecognition,
  navigator: { language: 'en-ZA', serviceWorker: null },
  document: { querySelector: () => ({}), createElement: () => ({}), head: { appendChild() {} } },
  speechSynthesis: {
    cancel() {},
    speak(utterance) { if (utterance.onstart) utterance.onstart(); if (utterance.onend) utterance.onend(); }
  },
  SpeechSynthesisUtterance: FakeUtterance,
  setTimeout(fn) { fn(); },
  dispatchEvent(event) { events.push(event); },
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }
};
const context = { window: root, globalThis: root, CustomEvent: root.CustomEvent, console, Math, Date };
vm.runInNewContext(source, context, { filename: 'hey-nav-runtime.js' });

assert.equal(recognitionStarts, 0, 'loading NAV must not start microphone recognition');
assert.equal(typeof root.IZAKHONO_NAV_VOICE.startWakeListener, 'undefined', 'continuous wake listener must not be exposed');
root.IZAKHONO_NAV_VOICE.activateByTap();
assert.equal(recognitionStarts, 1, 'explicit voice-button activation starts one recognition session');
(async () => {
  await root.IZAKHONO_NAV_VOICE.ask('hello NAV');
  assert.equal(recognitionStarts, 1, 'speaking a reply must not silently reopen the microphone');
  root.IZAKHONO_NAV_VOICE.endSession();
assert.equal(recognitionStops, 1, 'ending the session stops recognition');
assert.equal(recognitionStarts, 1, 'ending a session must not re-arm the microphone');
assert.equal(root.IZAKHONO_NAV_VOICE.state.active, false);
  console.log('Hey NAV tap-only microphone tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
