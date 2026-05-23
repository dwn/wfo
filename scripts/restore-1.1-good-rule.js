#!/usr/bin/env node
/** Restore rule 1.1 to last known-good state (backticks on, before broken shift-up). */
const fs = require('fs');
const path = require('path');

const BT = '\u0060';
const goodRule = [
  `A,.d4|R2U3|R2D3.l3u1|R2.r2u2^${BT} B,.d1|D3|R3)UR1(L1U1|L3.u1|R3)R1D1|L1.r2u1^${BT} C,.d1.r4|L3)L1D1|D1(R1D1|R3.r1u3^${BT} D,.d1|D3|R3)UR1|U1(L1U1|L3.r4.r1^${BT} E,.d1.r4|L4|D3|R4.l3u2.l1|R3.r2u1^${BT} F,.d1|R4.l4|D3.u2|R3.r2u1^${BT} G,.d1.r4d1(L1U1|L2)L1D1|D1(R1D1|R3|U1|L2.r3u2^${BT} H,.d1|D3.r4u3|D3.l3u2.l1|R4.r1u1^${BT} I,.d1|R4.l2|D3.l2|R4.r1u3^${BT} J,.d1.r4|D2(L1D1|L2)L1U1.r4u2.r1^${BT} K,.d1|D3.r4u3|L3D1|L1|R4D2.r1u3^${BT} L,.d1|D3|R4.r1u3^${BT} M,.d1.d3|U3|R2D1|R2U1|D3.r1u3^${BT} N,.d1.d3|U3|R4D3|U3.r1^${BT} O,.d1.r1|R2)R1D1|D1(L1D1|L2)L1U1|U1(UR1.r4^${BT} P,.d1.d3|U3|R3)R1D1(L1D1|L3.r4u2.r1^${BT} Q,.d1.r1|R2)R1D1|D1(L1D1|L2)L1U1|U1(UR1.r1d2|R2D1.r1u3^${BT} R,.d1.d3|U3|R3)R1D1(L1D1|L3.r2|R2D1.r1u3^${BT} S,.d1.r4|L3)L1D1(R1D1|R2)R1D1|L4.r4u3.r1^${BT} T,.d1|R4.l2|D3.r3u3^${BT} U,.d1|D2(R1D1|R2)UR1|U2.r1^${BT} V,.d1|R2D3|R2U3.r1^${BT} W,.d1|R1D3|R1U2|R1D2|R1U3.r1^${BT} X,.d1|R4D3.u3|L3D3|L1.r4u3.r1^${BT} Y,.d1|R2D1|R2U1.l2d1|D2.r3u3^${BT} Z,.d1|R4|L3D3|L1|R4.r1u3^${BT}`,
  `a,.r4d2(L1U1|L2)L1D1|D1(R1D1|R2)UR1|U2|D3.r1u3.u1^${BT} b,|D4|R2)R2U1|U1(L2U1|L2D1.r4u2.r1^${BT} c,.r4d1|L3)L1D1|D1(R1D1|R3.r1u3.u1^${BT} d,.r4|D4|L2)L2U1|U1(R2U1|R2D1.r1u2^${BT} e,.d3|R4|U1(L1U1|L2)L1D1|D1(R1D1|R3.r1u3.u1^${BT} f,.r4|L2)L1D1|D3.l1u2|R3.r3u2^${BT} g,.r3d1|L2)L1D1|D1(R1D1|R1)UR1|U2|D4|L3.r4.r1^${BT} h,|D4.u2(R2U1)R2D1|D2.r1^${BT} i,.r2d1|D3.u4*.r3^${BT} j,.r1d1|D4(L1D1|L2.r3^*.r3^${BT} k,|D4.r4u3|L3D1|L1|R4D2.r1u3.u1^${BT} l,.r2|D4.r3u3.u1^${BT} m,.d4|U3)R2D1(UR1)R1D1|D2.r1u3.u1^${BT} n,.d4|U3|R2)R2D1|D2.r1u3.u1^${BT} o,.d2(UR1|R2)R1D1|D1(L1D1|L2)L1U1|U1.r4u2.r1^${BT} p,.d4.d2|U3|U2|R2)R2D1|D1(L2D1|L2.r4u3.r2^${BT} q,.r3d4.d2|U3|U2|L2)L2D1|D1(R2D1|R2.r1^${BT} r,.d4|U3|R2)R2D1.r1u2^${BT} s,.r4d1|L3)L1D1(R1D1|R2)R1D1|L3.r4u3.u1^${BT} t,.r2|D4.l2u3|R4.r1u1^${BT} u,.d1|D2(R1D1|R2)UR1|U2|D3.r1u3.u1^${BT} v,.d1|R2D3|R2U3.r1u1^${BT} w,.d1|R1D3|R1U2|R1D2|R1U3.r1u1^${BT} x,.d1|R4D3.u3|L3D3|L1.r4u3.r1u1^${BT} y,.d1|R2D3|R2U3.l2d3|L1D2|L1.r4u3.r1u3^${BT} z,.d1|R4|L3D3|L1|R4.r1u3.u1^${BT}`,
  `.,.r2d4*.r3u3.u1^${BT} \\,,.r2d4|L2D1.r4u3.u2^${BT} !,.r2|D3.d1*.r3u3.u1^${BT} ?,.r1d1(UR1)R2D1(L1D1|L1|D1.d1*.r3u3.u1^${BT} :,.r2d1*.d3*.r3u3.u1^${BT} ;,.r2d1*.d3|L2D1.r4u3.u2^${BT} ',.r2|L1D1.r4u3.d2^${BT} \",|D1.r1u1|D1.r2u3.l1d2^${BT} -,.d2|R2.r1u2^${BT} +,.d2|R2.l1u1|D2.r3u3^${BT} π,.d1|R4.l3|D3.r2u3|D3.r2u3.u1^${BT} ν,.d1)R2D3)R2U3.r1u1^${BT} γ,.d1)R2D3)R2U3.l2d3|L1D2|L1.r4u3.r1u3^${BT}`,
  `0,.r1|R2)R1D1|D2(L1D1|L2)L1U1|U2(UR1.r4^${BT} 1,.r1d1|R1U1|D4.l2|R4.r1u3.u1^${BT} 2,.d1(UR1|R2)R1D1|L3D3|L1|R4.r1u3.u1^${BT} 3,|R3)R1D1(L1D1|L2.r2)R1D1|L1D1|L3.r4u3.r1u1^${BT} 4,.r4d4|U4|L3D3|L1|R4.r1u3^${BT} 5,.r4|L4|D2|R3)R1D1|L1D1|L3.r4u3.r1u1^${BT} 6,.r4|L3)L1D1|D2(R1D1|R2)UR1(L1U1|L3.r4u2.r1^${BT} 7,|R4|L3D4.r4u3.u1^${BT} 8,.r1|R2)R1D1(L1D1|L2)L1U1(UR1.d2|R2)R1D1(L1D1|L2)L1U1(UR1.r4u2^${BT} 9,.r4d2|L3)L1U1(UR1|R2)R1D1|D2(L1D1|L3.r4u3.r1u1^${BT} ε,.r4d1|L3)L1D1|R3.l3|D1(R1D1|R3.r1u3.u1^${BT} ~,.d2(UR1)R1D1(R1D1)UR1.r1u2^${BT}`,
  '\n{use_rule 1.4}',
].join(' ');

const cardPath = path.join(__dirname, '../public/card/1.1.json');
const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
card.rule = goodRule;
fs.writeFileSync(cardPath, JSON.stringify(card, null, 2) + '\n');
console.log('Restored', cardPath);
