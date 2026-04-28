import { createDispatcher } from './server/dispatcher-auth.ts';

try {
  const result = await createDispatcher(
    'lazareanu_mihai@yahoo.com',
    'Mycomputer@1',
    'Mihai Lazareanu',
    '+40123456789'
  );
  console.log('Dispatcher created successfully:', result);
} catch (error) {
  console.error('Error creating dispatcher:', error.message);
}
