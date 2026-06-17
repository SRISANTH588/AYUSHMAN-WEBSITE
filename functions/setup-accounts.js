const admin = require('firebase-admin');
const serviceAccount = require('./newServiceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DEFAULT_ACCOUNTS = [
  {
    name: 'Admin',
    username: 'admin',
    password: 'ayushman@2026',
    role: 'admin',
    status: 'Active'
  },
  {
    name: 'Dr. Durga Sowjanya',
    username: 'durga',
    password: 'durga@2026',
    role: 'staff',
    status: 'Active'
  },
  {
    name: 'Dr. D. Ramachandra',
    username: 'rama',
    password: 'rama@2026',
    role: 'staff',
    status: 'Active'
  }
];

async function setup() {
  console.log('🔄 Setting up default accounts...\n');
  for (const acc of DEFAULT_ACCOUNTS) {
    await db.collection('staff').add({
      ...acc,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Created: ${acc.name} (${acc.role}) — login: ${acc.username} / ${acc.password}`);
  }
  console.log('\n🎉 Setup complete! Use these credentials to login.');
  process.exit(0);
}

setup().catch(e => { console.error('❌ Failed:', e.message); process.exit(1); });
