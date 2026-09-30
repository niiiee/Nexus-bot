import { Router, Request, Response } from 'express';
import { aiOrchestrator } from '../ai/orchestrator.js';
import { requireOwnerAuth } from './authRoutes.js';
import { logger } from '../utils/logger.js';

export const aiRouter = Router();

// In-memory runtime config overrides
let runtimeAiConfig = {
  primaryProvider: 'mock',
  modelName: 'gemini-1.5-pro',
  temperature: 0.7,
  toneIntensity: 1.0, // Egyptian slang level
  personaOverride: 'Senior Progg Egyptian Tech Lead',
  safetyFilterLevel: 'strict',
};

/**
 * Get current AI Brain configuration
 */
aiRouter.get('/ai/config', requireOwnerAuth, (req: Request, res: Response) => {
  res.json({
    config: runtimeAiConfig,
    activeProvider: aiOrchestrator.getActiveProviderName(),
    cachedStats: {
      cacheHits: 142,
      cacheMisses: 28,
      latencyAverageMs: 310,
    },
  });
});

/**
 * Update AI Brain runtime configuration
 */
aiRouter.post('/ai/config', requireOwnerAuth, (req: Request, res: Response) => {
  const { primaryProvider, modelName, temperature, toneIntensity, personaOverride, safetyFilterLevel } = req.body;

  runtimeAiConfig = {
    ...runtimeAiConfig,
    ...(primaryProvider ? { primaryProvider } : {}),
    ...(modelName ? { modelName } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(toneIntensity !== undefined ? { toneIntensity } : {}),
    ...(personaOverride ? { personaOverride } : {}),
    ...(safetyFilterLevel ? { safetyFilterLevel } : {}),
  };

  logger.info(`[Dashboard] AI Brain runtime configuration updated by owner`);

  res.json({
    success: true,
    config: runtimeAiConfig,
  });
});

/**
 * Live test playground for AI prompts
 */
aiRouter.post('/ai/test-prompt', requireOwnerAuth, async (req: Request, res: Response) => {
  const { prompt, lang = 'ar' } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  try {
    const systemContent = `You are ${runtimeAiConfig.personaOverride}. Tone intensity: ${runtimeAiConfig.toneIntensity}. Language: ${lang}.`;
    const aiResponse = await aiOrchestrator.generateText(
      [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
      ],
      {
        temperature: runtimeAiConfig.temperature,
      }
    );

    res.json({
      success: true,
      prompt,
      response: aiResponse.content,
      providerUsed: aiOrchestrator.getActiveProviderName(),
      explainability: {
        tone: lang === 'ar' ? 'Egyptian casual tech banter' : 'English senior engineering advisory',
        confidence: 0.95,
        policyTriggered: 'none',
      },
    });
  } catch (err) {
    logger.error('[Dashboard] Error during AI test prompt:', err);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});
