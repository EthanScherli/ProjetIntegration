const fs = require("fs");
const s = fs.readFileSync("my-app/package-lock.json", "utf8");

let inString = false;
let escaped = false;
let stringStart = -1;

for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
    } else if (c === '"') {
        inString = true;
        stringStart = i;
    }

    if (i >= s.length - 100 && (c === "{" || c === "}" || c === '"')) {
        console.log(i, JSON.stringify(c), "Dans une chaîne :", inString);
    }
}

console.log("\nTaille du fichier :", s.length);
console.log("Chaîne ouverte à la fin :", inString);
console.log("Début de la chaîne :", stringStart);
console.log("Derniers caractères :", JSON.stringify(s.slice(-30)));
