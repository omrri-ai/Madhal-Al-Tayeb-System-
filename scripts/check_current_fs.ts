import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const movSnap = await getDocs(collection(db, 'movements'));
  const movs: any[] = [];
  movSnap.forEach((d) => movs.push({ id: d.id, ...d.data() }));

  const itemId = 'item_1791707823704_2sjyi'; // علب المانيوم 100مل
  const targetMovs = movs.filter(m => m.itemId === itemId);
  console.log(`Movements currently in Firestore for ITM-0032 (${targetMovs.length}):`);
  for (const m of targetMovs) {
    console.log(`- ID: ${m.id}, Type: ${m.type}, Qty: ${m.quantity}, BaseQty: ${m.baseQuantity}, Ref: ${m.referenceNumber}, Notes: ${m.notes}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
