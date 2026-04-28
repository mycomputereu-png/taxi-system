import { createDispatcher } from './server/dispatcher-auth.ts';

async function main() {
  try {
    console.log('Creating dispatcher account...');
    const result = await createDispatcher(
      'lazareanu_mihai@yahoo.com',
      'Mycomputer@1',
      'Mihai Lazareanu',
      '+40123456789'
    );
    console.log('✓ Dispatcher created successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

main();
