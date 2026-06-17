const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

// ── Paste your NEW Firebase service account JSON here ──────────────────────
const serviceAccount = require('./newServiceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function restore() {
  console.log('🔄 Starting Firebase restore to NEW project...\n');

  const backupFile = path.join(__dirname, 'firebase-backup', 'full-backup.json');
  if (!fs.existsSync(backupFile)) {
    console.error('❌ Backup file not found! Run backup.js first.');
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const collections = Object.keys(backupData);

  for (const col of collections) {
    const docs = backupData[col];
    if (!docs || docs.length === 0) { console.log(`⏭️  ${col}: empty, skipped`); continue; }

    console.log(`🔄 Restoring ${col}: ${docs.length} documents...`);
    // Batch write (max 500 per batch)
    let batch = db.batch();
    let count = 0;

    for (const doc of docs) {
      const { _id, ...data } = doc;
      // Convert timestamp strings back
      for (const key of Object.keys(data)) {
        if (data[key] && typeof data[key] === 'object' && data[key]._seconds) {
          data[key] = new admin.firestore.Timestamp(data[key]._seconds, data[key]._nanoseconds);
        }
      }
      const ref = db.collection(col).doc(_id);
      batch.set(ref, data);
      count++;

      if (count % 500 === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`  ✅ ${count} docs committed...`);
      }
    }

    if (count % 500 !== 0) await batch.commit();
    console.log(`✅ ${col}: ${docs.length} documents restored`);
  }

  console.log('\n🎉 RESTORE COMPLETE! All data is in your new Firebase.');
  process.exit(0);
}

restore().catch(e => { console.error('❌ Restore failed:', e.message); process.exit(1); });
