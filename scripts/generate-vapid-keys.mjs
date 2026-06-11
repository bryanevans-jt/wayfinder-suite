import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("Add these to apps/staff/.env.local and apps/client/.env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:your-contact@thejoshuatree.org");
