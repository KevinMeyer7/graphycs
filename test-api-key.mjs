import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

console.log('Testing API key:', apiKey.slice(0, 4) + '...' + apiKey.slice(-4));

const openai = new OpenAI({ apiKey });

try {
  console.log('\nTesting with a simple models list request...');
  const models = await openai.models.list();
  console.log('✅ API KEY IS VALID!');
  console.log('Available models:', models.data.slice(0, 3).map(m => m.id));
} catch (error) {
  console.error('❌ API KEY TEST FAILED:');
  console.error('Error:', error.message);
  console.error('Status:', error.status);
  console.error('Type:', error.type);
  process.exitCode = 1;
}
