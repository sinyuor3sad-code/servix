const url = 'https://orange-morning-06c4.sinyuor3sad.workers.dev/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyA-A1u8WfLGocRExFUdkwmSsPQ7q6uv6Mo';
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'قل مرحبا باللغة العربية في جملة واحدة' }] }],
    generationConfig: { maxOutputTokens: 100 }
  })
})
.then(async r => {
  const body = await r.text();
  console.log('STATUS:', r.status);
  console.log('BODY:', body.substring(0, 500));
})
.catch(e => console.error('ERROR:', e.message));
