// Local preview only. Production uses the Sites routes under app/api.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dailyUrl, fetchOfficialHtml, fetchVerifiedPdf, parseDate, parseRace, parseResult, parseVenue, resultUrl, statusesFromDaily, venuesFromDaily } from '../lib/boatrace.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.gz': 'application/octet-stream', '.png': 'image/png', '.svg': 'image/svg+xml' };
const previewResults = new Map();
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') { res.writeHead(302, { Location: '/creator/index.html' }).end(); return; }
    if (url.pathname === '/api/schedule') {
      const { iso, stamp } = parseDate(url.searchParams.get('date'));
      const source = dailyUrl(stamp), html = await fetchOfficialHtml(source), venues = venuesFromDaily(html, stamp);
      if (!venues.length) { res.writeHead(422, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: '公式開催一覧から開催場を確認できません。' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ date: iso, venues, statuses: statusesFromDaily(html, stamp, venues), source, retrievedAt: new Date().toISOString() })); return;
    }
    if (url.pathname === '/api/pdf') {
      const { stamp } = parseDate(url.searchParams.get('date'));
      const venue = parseVenue(url.searchParams.get('venue'));
      const bytes = await fetchVerifiedPdf(stamp, venue);
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(Buffer.from(bytes)); return;
    }
    if (url.pathname === '/api/result') {
      const { iso, stamp } = parseDate(url.searchParams.get('date'));
      const venue = parseVenue(url.searchParams.get('venue')), race = parseRace(url.searchParams.get('race'));
      const source = resultUrl(stamp, venue, race), html = await fetchOfficialHtml(source);
      const result = { date: iso, venue, race, source, retrievedAt: new Date().toISOString(), ...parseResult(html, stamp, venue, race) };
      previewResults.set(`${iso}|${venue}|${race}`, result);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(result)); return;
    }
    if (url.pathname === '/api/results') {
      const { iso } = parseDate(url.searchParams.get('date'));
      const results = [...previewResults.values()].filter(r => r.date === iso);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ date: iso, results })); return;
    }
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(target).pipe(res);
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error instanceof Error ? error.message : '取得できません。' }));
  }
});
server.listen(0, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${server.address().port}/`));
