import { MDocument } from "@mastra/rag";
import fs from "fs";
import { mastra } from "../mastra";
import { embedMany } from "ai";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

async function updateCompanyFaq() {
  const filePath = "src/documents/company_faq.md";
  const sourceName = "company_faq";
  const indexName = "company_docs";

  const vectorStore = mastra.getVector("libSqlVector");

  // 1. 读取更新后的文档并重新分块
  const text = fs.readFileSync(filePath, "utf-8");
  const doc = MDocument.fromMarkdown(text);

  const chunks = await doc.chunk({
    strategy: "markdown",
    headers: [
      ["#", "title"],
      ["##", "section"],
    ],
  });

  console.log(`${sourceName}: 准备为 ${chunks.length} 个新分块生成向量...`);

  // 2. 为新分块生成 Embedding 向量
  const { embeddings } = await embedMany({
    model: new ModelRouterEmbeddingModel("google/gemini-embedding-001"),
    values: chunks.map((chunk) => chunk.text),
  });

  // 3. 删除旧数据的向量（按 source 过滤删除，不影响 operations_manual 和 onboarding_guide）
  console.log(`正在删除旧的 ${sourceName} 向量数据...`);
  await vectorStore.deleteVectors({
    indexName: indexName,
    filter: { source: sourceName },
  });

  // 4. 插入新生成的向量及元数据
  console.log(`正在写入新的 ${sourceName} 向量数据...`);
  await vectorStore.upsert({
    indexName: indexName,
    vectors: embeddings,
    metadata: chunks.map((chunk) => ({
      text: chunk.text,
      source: sourceName,
      section: chunk.metadata?.section || "",
      title: chunk.metadata?.title || "",
      createdAt: new Date().toISOString(),
    })),
  });

  console.log(`${sourceName} 更新完成！`);
}

updateCompanyFaq().catch((err) => {
  console.error("更新失败:", err);
});