const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

// ── Paste your current Firebase service account JSON here ──────────────────
// Go to: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
// Paste the downloaded JSON content below:
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// All collections to backup
const COLLECTIONS = [
  'patients',
  'appointments',
  'payments',
  'staff',
  'memberships',
  'tokens',
  'whatsapp_messages',
  'whatsapp_bookings',
  'homevisits',
  'sessionFeedback',
  'doctorFeedback',
  'op_forms',
  'notes',
  'attendance',
  'biometricAttendance',
  'staffFingerprints',
  'staffActivity',
  'slots',
  'queue',
  'sessions',
  'fitnessEnrollments',
  'fitnessSlots',
  'videos',
  'notifications',
  'settings'
];

async function backup() {
  console.log('🔄 Starting Firebase backup...\n');
  const backupData = {};
  const backupDir  = path.join(__dirname, 'firebase-backup');

  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  for (const col of COLLECTIONS) {
    try {
      const snap = await db.collection(col).get();
      const docs = [];
      snap.forEach(d => docs.push({ _id: d.id, ...d.data() }));
      backupData[col] = docs;
      console.log(`✅ ${col}: ${docs.length} documents`);
    } catch (e) {
      console.log(`⚠️  ${col}: skipped (${e.message})`);
    }
  }

  // Save full backup as single JSON
  const fullPath = path.join(backupDir, 'full-backup.json');
  fs.writeFileSync(fullPath, JSON.stringify(backupData, null, 2));
  console.log(`\n✅ Full backup saved to: firebase-backup/full-backup.json`);

  // Save each collection separately
  for (const [col, docs] of Object.entries(backupData)) {
    if (docs.length > 0) {
      fs.writeFileSync(path.join(backupDir, `${col}.json`), JSON.stringify(docs, null, 2));
    }
  }

  console.log('✅ Individual collection files saved in firebase-backup/');
  console.log('\n🎉 BACKUP COMPLETE! All your data is safe.');
  console.log(`📁 Location: ${backupDir}`);
  process.exit(0);
}

backup().catch(e => { console.error('❌ Backup failed:', e.message); process.exit(1); });
