(function (root) {
  'use strict';
  root.ABCDailyView = { create };
  function create(ctx) {
    const $ = id => document.getElementById(id), D = root.ABCDaily, C = ctx.C;
    let date = null, data = null, baseline = null, storageError = '', initialSelected = false, refreshTimer = null, cacheStatus = '';
    const drafts = new Map(), autoAttempts = new Map();
    const el = (tag, text) => { const x = document.createElement(tag); x.textContent = text; return x; };
    const storageKey = d => 'BOATRACE_ACTUAL_PURCHASES_V1|' + d;
    const venueCode = name => Object.entries(root.ABC_PDF_PROFILE.supported()).find(([, v]) => v === name)?.[0];
    function urls(r) {
      const day = ctx.getDay(), code = venueCode(r.venue);
      if (!day || !code || !Number.isInteger(r.race_number) || r.race_number < 1 || r.race_number > 12) return null;
      const query = 'rno=' + r.race_number + '&jcd=' + code + '&hd=' + day.date.replaceAll('-', '');
      return { code, list: 'https://www.boatrace.jp/owpc/pc/race/racelist?' + query, result: 'https://www.boatrace.jp/owpc/pc/race/raceresult?' + query };
    }
    function sourceLink(r, label) {
      const u = urls(r), a = el('a', label + ' ↗');
      if (!u) { a.textContent = '公式リンク未確認'; return a; }
      a.href = label === '結果' ? u.result : u.list;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      return a;
    }
    function sourceLinks(r) {
      const wrap = el('div', ''); wrap.className = 'source-links';
      wrap.append(sourceLink(r, '出走表'), sourceLink(r, '結果'));
      const day = ctx.getDay(), source = day?.input.sources.find(s => s.id === r.pdf_list_source_id);
      if (source?.url?.startsWith('https://www.boatrace.jp/syussoupdf/')) {
        const a = el('a', '出走表の原本 ↗'); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; wrap.append(a);
      }
      return wrap;
    }
    function validResult(r, key) {
      const day = ctx.getDay(), [venue, no] = key.split('|'), fake = { venue, race_number: Number(no) }, u = urls(fake);
      if (!r || !u || r.date !== day.date || r.venue !== u.code || r.race !== fake.race_number || r.source !== u.result || !Number.isFinite(Date.parse(r.retrievedAt))) return false;
      if (r.status === 'unconfirmed') return typeof r.reason === 'string';
      return r.status === 'confirmed' && Array.isArray(r.order) && r.order.length === 3 && new Set(r.order).size === 3 && r.order.every(n => Number.isInteger(n) && n >= 1 && n <= 6) && Number.isSafeInteger(r.payout) && r.payout > 0 && Array.isArray(r.refunds) && new Set(r.refunds).size === r.refunds.length && r.refunds.every(n => Number.isInteger(n) && n >= 1 && n <= 6 && !r.order.includes(n));
    }
    function sync() {
      const day = ctx.getDay();
      if (!day) { $('purchase-panel').hidden = true; if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = null; date = null; return; }
      if (date === day.date) return;
      date = day.date; drafts.clear(); autoAttempts.clear(); initialSelected = false; storageError = ''; cacheStatus = '';
      data = { purchases: {}, results: {}, purchaseTimes: {} };
      try {
        baseline = localStorage.getItem(storageKey(date));
        if (baseline !== null) {
          const old = JSON.parse(baseline);
          if (!old || old.version !== 1 || old.date !== date || !old.purchases || !old.results || !old.purchaseTimes) throw Error('保存形式が異なります');
          for (const [key, tickets] of Object.entries(old.purchases)) {
            if (!Array.isArray(tickets) || JSON.stringify(D.parsePurchases(D.formatPurchases(tickets))) !== JSON.stringify(tickets)) throw Error('購入記録の内容を検証できません');
            const [venue, no] = key.split('|'); if (!urls({ venue, race_number: Number(no) })) throw Error('購入レースを確認できません');
          }
          for (const [key, result] of Object.entries(old.results)) if (!validResult(result, key)) throw Error('公式結果の保存内容を検証できません');
          data = old;
        }
      } catch (e) { storageError = '端末内の購入記録を読み取れません。上書きは停止しています：' + e.message; }
      scheduleCachedRefresh(1200);
    }
    function scheduleCachedRefresh(delay) {
      if (typeof setTimeout !== 'function') return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        refreshTimer = null;
        if (!ctx.getDay()) return;
        if (ctx.isBusy?.()) { scheduleCachedRefresh(3000); return; }
        let more = false;
        try { more = await applyCachedResults(); } catch (e) { cacheStatus = '自動取得は未確認です。手動で再取得できます。'; const s = $('result-status'); if (s) s.textContent = cacheStatus; }
        if (ctx.getDay()) scheduleCachedRefresh(more ? 15000 : 120000);
      }, delay);
    }
    async function applyCachedResults() {
      if (storageError || !data) return false;
      const day = ctx.getDay(), requestDate = day?.date, baseData = data;
      if (!requestDate) return false;
      let payload = { date: requestDate, results: [] }, cacheAvailable = false;
      try { const response = await fetch('/api/results?date=' + encodeURIComponent(requestDate), { cache: 'no-store' }), candidate = await response.json(); if (response.ok && candidate.date === requestDate && Array.isArray(candidate.results)) { payload = candidate; cacheAvailable = true; } } catch { /* Continue with an on-demand official lookup. */ }
      if (ctx.getDay()?.date !== requestDate || data !== baseData) return false;
      const allowed = new Set([...races().map(C.id), ...Object.keys(data.purchases)]), nextResults = { ...data.results }; let changed = 0;
      for (const result of payload.results) {
        const venue = root.ABC_PDF_PROFILE.supported()[result?.venue], key = venue + '|' + result?.race;
        if (!venue || !allowed.has(key) || !validResult(result, key)) continue;
        const old = nextResults[key];
        if (!old || Date.parse(result.retrievedAt) > Date.parse(old.retrievedAt)) { nextResults[key] = result; changed++; }
      }
      if (changed) { persist({ ...data, results: nextResults }); cacheStatus = '自動更新した公式結果を' + changed + 'レース分反映しました。'; ctx.refresh(); }
      else cacheStatus = cacheAvailable ? '公式結果の自動更新を確認しました。未確定の結果は確定後に反映します。' : '更新済み結果を読めないため、公式結果を直接確認します。';
      const wanted = new Set([...(ctx.getComputed()?.rows || []).map(x => x.key), ...Object.keys(data.purchases).filter(k => data.purchases[k].length)]);
      const missing = races().filter(r => {
        if (!wanted.has(C.id(r)) || Date.now() < Date.parse(requestDate + 'T' + r.deadline + ':00+09:00') + 10 * 60_000 || Date.now() - (autoAttempts.get(C.id(r)) || 0) < 5 * 60_000) return false;
        return D.needsResultRefresh(data.results[C.id(r)], Date.now());
      });
      let fetched = 0;
      for (const r of missing.slice(0, 2)) {
        if (ctx.getDay()?.date !== requestDate || ctx.isBusy?.()) break;
        autoAttempts.set(C.id(r), Date.now());
        try { const result = await fetchResult(r); if (result.status === 'confirmed') fetched++; } catch { /* A later check or manual retry can recover. */ }
      }
      if (fetched) { cacheStatus = '公式結果を自動取得して' + fetched + 'レース分反映しました。'; ctx.refresh(); }
      $('result-status').textContent = cacheStatus;
      return missing.length > 2;
    }
    function persist(next) {
      if (storageError) throw Error(storageError);
      if (localStorage.getItem(storageKey(date)) !== baseline) throw Error('別の画面で購入記録が変更されました。上書きせず停止しました。');
      const encoded = JSON.stringify({ ...next, version: 1, date });
      localStorage.setItem(storageKey(date), encoded);
      if (localStorage.getItem(storageKey(date)) !== encoded) throw Error('保存後の再読込を確認できません。');
      baseline = encoded; data = { ...next, version: 1, date };
    }
    function races() { const day = ctx.getDay(); return day ? C.allRaces(day) : []; }
    function selectedRace() { return races().find(r => C.id(r) === $('purchase-race').value); }
    function currentText(key) { return drafts.has(key) ? drafts.get(key) : D.formatPurchases(data?.purchases[key] || []); }
    function selectedText() { const r = selectedRace(); return r ? currentText(C.id(r)) : ''; }
    function selectInitial() {
      const target = ctx.getDay()?.fetchReport?.targetRace;
      if (target) $('purchase-race').value = target.venue + '|' + target.raceNumber;
      initialSelected = true; render();
      if (target) $('purchase-panel').scrollIntoView({ block: 'start' });
    }
    function focus(key) {
      if (!races().some(r => C.id(r) === key)) throw Error('指定したレースが取得済みデータにありません。');
      $('purchase-race').value = key; initialSelected = true; render();
      $('purchase-panel').scrollIntoView({ block: 'start' });
    }
    function render() {
      const day = ctx.getDay();
      if (!day) { $('purchase-panel').hidden = true; return; }
      sync(); $('purchase-panel').hidden = false;
      const select = $('purchase-race'), old = select.value, rr = races();
      select.replaceChildren();
      for (const r of rr) select.add(new Option(r.venue + ' ' + r.race_number + 'R／締切 ' + r.deadline, C.id(r)));
      const target = day.fetchReport?.targetRace;
      const preferred = !initialSelected && target ? target.venue + '|' + target.raceNumber : old || ctx.getComputed()?.rows[0]?.key;
      if (preferred && rr.some(r => C.id(r) === preferred)) select.value = preferred;
      const r = selectedRace(), detail = $('target-detail'); detail.replaceChildren();
      $('purchase-input').value = selectedText();
      if (r) {
        detail.append(el('h3', r.venue + ' ' + r.race_number + 'R ／締切 ' + r.deadline), sourceLinks(r), el('p', 'ここに表示する成績は出走表原本の「全国期別」です。公式出走表ページの「全国」と数値が異なる場合は、原本の該当列をご確認ください。'));
        const scrollHint = el('p', '⇆ 表は左右にスワイプできます'); scrollHint.className = 'scroll-hint'; detail.append(scrollHint);
        const wrap = el('div', ''); wrap.className = 'horizontal'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '出走情報。横にスクロールできます');
        const table = el('table', ''), head = el('tr', '');
        for (const s of ['艇', '登録番号', '選手', '級別', '原本の全国期別勝率', '原本の全国期別2連率']) head.append(el('th', s));
        table.append(head);
        for (const [i, b] of r.entrants.entries()) {
          const m = day.members[C.id(r)]?.[i], tr = el('tr', '');
          for (const value of [b.boat_number, m?.registration_number || '未確認', m?.player_name || '未確認', b.grade || '未確認', b.national_win_rate?.toFixed(2) ?? '未確認', b.national_top2_rate_percent === null ? '未確認' : b.national_top2_rate_percent.toFixed(1) + '%']) tr.append(el('td', String(value)));
          table.append(tr);
        }
        wrap.append(table); detail.append(wrap);
        const result = data.results[C.id(r)];
        detail.append(el('p', result?.status === 'confirmed' ? '公式結果：' + result.order.join('-') + '／3連単配当 ' + result.payout.toLocaleString('ja-JP') + '円／返還艇 ' + (result.refunds.join('・') || 'なし') + '／取得 ' + new Date(result.retrievedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : result?.reason || '公式結果：未取得または未確定'));
      }
      $('result-status').textContent = storageError || cacheStatus || '公式結果は自動確認します。購入記録はこの端末内に保存されます。';
      $('save-purchases').disabled = !!storageError || !r;
      $('result-one').disabled = !!storageError || !r;
      $('result-all').disabled = !!storageError || !rr.length;
      $('add-normal').disabled = !r || !ctx.getComputed()?.rows.find(x => x.key === C.id(r))?.normalExpression;
      $('add-hypothesis').disabled = !r || !ctx.getComputed()?.rows.find(x => x.key === C.id(r))?.hypExpression;
      renderSummary();
    }
    function renderSummary() {
      const box = $('daily-summary'); box.replaceChildren();
      if (storageError) { box.append(el('p', storageError)); return; }
      const s = D.calculate(data.purchases, data.results), pct = n => n === null ? '―' : n.toFixed(1) + '%', yen = n => n.toLocaleString('ja-JP') + '円';
      box.append(el('h3', date + ' の実購入集計'), el('p', '的中率：的中したレース数 ÷ 有効な購入がある結果確定レース数。回収率：（的中払戻＋返還金）÷ 結果確定分の購入額。全額返還のレースは的中率の母数から除外します。未確定分は率に含めません。'));
      const scrollHint = el('p', '⇆ 表は左右にスワイプできます'); scrollHint.className = 'scroll-hint'; box.append(scrollHint);
      const wrap = el('div', ''); wrap.className = 'horizontal'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '当日集計。横にスクロールできます'); const table = el('table', ''), h = el('tr', ''), v = el('tr', '');
      const values = [['購入レース', s.purchaseRaces], ['結果未確定', s.pendingRaces], ['有効レース', s.decidedRaces], ['的中レース', s.hitRaces], ['的中率', pct(s.hitRate)], ['確定購入額', yen(s.spent)], ['的中払戻', yen(s.winningPayout)], ['返還金', yen(s.refund)], ['回収率', pct(s.returnRate)], ['収支', s.confirmedRaces ? yen(s.balance) : '―']];
      for (const [label, value] of values) { h.append(el('th', label)); v.append(el('td', String(value))); }
      table.append(h, v); wrap.append(table); box.append(wrap);
    }
    $('purchase-race').addEventListener('change', render);
    $('purchase-input').addEventListener('input', () => { const r = selectedRace(); if (r) drafts.set(C.id(r), $('purchase-input').value); });
    $('save-purchases').onclick = () => ctx.run(async () => {
      const r = selectedRace(); if (!r) throw Error('レースを選んでください。');
      const key = C.id(r), tickets = D.parsePurchases($('purchase-input').value);
      const next = { ...data, purchases: { ...data.purchases, [key]: tickets }, purchaseTimes: { ...data.purchaseTimes, [key]: new Date().toISOString() } };
      persist(next); drafts.delete(key); ctx.refresh(); ctx.notify(r.venue + r.race_number + 'R の購入記録を端末内に保存しました。');
    });
    function addPredicted(kind) {
      const r = selectedRace(), x = r && ctx.getComputed()?.rows.find(x => x.key === C.id(r));
      const expression = kind === 'normal' ? x?.normalExpression : x?.hypExpression;
      if (!expression) throw Error('このレースの買い目がありません。');
      const unit = Number($('purchase-unit').value);
      if (!Number.isSafeInteger(unit) || unit < 100 || unit > 10000000 || unit % 100) throw Error('1点あたりの金額は100円単位で入力してください。');
      const parsed = C.bets(expression); if (parsed.errors.length) throw Error('買い目を展開できません。');
      const existing = D.parsePurchases($('purchase-input').value), by = new Map(existing.map(t => [t.bet, t.amount]));
      for (const bet of parsed.bets) by.set(bet, (by.get(bet) || 0) + unit);
      const next = [...by].map(([bet, amount]) => ({ bet, amount }));
      D.parsePurchases(D.formatPurchases(next));
      $('purchase-input').value = D.formatPurchases(next); drafts.set(C.id(r), $('purchase-input').value);
      ctx.notify('入力欄に追加しました。実際に購入した内容と金額を確認して保存してください。');
    }
    $('add-normal').onclick = () => ctx.run(() => addPredicted('normal'));
    $('add-hypothesis').onclick = () => ctx.run(() => addPredicted('hypothesis'));
    async function fetchResult(r) {
      const day = ctx.getDay(), u = urls(r); if (!u) throw Error('公式ページのリンクを作成できません。');
      const response = await fetch('/api/result?date=' + encodeURIComponent(day.date) + '&venue=' + u.code + '&race=' + r.race_number, { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || '公式結果を取得できません。');
      if (!validResult(result, C.id(r))) throw Error('公式結果のレース識別・内容を確認できません。');
      persist({ ...data, results: { ...data.results, [C.id(r)]: result } });
      return result;
    }
    $('result-one').onclick = () => ctx.run(async () => {
      const r = selectedRace(); if (!r) throw Error('レースを選んでください。');
      const result = await fetchResult(r); ctx.refresh(); ctx.notify(result.status === 'confirmed' ? '公式結果と返還情報を取得しました。' : '公式結果は未確定または自動判定できません：' + result.reason);
    });
    async function refreshAll() {
      if (storageError) throw Error(storageError);
      const day = ctx.getDay(), computed = ctx.getComputed();
      if (!day || !computed || !data) throw Error('先に一覧を作成するか、保存済みの一覧を開いてください。');
      const wanted = new Set([...computed.rows.map(x => x.key), ...Object.keys(data.purchases).filter(k => data.purchases[k].length)]);
      const candidates = races().filter(r => wanted.has(C.id(r)) && Date.now() >= Date.parse(day.date + 'T' + r.deadline + ':00+09:00'));
      if (!candidates.length) throw Error('締切後の一覧対象・購入記録がありません。');
      let done = 0, confirmed = 0; const failures = [];
      for (const r of candidates) {
        $('result-status').textContent = '公式結果を取得中… ' + done + ' / ' + candidates.length;
        try { const result = await fetchResult(r); if (result.status === 'confirmed') confirmed++; else failures.push(r.venue + r.race_number + 'R：' + result.reason); }
        catch (e) { failures.push(r.venue + r.race_number + 'R：' + e.message); }
        done++; if (done < candidates.length) await new Promise(resolve => setTimeout(resolve, 150));
      }
      ctx.refresh(); ctx.notify('公式結果を確認：' + confirmed + '／' + candidates.length + 'レース。' + (failures.length ? '未確認：' + failures.join('／') : ''));
    }
    $('result-all').onclick = () => ctx.run(refreshAll);
    const oldForecasts = new Map();
    function savedBeforeDeadline(x, sectionId, expression) {
      const day = ctx.getDay(), deadline = Date.parse(day.date + 'T' + x.record.deadline + ':00+09:00');
      for (const record of ctx.getArchives().filter(r => r.date === day.date)) {
        try {
          let old = oldForecasts.get(record.sha256);
          if (!old) { const payload = JSON.parse(record.payload); old = { payload, computed: C.compute(payload.day) }; oldForecasts.set(record.sha256, old); }
          if (Date.parse(old.payload.savedAt) >= deadline) continue;
          const previous = old.computed.rows.find(r => r.key === x.key);
          if (!previous || previous.group !== x.group) continue;
          let previousExpression = sectionId.endsWith('-hypo') ? previous.hypExpression : ['a', 'b', 'c'].includes(sectionId) ? previous.normalExpression : '';
          if (sectionId === 'cf-image-races' || sectionId === 'crossfire') { const cf = C.crossfire(previous, old.payload.day, ctx.contract); previousExpression = sectionId === 'cf-image-races' ? cf?.image.expression : cf?.legacy.expression; }
          if (previousExpression && C.eqBets(previousExpression, expression)) return true;
        } catch { /* An unusable historical version cannot establish a forecast. */ }
      }
      return false;
    }
    function sections() {
      const day = ctx.getDay(), computed = ctx.getComputed(); if (!day || !computed) return [];
      const sections = C.sections(ctx.contract, day), resultRows = new Set(['a', 'b', 'c', 'a-hypo', 'b-hypo', 'c-hypo', 'a-grade', 'crossfire', 'cf-image-races']);
      const returnedC=new Set(computed.rows.filter(x=>x.group==='C'&&data.results[x.key]?.status==='confirmed'&&data.results[x.key].refunds?.length).map(x=>x.record.venue+x.record.race_number+'R'));for(const sec of sections.filter(s=>['c','c-hypo'].includes(s.id))){const col=sec.columns.indexOf('場・R');if(col>=0)sec.rows=sec.rows.filter(row=>!returnedC.has(row[col]));}const push=sections.find(s=>s.id==='c-push');if(push){const k=push.columns.indexOf('区分'),n=push.columns.indexOf('対象数');if(k>=0&&n>=0)for(const row of push.rows){const label=row[k];row[n]=computed.rows.filter(x=>x.group==='C'&&!returnedC.has(x.record.venue+x.record.race_number+'R')&&(label==='全体'||x.selection.cPush===(label==='推し'))).length;}}
      const cSection=sections.find(s=>s.id==='c');if(cSection){cSection.columns=[...cSection.columns,'1コース期別2連対率','取得時点'];const i=cSection.columns.indexOf('場・R');for(const row of cSection.rows){const x=computed.rows.find(v=>v.record.venue+v.record.race_number+'R'===row[i]);row.push(x?.cCourseRate==null?'未確認':x.cCourseRate.toFixed(1)+'%',x?.cAfterDeadline?'締切後・事後参考':x?.cRateSource==='OFFICIAL_PERIOD_FILE'?'締切前':'画像・原本を確認');}}
      const financial = new Set(['確定数', '的中数', '的中率', '投資額', '的中払戻', '回収率', '収支', '確定投資', '確定R', '的中R', '結果確定数', '配当確認数', '公式配当合計', '平均配当']);
      for (const section of sections) {
        if (!resultRows.has(section.id)) {
          for (const row of section.rows) section.columns.forEach((c, i) => { if (financial.has(c)) row[i] = '―'; });
          continue;
        }
        for (const row of section.rows) {
          const raceIndex = section.columns.indexOf('場・R'), text = row[raceIndex], x = computed.rows.find(v => v.record.venue + v.record.race_number + 'R' === text);
          if (!x) continue;
          const result = data.results[x.key]; if (!result || result.status !== 'confirmed') continue;
          const set = (column, value) => { const i = section.columns.indexOf(column); if (i >= 0) row[i] = String(value); };
          set('結果', result.order.join('-')); set('公式配当', result.payout.toLocaleString('ja-JP') + '円');
          ['1着', '2着', '3着'].forEach((v, i) => set(v, result.order[i] + '号艇'));
          let expression = section.id.endsWith('-hypo') ? x.hypExpression : ['a', 'b', 'c'].includes(section.id) ? x.normalExpression : '';
          if (section.id === 'cf-image-races' || section.id === 'crossfire') { const cf = C.crossfire(x, day, ctx.contract); expression = section.id === 'cf-image-races' ? cf?.image.expression : cf?.legacy.expression; }
          const savedBefore = expression && savedBeforeDeadline(x, section.id, expression);
          if (expression && savedBefore) {
            const parsed = C.bets(expression);
            if (!parsed.errors.length) set('判定', parsed.bets.includes(result.order.join('')) ? '○' : parsed.bets.some(b => [...b].some(n => result.refunds.includes(Number(n)))) ? '返還あり' : '×');
          } else if (expression) set('判定', '未固定');
        }
      }
      return sections;
    }
    function textLines() {
      const day = ctx.getDay(), lines = ['【当日の実購入集計】'];
      const s = D.calculate(data.purchases, data.results), fmt = n => n === null ? '未確定' : n.toFixed(1) + '%';
      lines.push('購入レース\t結果未確定\t有効レース\t的中レース\t的中率\t確定購入額\t的中払戻\t返還金\t回収率\t収支', [s.purchaseRaces,s.pendingRaces,s.decidedRaces,s.hitRaces,fmt(s.hitRate),s.spent,s.winningPayout,s.refund,fmt(s.returnRate),s.balance].join('\t'), '');
      lines.push('【実購入した3連単】', '開催日\t場・R\t組番\t購入額\t入力保存時刻\t公式出走表\t公式結果');
      for (const [key, tickets] of Object.entries(data.purchases)) {
        const [venue, no] = key.split('|'), r = { venue, race_number: Number(no) }, u = urls(r);
        for (const t of tickets) lines.push([day.date, venue + no + 'R', [...t.bet].join('-'), t.amount, data.purchaseTimes[key] || '', u?.list || '', u?.result || ''].join('\t'));
      }
      lines.push('', '【公式結果】', '開催日\t場・R\t状態\t1〜3着\t3連単配当（100円あたり）\t返還艇\t取得時刻\t公式結果');
      for (const [key, r] of Object.entries(data.results)) { const [venue, no] = key.split('|'); lines.push([day.date, venue + no + 'R', r.status === 'confirmed' ? '確認済み' : r.reason, r.order?.join('-') || '', r.payout || '', r.refunds?.join(',') || '', r.retrievedAt, r.source].join('\t')); }
      lines.push('', '【取得した出走情報】', '開催日\t場・R\t締切\t艇\t登録番号\t選手名\t級別\t原本の全国期別勝率\t原本の全国期別2連率\t公式出走表\t出走表原本');
      for (const r of races()) { const u = urls(r), source = day.input.sources.find(x => x.id === r.pdf_list_source_id); for (const [i,b] of r.entrants.entries()) { const m = day.members[C.id(r)]?.[i]; lines.push([day.date, r.venue + r.race_number + 'R', r.deadline, b.boat_number, m?.registration_number || '', m?.player_name || '', b.grade || '', b.national_win_rate ?? '', b.national_top2_rate_percent ?? '', u?.list || '', source?.url || ''].map(x => String(x).replace(/[\t\r\n]+/g, ' ')).join('\t')); } }
      lines.push('', '【予想と指定】', '場・R\t区分\t色\t狙い\tK指定\t通常買い目\t仮説買い目\tB第2軸\tC指定\t推し\tクロスファイヤー参加\t画像記録時刻\t事後参考\t照合状態');
      for (const x of ctx.getComputed().rows) {
        const s = x.selection;
        const image = day.creation?.cOriginals?.[x.key];
        lines.push([x.record.venue + x.record.race_number + 'R', x.group, x.color || '', s.aim, s.k, x.normalExpression, x.hypExpression, s.bAxis ?? '', s.cDesignation || '', s.cPush ? 'あり' : 'なし', s.cfEnabled ? 'あり' : 'なし', image?.createdAt || '', image?.afterDeadline ? 'はい' : 'いいえ', x.issues.join('／')].map(v => String(v ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t'));
      }
      lines.push('', '【取得情報】', '公式開催一覧\t' + (day.fetchReport?.source || '未記録'), '開催一覧取得時刻\t' + (day.fetchReport?.retrievedAt || '未記録'));
      for (const x of day.fetchReport?.failures || []) lines.push('未取得\t' + x.venue + '\t' + x.message.replace(/[\t\r\n]+/g, ' '));
      lines.push(''); return lines;
    }
    return { sync, render, selectInitial, focus, refreshAll, sections, textLines, sourceLink, sourceLinks };
  }
})(globalThis);
