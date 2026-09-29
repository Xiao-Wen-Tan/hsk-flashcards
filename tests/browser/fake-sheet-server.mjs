// A local stand-in for the Google Apps Script web app, for the browser check
// (node tests/browser/check.mjs sheet). It runs the real tools/apps_script/Code.gs through
// tests/js/fake-apps-script.mjs and answers the way Google does: a POST to /exec is run and
// answered with a redirect (302) to a second address, where a GET returns the JSON. Both
// answers carry Access-Control-Allow-Origin: *, as Google's do.
//
//   node tests/browser/fake-sheet-server.mjs      listens on http://localhost:8125/
//   GET /admin/setup?code=...   pastes a code into the script and runs setup (a new, empty Sheet)
//   GET /admin/code?code=...    changes the script's code only
//   GET /admin/rows             { log, progress, daily } row counts
import http from 'node:http';
import { loadAppsScript } from '../js/fake-apps-script.mjs';

const PORT = 8125;
let sheet = loadAppsScript();
const answers = new Map();
let next = 1;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', ...headers });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/exec') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const token = String(next++);
      answers.set(token, sheet.gs.doPost({ postData: { contents: body } }).getContent());
      send(res, 302, '', { Location: `/echo?token=${token}` });
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/echo') {
    const text = answers.get(url.searchParams.get('token'));
    answers.delete(url.searchParams.get('token'));
    send(res, text ? 200 : 404, text ?? '{}');
    return;
  }
  if (url.pathname === '/admin/setup') {
    sheet = loadAppsScript({ code: url.searchParams.get('code') });
    sheet.gs.setup();
    send(res, 200, '{"ok":true}');
    return;
  }
  if (url.pathname === '/admin/code') {
    sheet.gs.SECRET_CODE = url.searchParams.get('code');
    send(res, 200, '{"ok":true}');
    return;
  }
  if (url.pathname === '/admin/rows') {
    send(res, 200, JSON.stringify({
      log: sheet.ss.rowsOf('Log').length, progress: sheet.ss.rowsOf('Progress').length, daily: sheet.ss.rowsOf('Daily').length,
    }));
    return;
  }
  send(res, 404, '{}');
}).listen(PORT, () => console.log(`Fake Sheet web app on http://localhost:${PORT}/exec`));