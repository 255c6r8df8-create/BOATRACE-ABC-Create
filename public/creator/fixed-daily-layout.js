(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ABCFixedDailyLayout=api;})(globalThis,function(){'use strict';
const groups=['A','B','C','D','E','K'];
function chronological(rows){const byKey=new Map();for(const row of rows){let race=byKey.get(row.key);if(!race){race={key:row.key,record:row.record,variants:[]};byKey.set(row.key,race);}race.variants.push(row);}return [...byKey.values()].map(r=>({...r,variants:[...r.variants].sort((a,b)=>groups.indexOf(a.group)-groups.indexOf(b.group))})).sort((a,b)=>a.record.deadline.localeCompare(b.record.deadline)||a.record.venue.localeCompare(b.record.venue,'ja')||a.record.race_number-b.record.race_number);}
return Object.freeze({chronological});
});
