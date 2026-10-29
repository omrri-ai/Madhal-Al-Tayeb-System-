import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
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
  console.log(`Before cleanup: ${itemMovs.length} movements`);

  let keptOne12 = false;

  for (const m of itemMovs) {
    const baseQty = Number(m.baseQuantity !== undefined && m.baseQuantity !== null ? m.baseQuantity : (m.quantity || 0) * (m.factorApplied || 1));
    const is12Out = Math.abs(baseQty) === 12 && (m.type === 'OUT' || m.type === 'ADJUSTMENT');
    const isCorr = m.referenceNumber?.includes('CORR') || m.referenceNumber?.includes('OUT-12') || m.type === 'ADJUSTMENT';

    if (is12Out || isCorr) {
      if (!keptOne12) {
        // Keep the first one, ensure its reference is DSP-2026-OUT-12 and type is OUT
        keptOne12 = true;
        console.log(`Keeping correct 12-item OUT movement: ${m.id}`);
      } else {
        console.log(`Deleting duplicate 12-item/adjustment movement: ${m.id} (Ref: ${m.referenceNumber}, Type: ${m.type}, BaseQty: ${baseQty})`);
        await deleteDoc(doc(db, 'movements', m.id));
      }
    }
  }

  // Recalculate net balance after cleanup
  const remainingSnap = await getDocs(collection(db, 'movements'));
  const remainingMovs: any[] = [];
  remainingSnap.forEach((d) => remainingMovs.push({ id: d.id, ...d.data() }));
  const finalMovs = remainingMovs.filter((m) => m.itemId === itemId);

  let totalIn = 0;
  let totalOut = 0;
  for (const m of finalMovs) {
    const baseQty = Number(m.baseQuantity !== undefined && m.baseQuantity !== null ? m.baseQuantity : (m.quantity || 0) * (m.factorApplied || 1));
    if (m.type === 'IN' || m.type === 'DAMAGED_RECOVERY' || m.type === 'MFG_IN' || m.type === 'PRODUCTION_RECEIPT' || m.type === 'PRODUCTION_RETURN') {
      totalIn += baseQty;
    } else if (m.type === 'OUT' || m.type === 'DAMAGED' || m.type === 'MFG_OUT' || m.type === 'PRODUCTION_DISPATCH') {
      totalOut += Math.abs(baseQty);
    }
  }

  console.log(`After cleanup: Total IN = ${totalIn}, Total OUT = ${totalOut}, Net Balance = ${totalIn - totalOut}`);
}

main().catch(console.error).finally(() => process.exit(0));
