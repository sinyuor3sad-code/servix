// Quick test script for Gemini API via Cloudflare proxy
const url = 'https://orange-morning-06c4.sinyuor3sad.workers.dev/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyA-A1u8WfLGocRExFUdkwmSsPQ7q6uv6Mo';

async function test() {
  try {
    console.log('Testing Gemini API...');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: 'قل مرحبا' }] },
        ],
        generationConfig: { maxOutputTokens: 100, temperature: 0.5 },
      }),
    });
    console.log('Status:', res.status);
    const data = await res.text();
    console.log('Response:', data.substring(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
