import fs from 'fs';
import path from 'path';

console.log("Current Directory:", process.cwd());
const pkgPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log("Start Script in package.json:", pkg.scripts.start);
} else {
    console.log("No package.json found in current directory.");
}
