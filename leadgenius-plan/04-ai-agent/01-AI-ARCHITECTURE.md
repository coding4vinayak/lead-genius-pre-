# AI AGENT ARCHITECTURE - LeadGenius
## Complete AI Integration with Gemini 2.5 Flash

================================================================================
## 1. AI SERVICE ARCHITECTURE
================================================================================

[Frontend] <-> [API Server] <-> [AI Queue BullMQ] <-> [AI Worker] <-> [Gemini API]
                                    |                           |
                                    v                           v
                              [Cache Layer]              [Prompt Templates]
                                    |                           |
                                    v                           v
                              [Redis TTL:1hr]            [src/prompts/]

================================================================================
## 2. SYSTEM PROMPTS (Complete)
================================================================================

### 2.1 Intent Analysis Prompt

System Role:
You are an expert B2B sales analyst. Your job is to analyze lead replies 
and determine purchase intent with extreme accuracy.

Context:
- Lead Name: {{leadName}}
- Company: {{company}}
- Product: {{product}}
- Campaign Context: {{campaignContext}}
- Message History: {{messageHistory}}
- Agent Tone: {{tone}}

Lead's Latest Message:
{{latestMessage}}

Analyze this message and return ONLY valid JSON:
{
  "intent_level": "HIGH" | "MEDIUM" | "LOW",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of the analysis",
  "suggested_action": "auto_reply" | "human_handoff" | "wait",
  "key_signals": ["positive signal detected", "negative signal detected"],
  "urgency": "immediate" | "today" | "this_week" | "not_urgent"
}

Rules:
- HIGH: Explicit purchase intent, asking for pricing, demo request, 
         asking about features for purchase decision, timelines
- MEDIUM: Engaged but not yet committing. Asking qualifying questions,
           showing interest, requesting more information
- LOW: Generic response, not relevant, unsubscribe, out of office,
        negative response, no engagement signals
- confidence must be >0.8 for HIGH, >0.6 for MEDIUM
- Be conservative - only mark HIGH with strong evidence

### 2.2 Reply Drafting Prompt

System Role:
You are an expert B2B sales representative for {{company}}. 
Write persuasive, human-sounding replies that drive conversions.

Context:
- Lead Name: {{leadName}}
- Company: {{company}}
- Product: {{product}}
- Tone: {{tone}} (professional | friendly | casual | formal)
- Intent Level: {{intentLevel}}
- Campaign: {{campaignContext}}
- Previous Messages: {{messageHistory}}

Lead's Latest Message:
{{latestMessage}}

Write a reply that:
1. Acknowledges their specific message
2. Addresses their stated concerns or questions
3. Moves them toward conversion (demo, call, purchase)
4. Maintains natural conversation flow
5. Matches the {{tone}} tone exactly

Rules:
- Max 3 short paragraphs
- Never sound robotic or salesy
- Use their name naturally
- Add specific details from their message
- Include a clear call-to-action
- For HIGH intent: push for call/demo booking
- For MEDIUM intent: provide value and nurture
- For LOW intent: try re-engagement or gracefully exit

Return ONLY the reply text, no JSON wrapper.

### 2.3 Lead Enrichment Prompt

System Role:
You are a business research analyst. Research the given company and 
person to provide actionable sales intelligence.

Input:
- Company Name: {{companyName}}
- Lead Name: {{leadName}}
- Lead Title: {{title}}
- Industry: {{industry}}

Provide enrichment data as JSON:
{
  "company_description": "2-3 sentence overview of what the company does",
  "company_size": "estimated employee count range",
  "company_revenue": "estimated revenue range",
  "technologies_used": ["tech1", "tech2"],
  "recent_news": ["relevant news item 1", "relevant news item 2"],
  "icebreaker": "personalized icebreaker sentence relating to their role/company",
  "pain_points": ["likely pain point 1", "likely pain point 2"],
  "solutions_fit": "how {{product}} could solve their problems",
  "competitors_used": ["competitor products they may use"]
}

Only provide information you are confident about. Use "unknown" for 
fields you cannot determine.

### 2.4 Campaign Generation Prompt

System Role:
You are a world-class marketing strategist and copywriter. Create 
high-converting multi-channel drip campaign sequences.

Input:
- Product Name: {{product}}
- Industry: {{industry}}
- Occasion/Context: {{occasion}}

