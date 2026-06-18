const fs = require("fs");
const path = require("path");
const { get_encoding } = require("tiktoken");

const enc = get_encoding("cl100k_base");

const excluded = [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".turbo",
    "*.md",
    "ui",
    ".agent",
    ".vercel",
    "bun.lock",
    ".prettierrc",
    ".prettierignore",
    "public",
    "package-lock.json",
    "icon.png"
];

function walk(dir) {
    let results = [];

    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        const normalized = full.replace(/\\/g, "/").toLowerCase();

        if (excluded.some(item => normalized.includes(item.toLowerCase()))) continue;

        const stat = fs.statSync(full);

        if (stat.isDirectory()) {
            results.push(...walk(full));
        } else {
            results.push(full);
        }
    }

    return results;
}

let total = 0;

const files = walk(".");
console.log(`Found ${files.length} files to process.\n`);

for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
        const content = fs.readFileSync(file, "utf8");
        const tokens = enc.encode(content).length;
        console.log(`[${i + 1}/${files.length}] (${tokens.toLocaleString()} tokens) ${file}`);
        total += tokens;
    } catch {
        console.log(`[${i + 1}/${files.length}] (FAILED) ${file}`);
    }
}

console.log(`Total Tokens: ${total.toLocaleString()}`);