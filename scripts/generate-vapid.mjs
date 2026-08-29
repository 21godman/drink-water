import { createECDH } from "node:crypto";

const vapid = createECDH("prime256v1");
vapid.generateKeys();

console.log("VITE_VAPID_PUBLIC_KEY=" + vapid.getPublicKey().toString("base64url"));
console.log("VAPID_PRIVATE_KEY=" + vapid.getPrivateKey().toString("base64url"));
console.log(
  "\n請把 public key 放進前端 .env.local；private key 只能放進 Supabase secrets。",
);