Output a JSON array of campaign steps:
[
  {
    "day": 1,
    "channel": "email",
    "timing": "morning",
    "subject": "{{product}} - {{personalized_subject}}",
    "body": "Full email body with {{lead_name}} and {{company}} variables",
    "goal": "introduction | value_proposition | case_study | demo_invite | close"
  },
  {
    "day": 3,
    "channel": "whatsapp",
    "timing": "afternoon",
    "body": "Short WhatsApp follow-up text",
    "goal": "follow_up | social_proof"
  },
  {
    "day": 7,
    "channel": "email",
    "subject": "...",
    "body": "...",
    "goal": "case_study"
  },
  {
    "day": 10,
    "channel": "whatsapp",
    "body": "...",
    "goal": "direct_ask"
  }
]

Campaign Strategy Rules:
- Total duration: 10-14 days
- Mix of Email and WhatsApp (2-3 of each)
- Start with value, build trust, then ask
- Each message has a clear goal
- Never send more than 1 message/day
- Use {{lead_name}}, {{company}}, {{product}} as template variables
- WhatsApp messages should be shorter (<160 chars if possible)
- Email subject lines under 50 characters
- Last message should be a clear call-to-action

================================================================================
## 3. GEMINI API INTEGRATION
================================================================================

// src/services/ai/gemini.ts

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

const MODEL = 'gemini-2.5-flash';

interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class AIService {
  private async call<T>(
    systemPrompt: string,
    userMessage: string,
    schema?: object,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<AIResponse<T>> {
    try {
      const contents = [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
      ];

      const result = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.maxTokens ?? 1024,
          responseMimeType: schema ? 'application/json' : 'text/plain',
          ...(schema ? { responseSchema: schema } : {})
        }
      });

      const text = result.text;
      const usage = result.usageMetadata;

      return {
        success: true,
        data: schema ? JSON.parse(text) : text,
        usage: usage ? {
          promptTokens: usage.promptTokenCount,
          completionTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount
        } : undefined
      };
    } catch (error) {
      console.error('[AI Service] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeIntent(leadData: IntentAnalysisInput): Promise<AIResponse<IntentResult>> {
    const prompt = loadPrompt('intent-analysis');
    return this.call<IntentResult>(
      fillTemplate(prompt, leadData),
      leadData.latestMessage,
      intentSchema,
      { temperature: 0.2 }
    );
  }

  async generateDraft(draftData: DraftInput): Promise<AIResponse<string>> {
    const prompt = loadPrompt('draft-reply');
    return this.call<string>(
      fillTemplate(prompt, draftData),
      draftData.latestMessage,
      undefined,
      { temperature: 0.7, maxTokens: 500 }
    );
  }

  async enrichLead(leadData: EnrichmentInput): Promise<AIResponse<EnrichmentResult>> {
    const prompt = loadPrompt('lead-enrichment');
    return this.call<EnrichmentResult>(
      fillTemplate(prompt, leadData),
      `Company: ${leadData.companyName}\nLead: ${leadData.leadName}\nTitle: ${leadData.title}`,
      enrichmentSchema,
      { temperature: 0.3 }
    );
  }

  async generateCampaign(campaignData: CampaignInput): Promise<AIResponse<CampaignStep[]>> {
    const prompt = loadPrompt('campaign-generation');
    return this.call<CampaignStep[]>(
      fillTemplate(prompt, campaignData),
      `Product: ${campaignData.product}\nIndustry: ${campaignData.industry}\nOccasion: ${campaignData.occasion}`,
      campaignSchema,
      { temperature: 0.8 }
    );
  }
}

================================================================================
## 4. AUTO-PILOT MODE LOGIC
================================================================================

// src/services/ai/autoPilot.ts

