import assert from "node:assert/strict";
import {readiness,nextTutorAction} from "./readiness.mjs";

const strong=readiness({diagnostic:80,mastery:90,mock:85,recency:100,unresolvedWeakAreas:1});
assert.equal(strong.score,84);
assert.equal(nextTutorAction({correct:false,confidence:.8,attempts:2}),"tutor-video");
assert.equal(nextTutorAction({correct:false,confidence:.2,attempts:1}),"teach-from-scratch");
assert.equal(nextTutorAction({correct:true,confidence:.9,attempts:1}),"advance");
assert.match(strong.disclaimer,/not a guarantee/i);
console.log("ExamReady core tests passed");
