'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.PORT='0';
const {server,betDefinition} = require('../server');

test('wheel dozens and ABC columns are identical to their actual accepted bet groups',async()=>{
 try {
  const colToBet={A:'col2',B:'col1',C:'col0'};
  for(let n=1;n<=36;n++){
   const pocket=String(n),letter='ABC'[(n-1)%3],dozen=Math.ceil(n/12);
   const actualColumn=betDefinition(colToBet[letter],[]).numbers;
   const actualDozen=betDefinition('dozen'+dozen,[]).numbers;
   assert.ok(actualColumn.includes(pocket),`column ${letter} should cover ${pocket}`);
   assert.ok(actualDozen.includes(pocket),`dozen ${dozen} should cover ${pocket}`);
  }
  for(const id of ['col0','col1','col2','dozen1','dozen2','dozen3']){
   const group=betDefinition(id,[]).numbers;
   assert.ok(!group.includes('0'),`${id} must not include 0`);
   assert.ok(!group.includes('00'),`${id} must not include 00`);
  }
 } finally {
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }
});
