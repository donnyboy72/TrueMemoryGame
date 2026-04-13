import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const CONFIG = {
  url: 'http://localhost:5173',
  sessionsPerCategory: 15, // Increased for better statistical significance
  categories: [
    {
      name: 'well_rested',
      score: 0,
      rtRange: [200, 320],
      pixelOffset: 12,
      errorProb: 0.03,
    },
    {
      name: 'somewhat_rested',
      score: 1,
      rtRange: [320, 550],
      pixelOffset: 25,
      errorProb: 0.08,
    },
    {
      name: 'severely_tired',
      score: 2,
      rtRange: [550, 950],
      pixelOffset: 50,
      errorProb: 0.18,
    },
  ],
  fatigueDrift: [8, 25], // ms per trial increase
};

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * HIPAA Compliance: Strips any fields that might contain PII or absolute timestamps.
 * Ensures only the research-relevant metrics are kept.
 */
function cleanSession(session) {
  if (!session) return null;
  
  // Create a new object with only allowed fields
  const cleaned = {
    sessionId: session.sessionId || session.session_id,
    task_type: session.task_type || "memory_sequence",
    number_of_trials: session.number_of_trials,
    max_sequence_length: session.max_sequence_length,
    average_accuracy: session.average_accuracy,
    average_reaction_time_ms: session.average_reaction_time_ms,
    average_spatial_distance_error: session.average_spatial_distance_error,
    average_pixel_distance_error: session.average_pixel_distance_error,
    sessionDuration: session.sessionDuration,
    timeOfDay: session.timeOfDay,
    fatigue_category: session.fatigue_category,
    fatigue_score: session.fatigue_score
  };

  // Explicitly ensure no date/timestamp fields remain
  delete cleaned.session_timestamp;
  delete cleaned.timestamp_relative_ms;
  delete cleaned.created_at;
  delete cleaned.user_id; // PII-adjacent if not hashed

  return cleaned;
}

async function runCategory(browser, category, globalSessions) {
  console.log(`\n--- Starting simulation for: ${category.name} ---`);
  
  for (let s = 0; s < CONFIG.sessionsPerCategory; s++) {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    let sequence = [];

    await page.goto(CONFIG.url);
    // Wait for the game to be ready
    await page.waitForSelector('button:has-text("Start Game")');
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
          // Simulate spatial error: click a neighbor
          const row = Math.floor(targetIndex / 4);
          const col = targetIndex % 4;
          const neighbors = [];
          if (row > 0) neighbors.push(targetIndex - 4);
          if (row < 3) neighbors.push(targetIndex + 4);
          if (col > 0) neighbors.push(targetIndex - 1);
          if (col < 3) neighbors.push(targetIndex + 1);
          if (neighbors.length > 0) {
            targetIndex = neighbors[Math.floor(Math.random() * neighbors.length)];
            console.log(`[Sim] Error simulated: clicking ${targetIndex} instead of ${sequence[i]}`);
          }
        }

        const tile = page.locator(`.tile[data-tile-index="${targetIndex}"]`);
        const box = await tile.boundingBox();
        if (box) {
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          const offsetX = getRandom(-category.pixelOffset, category.pixelOffset);
          const offsetY = getRandom(-category.pixelOffset, category.pixelOffset);
          
          await page.mouse.click(centerX + offsetX, centerY + offsetY);
        }
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
            await page.waitForTimeout(1000);
        } catch(e) {}
        
        const lastSessionRaw = await page.evaluate(() => {
          const sessions = JSON.parse(localStorage.getItem('memory_game_sessions') || '[]');
          return sessions[sessions.length - 1];
        });

        const lastSession = cleanSession(lastSessionRaw);

        if (lastSession) {
          lastSession.fatigue_category = category.name;
          lastSession.fatigue_score = category.score;
          globalSessions.push(lastSession);
          console.log(`[Sim] Session ${s+1} completed for ${category.name} (Acc: ${lastSession.average_accuracy.toFixed(2)}, RT: ${Math.round(lastSession.average_reaction_time_ms)})`);
        }

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

  // Calculate Mean Statistics for each category
  const summary = {};
  for (const cat of CONFIG.categories) {
    const catSessions = globalSessions.filter(s => s.fatigue_category === cat.name);
    if (catSessions.length > 0) {
      summary[cat.name] = {
        mean_accuracy: catSessions.reduce((sum, s) => sum + s.average_accuracy, 0) / catSessions.length,
        mean_reaction_time_ms: catSessions.reduce((sum, s) => sum + s.average_reaction_time_ms, 0) / catSessions.length,
        mean_spatial_distance_error: catSessions.reduce((sum, s) => sum + s.average_spatial_distance_error, 0) / catSessions.length,
      };
    }
  }

  fs.writeFileSync('summary.json', JSON.stringify(summary, null, 2));
  console.log(`\nSimulation complete.`);
  console.log(`Summary saved to summary.json:`, summary);

  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

