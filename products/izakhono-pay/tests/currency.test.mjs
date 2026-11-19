import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {currencyExponent,toMinorUnits,fromMinorUnits,formatMinorUnits} from '../src/currency.js';

test('currency exponent follows zero-, two- and three-decimal currencies',()=>{
 assert.equal(currencyExponent('JPY'),0);
 assert.equal(currencyExponent('ZAR'),2);
 assert.equal(currencyExponent('KWD'),3);
});
test('decimal conversion is exact in integer minor units',()=>{
 assert.equal(toMinorUnits('123.45','ZAR'),12345);
 assert.equal(toMinorUnits('123','JPY'),123);
 assert.equal(toMinorUnits('12.345','KWD'),12345);
 assert.equal(fromMinorUnits(12345,'KWD'),12.345);
});
test('rejects unknown currencies and excessive decimal precision',()=>{
 assert.throws(()=>currencyExponent('ZZZ'),/unsupported_currency_code/);
 assert.throws(()=>toMinorUnits('1.001','ZAR'),/currency_precision_exceeded/);
 assert.throws(()=>toMinorUnits('1.2','JPY'),/currency_precision_exceeded/);
});
test('rejects unsafe, negative, malformed and fractional minor units',()=>{
 for(const value of ['-1','1e3','01.00','1.2.3',''])assert.throws(()=>toMinorUnits(value,'ZAR'));
 assert.throws(()=>toMinorUnits('9007199254740992','ZAR'),/safe_integer/);
 assert.throws(()=>fromMinorUnits(1.5,'ZAR'),/invalid_minor_unit_amount/);
});
test('formats amount using currency-specific exponent',()=>{
 assert.match(formatMinorUnits(12345,'ZAR'),/123/);
 assert.match(formatMinorUnits(123,'JPY'),/123/);
});
