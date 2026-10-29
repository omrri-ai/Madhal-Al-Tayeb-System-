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
  const itemId = 'item_1791706707746_5yp78'; // شنط جملي نص كيلو
  const movsSnap = await getDocs(collection(db, 'movements'));
  const movs: any[] = [];
  movsSnap.forEach((d) => movs.push({ id: d.id, ...d.data() }));

  const itemMovs = movs.filter((m) => m.itemId === itemId);
  console.log(`Movements for ITM-0014 (${itemMovs.length}):`);
  let totalIn = 0;
  let totalOut = 0;
  for (const m of itemMovs) {
    const baseQty = Number(m.baseQuantity !== undefined && m.baseQuantity !== null ? m.baseQuantity : (m.quantity || 0) * (m.factorApplied || 1));
    console.log(`- Type: ${m.type}, BaseQty: ${baseQty}, Ref: ${m.referenceNumber}, Notes: ${m.notes}`);
    if (m.type === 'IN' || m.type === 'DAMAGED_RECOVERY' || m.type === 'MFG_IN' || m.type === 'PRODUCTION_RECEIPT' || m.type === 'PRODUCTION_RETURN') {
      totalIn += baseQty;
    } else if (m.type === 'OUT' || m.type === 'DAMAGED' || m.type === 'MFG_OUT' || m.type === 'PRODUCTION_DISPATCH') {
      totalOut += Math.abs(baseQty);
    }
  }
  console.log(`Total IN: ${totalIn}, Total OUT: ${totalOut}, Net Balance: ${totalIn - totalOut}`);
}

main().catch(console.error).finally(() => process.exit(0));
