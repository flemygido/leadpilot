import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { LLMOutputSchema } from '../qualification/schema.js';
import type {
  LLMClient,
  LLMCallParams,
  LLMResponse,
  QualificationUpdate,
} from './llm.interface.js';

const MODEL = 'claude-sonnet-4-5';

const REPORT_OUTCOME_TOOL = {
  name: 'report_outcome',
  description:
    'Report the outcome of this conversation turn: the message to send to the lead and any qualification data gathered.',
  input_schema: {
    type: 'object' as const,
    properties: {
      reply: {
        type: 'string',
        description:
          'The message to send to the lead via WhatsApp. Keep it concise (1-3 sentences).',
      },
      next_action: {
        type: 'string',
        enum: ['continue', 'qualify', 'offer_visit', 'handoff', 'close_lost', 'nurture'],
        description: 'What to do next after sending this message.',
      },
      qualification_update: {
        type: 'object',
        description:
          'Any qualification fields learned from this turn. Only include fields with new information.',
        properties: {
          intent: { type: 'string', enum: ['buy', 'rent', 'unknown'] },
          propertyType: {
            type: 'string',
            enum: ['apartment', 'villa', 'plot', 'commercial', 'unknown'],
          },
          bhk: { type: 'integer', minimum: 1, maximum: 10 },
          budgetMin: { type: 'number', minimum: 0 },
          budgetMax: { type: 'number', minimum: 0 },
          preferredLocations: { type: 'array', items: { type: 'string' } },
          timeline: {
            type: 'string',
            enum: ['immediate', '1_3_months', '3_6_months', 'exploring', 'unknown'],
          },
          financing: { type: 'string', enum: ['loan', 'cash', 'unknown'] },
          name: { type: 'string' },
          notes: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    required: ['reply', 'next_action', 'qualification_update'],
    additionalProperties: false,
  },
} as const;

export class ClaudeClient implements LLMClient {
  readonly name = 'claude';
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'] });
  }

  async call({ leadContext, history, incomingMessage }: LLMCallParams): Promise<LLMResponse> {
    // Build messages array
    const messages: Anthropic.MessageParam[] = [];

    // Inject prior conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role === 'lead' ? 'user' : 'assistant',
        content: msg.body,
      });
    }

    // Append the new inbound message
    messages.push({ role: 'user', content: incomingMessage });

    // Inject lead context as a system-level note if no history yet
    const stateHint = `[Current lead state: ${leadContext.state}, Name: ${leadContext.name ?? 'unknown'}]`;
    const systemWithContext = `${SYSTEM_PROMPT}\n\n${stateHint}`;

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemWithContext,
      tools: [REPORT_OUTCOME_TOOL],
      tool_choice: { type: 'tool', name: 'report_outcome' },
      messages,
    });

    // Extract the tool_use block
    const toolUseBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUseBlock) {
      throw new Error('ClaudeClient: no tool_use block in response');
    }

    // Validate with Zod
    const parsed = LLMOutputSchema.parse(toolUseBlock.input);

    return {
      reply: parsed.reply,
      nextAction: parsed.next_action,
      qualificationUpdate: parsed.qualification_update as QualificationUpdate,
    };
  }
}
