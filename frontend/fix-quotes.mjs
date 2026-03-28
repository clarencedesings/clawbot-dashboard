import fs from 'fs';
import path from 'path';

const srcDir = 'C:/Users/clare/documents/clawbot-dashboard/frontend/src';

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

let totalFixed = 0;
for (const file of walk(srcDir)) {
  let content = fs.readFileSync(file, 'utf8');
  const re = /`(\$\{API_BASE\}\/api\/[^`']*?)'/g;
  const matches = content.match(re);
  if (matches) {
    content = content.replace(re, '`$1`');
    totalFixed += matches.length;
    fs.writeFileSync(file, content);
    console.log(`${file}: fixed ${matches.length}`);
  }
}
console.log(`Total fixes: ${totalFixed}`);
