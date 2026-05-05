import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service.js';
import { Response } from 'express';

const SYSTEM_PROMPT = `You are the Claw Cloud AI assistant, a helpful expert on the Claw Cloud platform — a distributed in-memory data grid and caching solution.

You help users with:
- Managing Redis-compatible memory instances
- Understanding usage metrics and performance tuning  
- Configuring replication and high availability
- API keys, workspace management, and billing questions
- Debugging connection issues and errors
- Best practices for caching patterns (LRU, LFU, TTL strategies)
- Data persistence and backup configuration

You are concise, technical, and friendly. When writing code examples, use TypeScript/Node.js by default unless the user specifies another language. Always include the Claw Cloud SDK when relevant.

If asked about something unrelated to the Claw Cloud platform or general software engineering, politely redirect the conversation.`;

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly anthropic?: Anthropic;

  constructor(private readonly prisma: PrismaService) {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  async streamChat(
    userId: string,
    workspaceId: string | undefined,
    sessionId: string,
    userMessage: string,
    res: Response,
  ): Promise<void> {
    // Persist user message
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'USER',
        content: userMessage,
        userId,
        workspaceId: workspaceId ?? null,
      },
    });

    // Fetch conversation history (last 20 messages)
    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }));

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let fullText = '';

    try {
      if (process.env.OPENROUTER_API_KEY) {
        fullText = await this.streamFromOpenRouter(messages, res);
      } else if (this.anthropic) {
        fullText = await this.streamFromAnthropic(messages, res);
      } else {
        throw new Error('No AI provider configured. Set OPENROUTER_API_KEY or ANTHROPIC_API_KEY.');
      }

      // Persist assistant response
      await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: fullText,
          userId,
          workspaceId: workspaceId ?? null,
        },
      });

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err) {
      this.logger.error('AI stream error', err);
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: 'AI service unavailable. Configure OPENROUTER_API_KEY.' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  private async streamFromAnthropic(messages: Anthropic.MessageParam[], res: Response): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic is not configured');
    }

    let fullText = '';
    const stream = this.anthropic.messages.stream({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const chunk = event.delta.text;
        fullText += chunk;
        res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`);
      }
    }

    return fullText;
  }

  private async streamFromOpenRouter(messages: Anthropic.MessageParam[], res: Response): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
        ...(process.env.OPENROUTER_APP_NAME ? { 'X-Title': process.env.OPENROUTER_APP_NAME } : {}),
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenRouter request failed: HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const event = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = event.choices?.[0]?.delta?.content;
          if (!delta) continue;
          fullText += delta;
          res.write(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`);
        } catch {
          // Skip malformed partial events
        }
      }
    }

    return fullText;
  }

  async getHistory(sessionId: string, userId: string) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId, userId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async clearHistory(sessionId: string, userId: string) {
    return this.prisma.chatMessage.deleteMany({
      where: { sessionId, userId },
    });
  }
}
