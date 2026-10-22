'use strict';
process.env.PORT='0';process.env.SPIN_MS='60';process.env.ROUND_MS='90000';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {betDefinition,insideValid,server}=require('../server');
test('American inside bet validation, payouts, basket, 0 and 00',async()=>{
 assert.equal(betDefinition('straight',['00']).payout,35);
 assert.equal(betDefinition('straight',['0']).numbers[0],'0');
 assert.equal(betDefinition('basket',[]).numbers.length,5);
 assert.equal(betDefinition('basket',[]).payout,6);
 assert.equal(betDefinition('corner',['1','2','4','5']).payout,8);
 assert.equal(betDefinition('split',['1','4']).payout,17);
 assert.equal(betDefinition('sixline',['1','2','3','4','5','6']).payout,5);
 assert.ok(insideValid('street',['1','2','3']));
 assert.ok(!insideValid('corner',['1','2','3','4']));
 assert.throws(()=>betDefinition('straight',['45']),/Invalid/);
 assert.throws(()=>betDefinition('split',['0','1']),/Invalid/);
 await new Promise(resolve=>server.close(resolve));
});
