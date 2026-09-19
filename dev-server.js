/* 本地预览服务：node dev-server.js 后访问 http://localhost:3000 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const fp = path.join(__dirname, path.normalize(url).replace(/^([.][.][/\\])+/, ''));
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, {
      'Content-Type': (MIME[path.extname(fp)] || 'application/octet-stream') + '; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(3000, () => console.log('暴击企鹅预览服务已启动: http://localhost:3000'));
