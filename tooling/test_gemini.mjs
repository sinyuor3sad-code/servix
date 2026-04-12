const key = 'AIzaSyBGQFpS_SwFy_hO-dIh4tIm8R-xQ8F0y84';

async function listModels() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
  const data = await res.json();
  if (data.models) {
    data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .forEach(m => console.log(m.name));
  } else {
    console.log('Error:', JSON.stringify(data).substring(0, 300));
  }
}

listModels();
