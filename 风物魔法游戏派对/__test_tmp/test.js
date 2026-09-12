// AI调色工坊 分辨率下载功能 端到端测试
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const DL = path.join(__dirname, 'downloads');
fs.mkdirSync(DL, { recursive: true });

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  const results = [];
  async function downloadAndCheck(label, expectW, expectH) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#previewModeBar .btn-primary')
    ]);
    const file = path.join(DL, label + '_' + download.suggestedFilename());
    await download.saveAs(file);
    const { w, h } = pngSize(file);
    const ok = w === expectW && h === expectH;
    results.push({ label, file: download.suggestedFilename(), got: `${w}x${h}`, expect: `${expectW}x${expectH}`, ok });
    const toast = await page.textContent('#toast');
    results.push({ label: label + ' toast', toast });
  }

  await page.goto('http://127.0.0.1:8123');
  await page.waitForTimeout(1200);

  // 折叠右下角提示浮窗，避免遮挡按钮
  await page.click('.hint-head');
  await page.waitForTimeout(200);

  // 进入工坊
  await page.click('.nav-btn[data-page="workshop"]');
  await page.waitForTimeout(400);

  // 选内置已解锁线稿（默认解锁 tea）
  await page.click('#galleryGrid .g-cell:not(.locked):not(.g-add)');
  await page.click('#btnMagic');
  await page.waitForSelector('#previewResult:not(.hidden)', { timeout: 15000 });

  // 明信片：检查下拉选项
  const optsPostcard = await page.$$eval('#resSelect option', os => os.map(o => o.textContent));
  const valPostcard = await page.$eval('#resSelect', s => s.value);
  results.push({ label: '明信片选项', opts: optsPostcard, selected: valPostcard });

  // 明信片 超清 2400×1520
  await page.selectOption('#resSelect', '2');
  await downloadAndCheck('明信片超清', 2400, 1520);

  // 切礼盒：选项应切换
  await page.click('.mode-btn[data-mode="teabox"]');
  await page.waitForTimeout(300);
  const optsTeabox = await page.$$eval('#resSelect option', os => os.map(o => o.textContent));
  const valTeabox = await page.$eval('#resSelect', s => s.value);
  results.push({ label: '礼盒选项', opts: optsTeabox, selected: valTeabox });

  // 礼盒 打印 2500×2500
  await page.selectOption('#resSelect', '3');
  await downloadAndCheck('礼盒打印', 2500, 2500);

  // 切回明信片：应恢复记忆的“超清”(index 2)
  await page.click('.mode-btn[data-mode="postcard"]');
  await page.waitForTimeout(300);
  const valBack = await page.$eval('#resSelect', s => s.value);
  results.push({ label: '切回明信片记忆档位', selected: valBack, expect: '2', ok: valBack === '2' });

  // 明信片 标准 1200×760（默认档回归）
  await page.selectOption('#resSelect', '0');
  await downloadAndCheck('明信片标准', 1200, 760);

  // ---- 自定义上传图 高分辨率 ----
  await page.setInputFiles('#customUpload', path.join(__dirname, 'test-upload.png'));
  await page.waitForSelector('#inputModal:not(.hidden)', { timeout: 8000 });
  await page.fill('#inputModalField', '测试条纹');
  await page.click('#inputModalOk');
  await page.waitForTimeout(600);
  await page.click('#btnMagic');
  await page.waitForSelector('#previewResult:not(.hidden)', { timeout: 15000 });
  // 礼盒 超清 2000×2000
  await page.click('.mode-btn[data-mode="teabox"]');
  await page.waitForTimeout(300);
  await page.selectOption('#resSelect', '2');
  await downloadAndCheck('自定义礼盒超清', 2000, 2000);

  // 提示浮窗文案检查
  const hint = await page.textContent('#hintBody');
  results.push({ label: '提示浮窗含分辨率说明', ok: /分辨率/.test(hint), excerpt: hint.slice(0, 120) });

  results.push({ label: 'console错误', errors: errors.length ? errors : '无' });

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
