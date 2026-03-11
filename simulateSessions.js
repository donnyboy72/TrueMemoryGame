import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const CONFIG = {
  url: 'http://localhost:5173',
  sessionsPerCategory: 10,
  categories: [
    {
      name: 'well_rested',
      score: 0,
      rtRange: [200, 280],
      pixelOffset: 10,
      errorProb: 0.02,
    },
    {
      name: 'moderately_rested',
      score: 1,
      rtRange: [280, 380],
      pixelOffset: 20,
      errorProb: 0.06,
    },
    {
      name: 'tired',
      score: 2,
      rtRange: [380, 550],
      pixelOffset: 35,
      errorProb: 0.12,
    },
    {
      name: 'extremely_tired',
      score: 3,
      rtRange: [550, 900],
      pixelOffset: 60,
      errorProb: 0.20,
    },
  ],
  fatigueDrift: [5, 20], // ms per trial
};

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

async function runCategory(browser, category, globalSessions) {
  console.log(`\n--- Starting simulation for: ${category.name} ---`);
  
  for (let s = 0; s < CONFIG.sessionsPerCategory; s++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let sequence = [];

    await page.goto(CONFIG.url);
    await page.click('button:has-text("Start Game")');

    let sessionActive = true;
    let trialNum = 0;

    while (sessionActive) {
      trialNum++;
      sequence = [];
      const sequenceObserver = async () => {
        while (true) {
          try {
            const litTile = await page.waitForSelector('.tile.lit', { timeout: 3000 });
            const index = await litTile.getAttribute('data-tile-index');
            const idx = parseInt(index);
            if (sequence.length === 0 || sequence[sequence.length - 1] !== idx) {
              sequence.push(idx);
            }
            await page.waitForSelector(`.tile[data-tile-index="${idx}"]:not(.lit)`, { timeout: 2000 });
          } catch (e) {
            break;
          }
        }
      };

      await sequenceObserver();

      try {
        await page.waitForSelector('.status-turn', { timeout: 5000 });
      } catch (e) {
        sessionActive = false;
        break;
      }

      const baseRT = getRandom(category.rtRange[0], category.rtRange[1]);
      
      for (let i = 0; i < sequence.length; i++) {
        const drift = trialNum * getRandom(CONFIG.fatigueDrift[0], CONFIG.fatigueDrift[1]);
        const reactionDelay = baseRT + drift;
        
        await page.waitForTimeout(reactionDelay);

        let targetIndex = sequence[i];

        if (Math.random() < category.errorProb) {
          const row = Math.floor(targetIndex / 4);
          const col = targetIndex % 4;
          const neighbors = [];
          if (row > 0) neighbors.push(targetIndex - 4);
          if (row < 3) neighbors.push(targetIndex + 4);
          if (col > 0) neighbors.push(targetIndex - 1);
          if (col < 3) neighbors.push(targetIndex + 1);
          targetIndex = neighbors[Math.floor(Math.random() * neighbors.length)];
          console.log(`[Sim] Error simulated: clicking ${targetIndex} instead of ${sequence[i]}`);
        }

        const tile = page.locator(`.tile[data-tile-index="${targetIndex}"]`);
        const box = await tile.boundingBox();
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const offsetX = getRandom(-category.pixelOffset, category.pixelOffset);
        const offsetY = getRandom(-category.pixelOffset, category.pixelOffset);
        
        await page.mouse.click(centerX + offsetX, centerY + offsetY);
        await page.waitForTimeout(200);
        
        const statusPanel = await page.locator('.status-panel').innerText();
        if (statusPanel.includes('Incorrect') || statusPanel.includes('Game Over')) {
          sessionActive = false;
          break;
        }
      }

      if (sessionActive) {
        try {
          const nextBtn = page.locator('button:has-text("Next Sequence")');
          await nextBtn.waitFor({ state: 'visible', timeout: 5000 });
          await nextBtn.click();
        } catch (e) {
          sessionActive = false;
          break;
        }
      } else {
        try {
            const resultsBtn = page.locator('button:has-text("Show Results")');
            if (await resultsBtn.isVisible()) {
                await resultsBtn.click();
            }
        } catch(e) {}
        
        const lastSession = await page.evaluate(() => {
          const sessions = JSON.parse(localStorage.getItem('memory_game_sessions') || '[]');
          return sessions[sessions.length - 1];
        });

        if (lastSession) {
          lastSession.fatigue_category = category.name;
          lastSession.fatigue_score = category.score;
          globalSessions.push(lastSession);
        }

        console.log(`[Sim] Session ${s+1} completed for ${category.name}`);
        break;
      }
    }
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const globalSessions = [];

  for (const category of CONFIG.categories) {
    await runCategory(browser, category, globalSessions);
  }

  fs.writeFileSync('summary.json', JSON.stringify(globalSessions, null, 2));
  console.log(`\nSimulation complete. ${globalSessions.length} sessions saved to summary.json`);

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
