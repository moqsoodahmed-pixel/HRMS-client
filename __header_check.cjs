const { chromium } = require('playwright');
const OUT = 'C:/Users/ADMIN/AppData/Local/Temp/claude';

async function run() {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto('http://localhost:5199/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().waitFor({ timeout: 20000 });
  await page.locator('input[type="email"]').first().fill('hr@launcherdesk.com');
  await page.locator('input[type="password"]').first().fill('Admin@123456');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 }).catch(() => {});

  await page.goto('http://localhost:5199/appointment-letters', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const newLetterBtn = page.getByRole('button', { name: /new letter/i }).first();
  if (await newLetterBtn.count() > 0) { await newLetterBtn.click(); await page.waitForTimeout(500); }
  await page.waitForTimeout(1500);

  // Draw a bright red outline exactly around the header DOM element (the
  // A4 page's first child) and around the <img> inside it, plus a solid
  // yellow line exactly at the true bottom edge of each — so the real
  // rendered boundary is unambiguous in the screenshot, independent of
  // however the screenshot itself gets cropped.
  const measurements = await page.evaluate(() => {
    const pageEl = document.querySelector('.bg-white.shadow-xl');
    if (!pageEl) return null;
    const header = pageEl.firstElementChild;
    const img = header.querySelector('img');
    header.style.outline = '4px solid red';
    img.style.outline = '3px solid lime';
    const hRect = header.getBoundingClientRect();
    const iRect = img.getBoundingClientRect();
    const marker = document.createElement('div');
    marker.style.cssText = `position:fixed; left:0; top:${hRect.bottom}px; width:100vw; height:2px; background:yellow; z-index:99999;`;
    document.body.appendChild(marker);
    return {
      headerRect: { top: hRect.top, bottom: hRect.bottom, left: hRect.left, right: hRect.right, width: hRect.width, height: hRect.height },
      imgRect: { top: iRect.top, bottom: iRect.bottom, left: iRect.left, right: iRect.right, width: iRect.width, height: iRect.height },
      imgNatural: { w: img.naturalWidth, h: img.naturalHeight },
      imgComputedObjectFit: getComputedStyle(img).objectFit,
      headerComputedOverflow: getComputedStyle(header).overflow,
      pageRect: (() => { const r = pageEl.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })(),
    };
  });

  // Full-page screenshot with generous extra height below the header so any
  // "did the screenshot just cut it off" ambiguity is eliminated.
  await page.screenshot({ path: `${OUT}/header_marked_full.png` });

  // Also a tight crop well past the marked boundary (200px of extra margin
  // below the yellow line) for close inspection.
  const pageEl = await page.$('.bg-white.shadow-xl');
  const box = await pageEl.boundingBox();
  await page.screenshot({
    path: `${OUT}/header_marked_close.png`,
    clip: { x: Math.max(box.x - 10, 0), y: Math.max(box.y - 10, 0), width: box.width + 20, height: 400 },
  });

  console.log(JSON.stringify(measurements, null, 2));
  await browser.close();
}

run().catch(e => { console.error('FAIL', e.message); process.exit(1); });
