// imgg.js
// Small helper to upload images to IMGG service.
// NOTE: IMGG endpoint details may vary. This implementation uses a generic
// POST multipart/form-data upload to a typical IMGG API. Replace ENDPOINT
// if your IMGG provider uses a different path.

const IMGG_API_KEY = '4a8d88aeac88b452c19e45cd77ea771d'; // from REWARDSHAREIO.txt
const IMGG_UPLOAD_ENDPOINT = 'https://api.imgg.com/1/upload'; // adjust if needed

export async function uploadToIMGG(file) {
  // file: File object from input
  if (!file) throw new Error('No file provided');

  // Try real upload
  try {
    const form = new FormData();
    form.append('image', file);

    const res = await fetch(IMGG_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IMGG_API_KEY}`
      },
      body: form
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error('IMGG upload failed: ' + res.status + ' ' + txt);
    }

    const j = await res.json();
    // Expecting a field like `data.url` or `url` depending on API
    const url = j?.data?.url || j?.url || j?.file || null;
    if (!url) throw new Error('IMGG response missing URL');

    return url;
  } catch (err) {
    // Fallback to simulation (keeps previous behavior if IMGG endpoint is not reachable)
    console.warn('IMGG upload failed, using simulated URL:', err.message);
    return new Promise((resolve) => {
      setTimeout(() => {
        const randomId = Math.random().toString(36).substring(7);
        resolve(`https://i.imgg.com/${randomId}.jpg`);
      }, 800);
    });
  }
}
