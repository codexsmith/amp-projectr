import {
  OpenAIResponsesAnswerError,
  OpenAIResponsesKnowledgeAnswerer,
} from "../../../adapters/knowledge/openai-responses-answer";
import { DeterministicKnowledgeSearcher } from "../../../adapters/knowledge/deterministic";
import {
  answerWithEvidence,
  isKnowledgeEnrichment,
  type KnowledgeAnswerInput,
  type KnowledgeMap,
  type TranscriptSegment,
} from "../../../core/projectr";

export const runtime = "nodejs";

interface AnswerRequestBody {
  sourceId?: unknown;
  question?: unknown;
  transcriptSegments?: unknown;
  knowledgeMap?: unknown;
  enrichment?: unknown;
  maxEvidence?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseInput(body: AnswerRequestBody): KnowledgeAnswerInput | null {
  if (typeof body.sourceId !== "string" || !body.sourceId.trim()
    || typeof body.question !== "string" || !body.question.trim()
    || !Array.isArray(body.transcriptSegments)
    || !isRecord(body.knowledgeMap)) {
    return null;
  }

  const sourceId = body.sourceId;
  const transcriptSegments: TranscriptSegment[] = [];
  for (const value of body.transcriptSegments) {
    if (!isRecord(value)
      || typeof value.id !== "string"
      || value.sourceId !== sourceId
      || typeof value.startSeconds !== "number"
      || !Number.isFinite(value.startSeconds)
      || typeof value.endSeconds !== "number"
      || !Number.isFinite(value.endSeconds)
      || value.endSeconds < value.startSeconds
      || typeof value.text !== "string") {
      return null;
    }
    transcriptSegments.push({
      id: value.id,
      sourceId,
      startSeconds: value.startSeconds,
      endSeconds: value.endSeconds,
      text: value.text,
    });
  }

  if (body.knowledgeMap.sourceId !== sourceId || !Array.isArray(body.knowledgeMap.topics)) return null;
  const segmentIds = new Set(transcriptSegments.map((segment) => segment.id));
  const topics: KnowledgeMap["topics"] = [];
  for (const value of body.knowledgeMap.topics) {
    if (!isRecord(value)
      || typeof value.id !== "string"
      || typeof value.title !== "string"
      || typeof value.startSeconds !== "number"
      || !Number.isFinite(value.startSeconds)
      || typeof value.endSeconds !== "number"
      || !Number.isFinite(value.endSeconds)
      || value.endSeconds < value.startSeconds
      || !isStringArray(value.segmentIds)
      || value.segmentIds.some((id) => !segmentIds.has(id))
      || !isStringArray(value.keywords)) {
      return null;
    }
    topics.push({
      id: value.id,
      title: value.title,
      startSeconds: value.startSeconds,
      endSeconds: value.endSeconds,
      segmentIds: [...value.segmentIds],
      keywords: [...value.keywords],
    });
  }

  if (body.enrichment !== undefined && !isKnowledgeEnrichment(body.enrichment)) return null;
  if (body.enrichment && body.enrichment.sourceId !== sourceId) return null;

  const maxEvidence = typeof body.maxEvidence === "number" && Number.isFinite(body.maxEvidence)
    ? Math.max(1, Math.min(5, Math.floor(body.maxEvidence)))
    : 3;

  return {
    sourceId,
    question: body.question,
    transcriptSegments,
    knowledgeMap: { sourceId, topics },
    enrichment: body.enrichment,
    maxEvidence,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as AnswerRequestBody;
    const input = parseInput(body);
    if (!input) {
      return json({
        error: {
          code: "invalid_request",
          message: "A coherent Projectr source, transcript, knowledge map, and question are required.",
        },
      }, 400);
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return json({
        error: {
          code: "answer_not_configured",
          message: "Hosted synthesis is not configured on this server.",
        },
      }, 501);
    }

    const model = process.env.PROJECTR_OPENAI_MODEL?.trim() || "gpt-5.6-luna";
    const searcher = new DeterministicKnowledgeSearcher();
    const answerer = new OpenAIResponsesKnowledgeAnswerer(searcher, { apiKey, model });
    const answer = await answerWithEvidence(answerer, input);

    return json({
      answer,
      provider: "openai-responses",
      model: answer.generatedBy.version ?? model,
    });
  } catch (error) {
    if (error instanceof OpenAIResponsesAnswerError) {
      return json({
        error: { code: error.code, message: error.message, upstreamStatus: error.status },
      }, 502);
    }

    return json({
      error: {
        code: "answer_failed",
        message: error instanceof Error ? error.message : "Unable to answer from this source.",
      },
    }, 400);
  }
}
