import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// ステップ 1: ユーザーのクエリを取得
const getUserQueryStep = createStep({
  id: "get-user-query",
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    query: z.string(),
  }),
  resumeSchema: z.object({
    query: z.string(),
  }),
  suspendSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend, mastra }) => {
    // resumeData があれば修正されたクエリを使用
    const query = resumeData?.query ?? inputData.query;
    // 評価エージェント
    const agent = mastra.getAgent("queryEvaluationAgent");
    // structuredOutput で bool 値のみを返す
    const result = await agent.generate(
      `クエリ: ${query} このクエリは検索可能ですか？`,
      {
        structuredOutput: {
          schema: z.object({
            isSearchable: z.boolean(),
          }),
          jsonPromptInjection: true,
        },
      },
    );
    const isSearchable = result.object?.isSearchable ?? false;
    if (resumeData) {
      return { query: resumeData.query };
    }
    // 検索不可なら suspend
    if (!isSearchable) {
      return await suspend({
        message: `${inputData.query} 少し物足りないです。もう少し具体的にしてもらえますか？`,
      });
    }
    // 検索可能ならそのまま返す
    return { query };
  },
});

// ワークフローを定義
export const researchWorkflow = createWorkflow({
  id: "research-workflow",
  inputSchema: z.object({
    query: z.string().describe(" 検索したい内容を教えてください！"),
  }),
  outputSchema: z.object({
    query: z.string().describe(" 検索可能なクエリ "),
  }),
  steps: [getUserQueryStep],
});

researchWorkflow.then(getUserQueryStep).commit();