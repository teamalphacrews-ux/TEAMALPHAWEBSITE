import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, Fragment } from 'react';
import { selectOptions } from '../src/admin/components/common/selectOptions.js';
test('select options preserve values and human labels across fragments and groups', () => {
  assert.deepEqual(selectOptions([
    h('option',{value:''},'Choose a client'),
    h(Fragment,null,h('option',{value:42},'Maya & Aditya')),
    h('optgroup',{label:'Enquiries'},h('option',{value:'lead-1'},'Riya'))
  ]), [
    {value:'',label:'Choose a client',group:'',disabled:false},
    {value:'42',label:'Maya & Aditya',group:'',disabled:false},
    {value:'lead-1',label:'Riya',group:'Enquiries',disabled:false}
  ]);
});
test('disabled groups stay disabled and implicit option values match native labels', () => {
 assert.deepEqual(selectOptions(h('optgroup',{label:'Archived',disabled:true},h('option',null,'Completed'))),[{value:'Completed',label:'Completed',group:'Archived',disabled:true}]);
 assert.equal(selectOptions(h('option',{value:'x',disabled:true},'Unavailable'))[0].disabled,true);
});
test('conditional children do not create selectable empty rows', () => {
 assert.deepEqual(selectOptions([false,null,h('option',{value:'zero'},0)]),[{value:'zero',label:'0',group:'',disabled:false}]);
});

test('mixed option text keeps names, separators and record counts visible',()=>{
 assert.equal(selectOptions(h('option',{value:'all'},'All enquiries',' · ',9))[0].label,'All enquiries · 9');
 assert.equal(selectOptions(h('option',{value:'client'},'Maya',' ','Aditya'))[0].label,'Maya Aditya');
});
