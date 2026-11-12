import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const s=fs.readFileSync('docs/app-wrapper/index.html','utf8'),code=s.slice(s.indexOf('const resultsURL='),s.indexOf('let resultsNeedsRefresh='));
for(const [query,origin] of [['','https://boatrace-abc-create.255c6r8df8.workers.dev'],['?legacy=1','https://boatrace-abc-results.pages.dev'],['?legacy=https://bad.example','https://boatrace-abc-create.255c6r8df8.workers.dev']]){const e={URL,location:{href:'https://boatrace-abc-app.pages.dev/'+query+'#item-2'}};vm.createContext(e);vm.runInContext(code,e);const u=new URL(e.freshResultsURL());assert.equal(u.origin,origin);}
assert.ok(fs.readFileSync('public/creator/fixed-daily.html','utf8').includes('https://boatrace-abc-app.pages.dev/?legacy=1#item-2'));
console.log('外枠：新一覧と旧一覧の固定URL切替・旧ホスト保存領域を保つ導線・任意URLを拒否OK');
