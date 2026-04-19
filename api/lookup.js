export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ean } = req.query;
  if (!ean) return res.status(400).json({ error: 'EAN manquant' });

  try {
    // Step 1: POST to voxgaming search with EAN
    const searchRes = await fetch('https://www.voxgaming.fr/search/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Origin': 'https://www.voxgaming.fr',
        'Referer': 'https://www.voxgaming.fr/'
      },
      body: `q=${encodeURIComponent(ean)}&bscanner=&submitSearch=1`,
      redirect: 'follow'
    });

    if (!searchRes.ok) {
      return res.status(404).json({ error: 'Jeu non trouvé' });
    }

    const finalUrl = searchRes.url;

    // Check if we landed on a product page (not search results)
    if (finalUrl.includes('/search') || finalUrl === 'https://www.voxgaming.fr/search/') {
      return res.status(404).json({ error: 'Jeu non trouvé dans la base voxgaming' });
    }

    const html = await searchRes.text();

    // Extract title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*game-title[^"]*"[^>]*>(.*?)<\/h1>/s)
      || html.match(/<h1[^>]*>(.*?)<span/s)
      || html.match(/<h1[^>]*>([^<]+)/);
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;
    // Remove platform suffix like "sur Xbox Series X"
    if (title) title = title.replace(/\s+sur\s+.+$/i, '').trim();

    // Extract platform from URL or breadcrumb
    let platform = null;
    if (finalUrl.includes('/switch/') || finalUrl.includes('/nintendo-switch/')) platform = 'Switch';
    else if (finalUrl.includes('/ps5/') || finalUrl.includes('/playstation-5/')) platform = 'PS5';
    else if (finalUrl.includes('/ps4/') || finalUrl.includes('/playstation-4/')) platform = 'PS4';
    else if (finalUrl.includes('/ps3/')) platform = 'PS3';
    else if (finalUrl.includes('/xbox-series/') || finalUrl.includes('/xbox-series-x/')) platform = 'Xbox Series X';
    else if (finalUrl.includes('/xbox-one/')) platform = 'Xbox One';
    else if (finalUrl.includes('/xbox-360/')) platform = 'Xbox 360';
    else if (finalUrl.includes('/pc/')) platform = 'PC';

    // If not in URL, try breadcrumb
    if (!platform) {
      const breadMatch = html.match(/Jeux vidéo[^<]*>[^<]*<[^>]+>([^<]+)</);
      if (breadMatch) {
        const bc = breadMatch[1].trim();
        if (bc.includes('Switch')) platform = 'Switch';
        else if (bc.includes('PS5')) platform = 'PS5';
        else if (bc.includes('PS4')) platform = 'PS4';
        else if (bc.includes('Xbox Series')) platform = 'Xbox Series X';
        else if (bc.includes('Xbox One')) platform = 'Xbox One';
        else if (bc.includes('PC')) platform = 'PC';
      }
    }

    // Extract cover image
    const coverMatch = html.match(/<img[^>]*class="[^"]*game-cover[^"]*"[^>]*src="([^"]+)"/i)
      || html.match(/<img[^>]*id="[^"]*cover[^"]*"[^>]*src="([^"]+)"/i)
      || html.match(/class="[^"]*fancybox[^"]*"[^>]*href="([^"]+\.jpg)"/i)
      || html.match(/<img[^>]*src="(https:\/\/[^"]*voxgaming[^"]*\.(jpg|png|webp))"/i)
      || html.match(/<img[^>]*src="([^"]*\/img\/[^"]*\.(jpg|png|webp))"/i);
    let cover = coverMatch ? coverMatch[1] : null;
    if (cover && cover.startsWith('/')) cover = 'https://www.voxgaming.fr' + cover;

    if (!title) {
      return res.status(404).json({ error: 'Impossible d\'extraire les infos du jeu' });
    }

    return res.status(200).json({ title, platform, cover, url: finalUrl });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
