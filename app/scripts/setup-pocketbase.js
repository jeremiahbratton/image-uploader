const { PocketBase } = require('pocketbase');

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8080';
const pb = new PocketBase(POCKETBASE_URL);

async function setupCollection() {
  try {
    // Wait for PocketBase to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if collection exists
    try {
      await pb.collection('images').getFullList({ limit: 1 });
      console.log('Images collection already exists');
      return;
    } catch (error) {
      // Collection doesn't exist, create it
      if (error.status === 404) {
        console.log('Creating images collection...');
        
        // Note: This requires admin authentication
        // For production, you would need to authenticate first
        // For now, the migration file will handle this
        console.log('Collection will be created via migration on first PocketBase startup');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error setting up PocketBase collection:', error.message);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupCollection();
}

module.exports = { setupCollection };

