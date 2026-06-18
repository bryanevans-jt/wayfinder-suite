import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Web Push VAPID keys — add to BOTH Vercel projects (staff + client):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:bryan.evans@thejoshuatree.org");
console.log("\nAlso copy into apps/staff/.env.local and apps/client/.env.local for local dev.");
console.log("\nRedeploy both apps after setting env vars. Push UI stays hidden until NEXT_PUBLIC_VAPID_PUBLIC_KEY is set.");
