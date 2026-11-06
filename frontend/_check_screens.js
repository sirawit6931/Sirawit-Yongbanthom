const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const dir = path.join(__dirname, 'screens');
let fail = 0;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(dir, f), 'utf8');
  try {
    parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
    console.log('OK   ' + f);
  } catch (e) {
    fail++;
    console.log('FAIL ' + f + ' -> ' + e.message);
  }
}
console.log(fail ? (fail + ' file(s) FAILED') : 'ALL OK');
