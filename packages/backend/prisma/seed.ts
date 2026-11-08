import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create default Campus Print Center
  const center = await prisma.printCenter.upsert({
    where: { slug: 'central-library' },
    update: {},
    create: {
      name: 'Central Library Print Station',
      slug: 'central-library',
      isActive: true,
    },
  });

  // 2. Create default Admin / Operator User
  const operator = await prisma.user.upsert({
    where: { email: 'operator@campusprint.edu' },
    update: {},
    create: {
      email: 'operator@campusprint.edu',
      phone: '+919876543210',
      passwordHash: 'argon2_mock_hash_xyz',
      role: 'OPERATOR',
    },
  });

  // 3. Create default Student User
  const student = await prisma.user.upsert({
    where: { email: 'student@campusprint.edu' },
    update: {},
    create: {
      email: 'student@campusprint.edu',
      phone: '+919876543211',
      passwordHash: 'argon2_mock_hash_abc',
      role: 'STUDENT',
    },
  });

  // 4. Create sample Printer associated with Center
  const printer = await prisma.printer.create({
    data: {
      centerId: center.id,
      name: 'HP LaserJet Enterprise M608',
      model: 'LaserJet M608dn',
      connectionType: 'NETWORK_IPP',
      portName: 'ipp://192.168.1.105:631/printers/M608',
      isActive: true,
      isOnline: true,
      capabilities: {
        paperSizes: ['A4'],
        colorModes: ['BW'],
        duplexModes: ['SIMPLEX', 'DUPLEX_LONG'],
        maxCopies: 99,
      },
    },
  });

  console.log(`✅ Seeded Print Center: ${center.name} (${center.id})`);
  console.log(`✅ Seeded Operator: ${operator.email}`);
  console.log(`✅ Seeded Student: ${student.email}`);
  console.log(`✅ Seeded Printer: ${printer.name}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