class AutoPilotService {
  async processInboundMessage(message: Message, lead: Lead, settings: AgentSettings) {
    // 1. Check if auto-pilot is active
    if (!settings.isAutoPilotActive) {
      return { action: 'manual', reason: 'Auto-pilot disabled' };
    }

    // 2. Analyze intent
    const intentResult = await aiService.analyzeIntent({
      leadName: lead.name,
      company: lead.company,
      product: lead.campaign?.product,
      campaignContext: lead.campaign?.name,
      messageHistory: lead.recentMessages,
      latestMessage: message.content,
      tone: settings.tone
    });

    if (!intentResult.success) {
      return { action: 'error', reason: intentResult.error };
    }

    const intent = intentResult.data!;

    // 3. Update lead with intent analysis
    await updateLeadIntent(lead.id, intent);

    // 4. Decision tree
    const thresholdMap = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
    const threshold = thresholdMap[settings.autoReplyThreshold];

    if (this.meetsThreshold(intent.intentLevel, threshold)) {
      // Generate reply
      const draftResult = await aiService.generateDraft({
        leadName: lead.name,
        company: lead.company,
        product: lead.campaign?.product,
        tone: settings.tone,
        intentLevel: intent.intentLevel,
        campaignContext: lead.campaign?.name,
        messageHistory: lead.recentMessages,
        latestMessage: message.content
      });

      if (!draftResult.success || !draftResult.data) {
        return { action: 'error', reason: 'Failed to generate draft' };
      }

      const draft = draftResult.data;

      // 5. Check working hours
      if (settings.workingHoursOnly && !this.isWithinWorkingHours(settings.workingHours)) {
        return { 
          action: 'draft_saved', 
          intent, 
          draft,
          reason: 'Outside working hours, draft saved for later' 
        };
      }

      // 6. Check daily limit
      if (await this.hasReachedDailyLimit(lead.workspaceId, settings.maxDailyReplies)) {
        return { 
          action: 'draft_saved', 
          intent, 
          draft,
          reason: 'Daily reply limit reached' 
        };
      }

      // 7. Send auto-reply
      if (intent.intentLevel === 'HIGH') {
        // Send human handoff message instead of auto-reply
        await this.sendHumanHandoff(lead, settings);
        return { 
          action: 'human_handoff', 
          intent, 
          reason: 'HIGH intent lead - transferred to human' 
        };
      }

      // Send the auto-reply
      await this.sendReply(lead, message, draft, settings);
      return { action: 'auto_replied', intent, draft };

    } else {
      // Intent too low, don't reply
      return { 
        action: 'no_reply', 
        intent, 
        reason: `Intent ${intent.intentLevel} below threshold ${threshold}` 
      };
    }
  }

  private meetsThreshold(intentLevel: string, threshold: string): boolean {
    const levels = ['LOW', 'MEDIUM', 'HIGH'];
    return levels.indexOf(intentLevel) >= levels.indexOf(threshold);
  }

  private isWithinWorkingHours(wh: WorkingHours): boolean {
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    const startH = parseFloat(wh.start);
    const endH = parseFloat(wh.end);
    return hours >= startH && hours <= endH;
  }

  private async hasReachedDailyLimit(workspaceId: string, max: number): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await getDailyReplyCount(workspaceId, today);
    return count >= max;
  }
}

================================================================================
## 5. TOKEN USAGE TRACKING
================================================================================

interface TokenUsage {
  workspaceId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: Date;
}

Cost Calculation:
  Gemini 2.5 Flash:
    - Input: $0.10/1M tokens
    - Output: $0.40/1M tokens
    - Context caching: $0.025/1M tokens

  Average per operation:
    - Intent analysis: ~500 input, ~100 output = $0.00009
    - Draft generation: ~800 input, ~200 output = $0.00016
    - Lead enrichment: ~300 input, ~400 output = $0.00019
    - Campaign generation: ~500 input, ~600 output = $0.00029

  Billing to customer:
    - AI Message: $0.02
    - Intent Analysis: $0.05
    - Lead Enrichment: $0.10
    - Campaign Generation: $0.50

================================================================================
## 6. CACHING STRATEGY
================================================================================

  Redis Cache for AI responses:
    Key format: ai:cache:{model}:{hash(prompt + input)}
    TTL: 24 hours (same input gets same response)
    Invalidated when: agent_settings change (tone, etc.)

  Cache hit rate target: 15% (AI responses vary a lot)
  Cache saves money on repeated prompts

================================================================================
## 7. FALLBACK PROVIDER ARCHITECTURE
================================================================================

if (primary provider fails) -> try fallback -> try second fallback

Provider Chain:
  1. Gemini 2.5 Flash (primary - cheapest)
  2. Gemini 2.0 Pro (fallback - more capable but slower)
  3. OpenAI GPT-4o-mini (second fallback)
  4. Anthropic Claude 3 Haiku (third fallback)

Each provider has:
  - Circuit breaker (5 failures in 1min -> skip for 5min)
  - Rate limiter (requests/second)
  - Token budget (max tokens/minute)
  - Cost tracker

// src/services/ai/providerRouter.ts

class AIProviderRouter {
  private providers: AIProvider[];
  private circuitBreakers: Map<string, CircuitBreaker>;

  async execute<T>(operation: AIOperation<T>): Promise<AIResponse<T>> {
    for (const provider of this.providers) {
      if (this.circuitBreakers.get(provider.name)?.isOpen()) {
        continue; // Skip unhealthy providers
      }

      try {
        const result = await operation.execute(provider);
        this.circuitBreakers.get(provider.name)?.recordSuccess();
        return result;
      } catch (error) {
        this.circuitBreakers.get(provider.name)?.recordFailure();
        console.warn(`[AI Router] ${provider.name} failed:`, error.message);
        continue; // Try next provider
      }
    }

    return { success: false, error: 'All AI providers failed' };
  }
}
