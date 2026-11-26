import assert from "node:assert/strict";
import { validIsbn13 } from "./index.js";

assert.equal(validIsbn13("9780306406157"), true, "known valid ISBN-13");
assert.equal(validIsbn13("978-0-306-40615-7"), true, "hyphenated ISBN-13");
assert.equal(validIsbn13("9780306406158"), false, "incorrect checksum");
assert.equal(validIsbn13("9791090636071"), true, "valid 979 ISBN-13");
assert.equal(validIsbn13("978030640615"), false, "too short");
assert.equal(validIsbn13("9770306406157"), false, "non-book EAN prefix");
assert.equal(validIsbn13("978030640615X"), false, "non-numeric check digit");

console.log("ISBN-13 validation tests passed (7 assertions).");
