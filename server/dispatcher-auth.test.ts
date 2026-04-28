import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  createDispatcher, 
  getDispatcherByEmail, 
  verifyDispatcherPassword,
  createDispatcherSession,
  getDispatcherSession,
  deleteDispatcherSession,
  getAllDispatchers,
  getDispatcherById,
  updateDispatcher,
  updateDispatcherPassword,
  deleteDispatcher
} from './dispatcher-auth';

describe('Dispatcher Authentication', () => {
  let testDispatcherId: number;
  const testEmail = 'test.dispatcher@example.com';
  const testPassword = 'TestPassword123!';
  const testName = 'Test Dispatcher';
  const testPhone = '+40123456789';

  beforeAll(async () => {
    // Clean up any existing test dispatcher
    const existing = await getDispatcherByEmail(testEmail);
    if (existing) {
      await deleteDispatcher(existing.id);
    }
  });

  afterAll(async () => {
    // Clean up test dispatcher
    if (testDispatcherId) {
      await deleteDispatcher(testDispatcherId);
    }
  });

  it('should create a dispatcher', async () => {
    const result = await createDispatcher(testEmail, testPassword, testName, testPhone);
    expect(result).toBeDefined();
    
    // Fetch the created dispatcher to get the ID
    const dispatcher = await getDispatcherByEmail(testEmail);
    expect(dispatcher).toBeDefined();
    expect(dispatcher?.email).toBe(testEmail);
    expect(dispatcher?.name).toBe(testName);
    expect(dispatcher?.phone).toBe(testPhone);
    expect(dispatcher?.status).toBe('active');
    
    testDispatcherId = dispatcher!.id;
  });

  it('should get dispatcher by email', async () => {
    const dispatcher = await getDispatcherByEmail(testEmail);
    expect(dispatcher).toBeDefined();
    expect(dispatcher?.email).toBe(testEmail);
    expect(dispatcher?.name).toBe(testName);
  });

  it('should verify correct password', async () => {
    const dispatcher = await verifyDispatcherPassword(testEmail, testPassword);
    expect(dispatcher).toBeDefined();
    expect(dispatcher?.email).toBe(testEmail);
  });

  it('should reject incorrect password', async () => {
    const dispatcher = await verifyDispatcherPassword(testEmail, 'WrongPassword');
    expect(dispatcher).toBeNull();
  });

  it('should reject non-existent email', async () => {
    const dispatcher = await verifyDispatcherPassword('nonexistent@example.com', testPassword);
    expect(dispatcher).toBeNull();
  });

  it('should create and retrieve dispatcher session', async () => {
    const token = 'test-token-' + Date.now();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await createDispatcherSession(testDispatcherId, token, expiresAt);
    
    const session = await getDispatcherSession(token);
    expect(session).toBeDefined();
    expect(session?.token).toBe(token);
    expect(session?.dispatcherId).toBe(testDispatcherId);
  });

  it('should delete dispatcher session', async () => {
    const token = 'test-token-delete-' + Date.now();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await createDispatcherSession(testDispatcherId, token, expiresAt);
    await deleteDispatcherSession(token);
    
    const session = await getDispatcherSession(token);
    expect(session).toBeNull();
  });

  it('should get dispatcher by ID', async () => {
    const dispatcher = await getDispatcherById(testDispatcherId);
    expect(dispatcher).toBeDefined();
    expect(dispatcher?.id).toBe(testDispatcherId);
    expect(dispatcher?.email).toBe(testEmail);
  });

  it('should get all dispatchers', async () => {
    const dispatchers = await getAllDispatchers();
    expect(Array.isArray(dispatchers)).toBe(true);
    expect(dispatchers.length).toBeGreaterThan(0);
    
    const found = dispatchers.find(d => d.id === testDispatcherId);
    expect(found).toBeDefined();
  });

  it('should update dispatcher', async () => {
    const newName = 'Updated Dispatcher';
    const newPhone = '+40987654321';
    
    await updateDispatcher(testDispatcherId, {
      name: newName,
      phone: newPhone,
      status: 'active'
    });
    
    const dispatcher = await getDispatcherById(testDispatcherId);
    expect(dispatcher?.name).toBe(newName);
    expect(dispatcher?.phone).toBe(newPhone);
  });

  it('should update dispatcher password', async () => {
    const newPassword = 'NewPassword456!';
    
    await updateDispatcherPassword(testDispatcherId, newPassword);
    
    // Verify old password doesn't work
    const oldVerify = await verifyDispatcherPassword(testEmail, testPassword);
    expect(oldVerify).toBeNull();
    
    // Verify new password works
    const newVerify = await verifyDispatcherPassword(testEmail, newPassword);
    expect(newVerify).toBeDefined();
    expect(newVerify?.id).toBe(testDispatcherId);
  });

  it('should delete dispatcher', async () => {
    // Create a new dispatcher to delete
    const tempEmail = 'temp.dispatcher@example.com';
    await createDispatcher(tempEmail, testPassword, 'Temp Dispatcher');
    
    const tempDispatcher = await getDispatcherByEmail(tempEmail);
    expect(tempDispatcher).toBeDefined();
    
    // Delete it
    await deleteDispatcher(tempDispatcher!.id);
    
    // Verify it's deleted
    const deleted = await getDispatcherByEmail(tempEmail);
    expect(deleted).toBeNull();
  });
});
