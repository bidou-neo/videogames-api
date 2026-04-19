export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ean } = req.query;
  if (!ean) return res.status(400).json({ error: 'EAN manquant' });

  try {
    const searchRes = await fetch('https://www.voxgaming.fr/search/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Origin': 'https://www.voxgaming.fr',
        'Referer': 'https://www.voxgaming.fr/'
      },
      body: `q=${encodeURIComponent(ean)}&bscanner=&submitSearch=1`,
      redirect: 'follow'
    });

    if (!searchRes.ok) return res.status(404).json({ error: 'Jeu non trouvé' });

    const finalUrl = searchRes.url;
    if (finalUrl.includes('/search') || finalUrl === 'https://www.voxgaming.fr/search/') {
      return res.status(404).json({ error: 'Jeu non trouvé dans la base voxgaming' });
    }

    const html = await searchRes.text();

    // --- PLATFORM from URL ---
    const urlPlatformMap = {
      '/xbox-series/': 'Xbox Series X',
      '/xbox-one/': 'Xbox One',
      '/xbox360/': 'Xbox 360',
      '/xbox/': 'Xbox',
      '/ps5/': 'PS5',
      '/ps4/': 'PS4',
      '/ps3/': 'PS3',
      '/ps2/': 'PS2',
      '/ps1/': 'PS1',
      '/switch2/': 'Switch',
      '/switch/': 'Switch',
      '/wii-u/': 'Wii U',
      '/wii/': 'Wii',
      '/gamecube/': 'GameCube',
      '/nintendo-64/': 'N64',
      '/super-nintendo/': 'SNES',
      '/nes/': 'NES',
      '/gameboy/': 'Game Boy',
      '/gameboyadvance/': 'GBA',
      '/nintendo-ds/': 'DS',
      '/nitnendo-3ds/': '3DS',
      '/master-system/': 'Master System',
      '/megadrive/': 'Mega Drive',
      '/saturn/': 'Saturn',
      '/dreamcast/': 'Dreamcast',
      '/pc/': 'PC',
    };
    let platform = null;
    for (const [key, val] of Object.entries(urlPlatformMap)) {
      if (finalUrl.includes(key)) { platform = val; break; }
    }

    // --- TITLE from og:title, strip "Prix " prefix and platform suffix ---
    let title = null;
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
                 || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
    if (ogTitle) {
      title = ogTitle[1]
        .replace(/^Prix\s+/i, '')
        .replace(/\s*:\s*Cote\s*[&&].*$/i, '')
        .replace(/\s*-\s*Prix.*$/i, '')
        .replace(/\s+sur\s+(Xbox Series X|Xbox One|Xbox 360|Xbox|PS5|PS4|PS3|PS2|PS1|Switch|PC|Wii U|Wii|GameCube|N64|SNES|NES|Game Boy|GBA|DS|3DS|Master System|Mega Drive|Saturn|Dreamcast)\s*$/i, '')
        .trim();
    }

    // Fallback: page <title>
    if (!title) {
      const pageTitle = html.match(/<title>([^<]+)<\/title>/i);
      if (pageTitle) {
        title = pageTitle[1]
          .replace(/^Prix\s+/i, '')
          .replace(/\s*:?\s*Cote.*$/i, '')
          .replace(/\s*-?\s*Prix.*$/i, '')
          .replace(/\s+sur\s+\S+.*$/i, '')
          .trim();
      }
    }

    // --- COVER: look for product image in HTML (not og:image which is the logo) ---
    let cover = null;

    // Try fancybox link (main product image)
    const fancyMatch = html.match(/class="fancybox"[^>]*href="([^"]+\.(?:jpg|png|webp))"/i)
                    || html.match(/href="([^"]+\.(?:jpg|png|webp))"[^>]*class="fancybox"/i);
    if (fancyMatch) cover = fancyMatch[1];

    // Try img with product/cover in src
    if (!cover) {
      const imgMatches = [...html.matchAll(/<img[^>]*src="([^"]+\/img\/(?:catalog|product|jeux|cover)[^"]+\.(?:jpg|png|webp))"/gi)];
      if (imgMatches.length) cover = imgMatches[0][1];
    }

    // Try any large img near the title area
    if (!cover) {
      const imgMatches = [...html.matchAll(/<img[^>]*src="(https?:\/\/(?:www\.)?voxgaming\.fr\/img\/[^"]+\.(?:jpg|png|webp))"/gi)];
      const filtered = imgMatches.map(m => m[1]).filter(u => !u.includes('logo') && !u.includes('og-vox') && !u.includes('banner') && !u.includes('icon'));
      if (filtered.length) cover = filtered[0];
    }

    if (cover && cover.startsWith('/')) cover = 'https://www.voxgaming.fr' + cover;

    if (!title) return res.status(404).json({ error: 'Titre non trouvé' });

    return res.status(200).json({ title, platform, cover, url: finalUrl });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
