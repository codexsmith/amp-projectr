import {
  OpenAIResponsesAnswerError,
  OpenAIResponsesKnowledgeAnswerer,
  type OpenAIFetchLike,
} from "../../adapters/knowledge/openai-responses-answer";
import { answerWithEvidence, type KnowledgeAnswerInput } from "../../core/projectr/answer";
import type { KnowledgeSearcher } from "../../core/projectr/knowledge";
import type { KnowledgeSearchHit } from "../../core/projectr/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

const hits: KnowledgeSearchHit[] = [
  {
    segmentId: "video:1", startSeconds: 0, endSeconds: 10,
    text: "Database schemas preserve invariants and source evidence.",
    score: 5, matchedTerms: ["invariants"], matchedConceptIds: [], topicIds: ["topic:1"],
  },
  {
    segmentId: "video:2", startSeconds: 10, endSeconds: 20,
    text: "Normalization preserves invariants and prevents update anomalies.",
    score: 4, matchedTerms: ["invariants"], matchedConceptIds: [], topicIds: ["topic:1"],
  },
];

const input: KnowledgeAnswerInput = {
  sourceId: "video",
  question: "How are invariants preserved?",
  transcriptSegments: hits.map((hit) => ({
    id: hit.segmentId,
    sourceId: "video",
    startSeconds: hit.startSeconds,
    endSeconds: hit.endSeconds,
    text: hit.text,
  })),
  knowledgeMap: {
    sourceId: "video",
    topics: [{
      id: "topic:1", title: "Invariants", startSeconds: 0, endSeconds: 20,
      segmentIds: ["video:1", "video:2"], keywords: ["invariants"],
    }],
  },
  maxEvidence: 2,
};

class FixedSearcher implements KnowledgeSearcher {
  constructor(private readonly result: KnowledgeSearchHit[]) {}
  async search(): Promise<KnowledgeSearchHit[]> { return this.result; }
}

async function run(): Promise<void> {
  let requestBody: Record<string, any> = {};
  let requestHeaders: Record<string, string> | undefined;
  const fetchImpl: OpenAIFetchLike = async (_url, init) => {
    requestBody = JSON.parse(init?.body ?? "{}") as Record<string, any>;
    requestHeaders = init?.headers;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          model: "gpt-5.6-luna-test-snapshot",
          output: [{
            type: "message",
            content: [{
              type: "output_text",
              text: JSON.stringify({
                status: "answered",
                claims: [{
                  text: "Schemas and normalization preserve invariants.",
                  evidenceSegmentIds: ["video:1", "video:2"],
                }],
              }),
            }],
          }],
        };
      },
    };
  };

  const answerer = new OpenAIResponsesKnowledgeAnswerer(
    new FixedSearcher(hits),
    { apiKey: "test-key", fetchImpl },
  );
  const answer = await answerWithEvidence(answerer, input);

  equal(answer.status, "answered", "hosted answer should be supported");
  equal(answer.evidence.length, 2, "evidence should be reconstructed from search hits");
  equal(answer.generatedBy.version, "gpt-5.6-luna-test-snapshot", "response model should be recorded");
  equal(requestBody.store, false, "responses should not be stored by default");
  equal(requestBody.model, "gpt-5.6-luna", "cost-sensitive model should be default");
  equal(requestBody.text.format.type, "json_schema", "structured output should be required");
  equal(requestBody.text.format.strict, true, "structured output should be strict");
  assert(requestHeaders?.Authorization === "Bearer test-key", "server adapter should send bearer key");
  assert(!JSON.stringify(requestBody).includes("test-key"), "API key should never enter model input");

  let badReference = false;
  const badFetch: OpenAIFetchLike = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        output: [{ type: "message", content: [{
          type: "output_text",
          text: JSON.stringify({
            status: "answered",
            claims: [{ text: "Unsupported", evidenceSegmentIds: ["video:999"] }],
          }),
        }] }],
      };
    },
  });

  try {
    await new OpenAIResponsesKnowledgeAnswerer(
      new FixedSearcher(hits),
      { apiKey: "test", fetchImpl: badFetch },
    ).answer(input);
  } catch (error) {
    badReference = error instanceof OpenAIResponsesAnswerError && error.code === "invalid_output";
  }
  assert(badReference, "model evidence outside retrieval boundary should be rejected");

  let called = false;
  const noEvidenceFetch: OpenAIFetchLike = async () => {
    called = true;
    throw new Error("should not call");
  };
  const noEvidence = await new OpenAIResponsesKnowledgeAnswerer(
    new FixedSearcher([]),
    { apiKey: "test", fetchImpl: noEvidenceFetch },
  ).answer(input);
  equal(noEvidence.status, "insufficient_evidence", "empty retrieval should not call model");
  equal(called, false, "model should not run without retrieved evidence");

  console.log("OpenAI answer adapter tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
