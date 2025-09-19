import fs from "fs";
const path = "vercel.json";
if (!fs.existsSync(path)) {
  console.log("No vercel.json, skipping patch.");
  process.exit(0);
}
const raw = fs.readFileSync(path, "utf8");
let json;
try { json = JSON.parse(raw); } catch (e) {
  console.error("Invalid vercel.json JSON. Aborting.");
  process.exit(1);
}
if (Array.isArray(json.crons)) {
  json.crons = json.crons.map(c => {
    if (c && typeof c === "object" && "headers" in c) {
      const { headers, ...rest } = c;
      return rest;
    }
    return c;
  });
  fs.writeFileSync(path, JSON.stringify(json, null, 2));
  console.log("Patched vercel.json: removed headers from crons.");
} else {
  console.log("No crons array in vercel.json. Nothing to patch.");
}
