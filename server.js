const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading db.json:', e);
  }
  return { isCleared: true, lastUpdated: Date.now(), talents: [] };
}

function writeDb(data) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error writing db.json:', e);
    return false;
  }
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 100 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  // ترويسات CORS للسماح بالوصول من كافة الأجهزة والأنفاق
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlParts = req.url.split('?');
  const reqPath = decodeURIComponent(urlParts[0]);

  // ==========================================
  // مسارات واجهة برمجة التطبيقات (API Routes) للمزامنة بين الأجهزة
  // ==========================================
  if (reqPath === '/api/talents') {
    if (req.method === 'GET') {
      const data = readDb();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'POST') {
      try {
        const bodyStr = await getRequestBody(req);
        const parsed = JSON.parse(bodyStr);
        const dbState = {
          isCleared: Boolean(parsed.isCleared),
          lastUpdated: Date.now(),
          talents: Array.isArray(parsed.talents) ? parsed.talents : []
        };
        writeDb(dbState);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, count: dbState.talents.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }
  }

  if (reqPath === '/api/clear' && req.method === 'POST') {
    const dbState = {
      isCleared: true,
      lastUpdated: Date.now(),
      talents: []
    };
    writeDb(dbState);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, message: 'All data cleared successfully' }));
    return;
  }

  if (reqPath === '/api/reset' && req.method === 'POST') {
    const dbState = {
      isCleared: false,
      lastUpdated: Date.now(),
      talents: null
    };
    writeDb(dbState);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, reset: true }));
    return;
  }

  // ==========================================
  // خدمة الملفات الثابتة (Static Files)
  // ==========================================
  let staticPath = reqPath;
  if (staticPath === '/' || staticPath === '') staticPath = '/index.html';

  const filePath = path.join(__dirname, staticPath);

  // حماية ضد Path Traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403: ممنوع الوصول');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404: الصفحة غير موجودة');
    } else {
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': (ext === '.html' || ext === '.js' || ext === '.json') ? 'no-cache' : 'max-age=86400'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`الداشبورد يعمل الآن على: http://localhost:${PORT}/`);
});
