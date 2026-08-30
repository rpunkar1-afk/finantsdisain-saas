// Netlify Function (v2, Web API handler)
// Samm 9: Teadmusbaasi API (Kiht 3)
// Andmeallikas: käsitsi kureeritav data.json
// Query params: ?id=<article-id>  ?category=<category>

import knowledgebaseData from "./data.json";

export const config = {
  path: "/api/knowledgebase",
};

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string[];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const idFilter = url.searchParams.get("id");
  const categoryFilter = url.searchParams.get("category");

  const articles = knowledgebaseData as KnowledgeArticle[];

  if (idFilter) {
    const article = articles.find((a) => a.id === idFilter);
    if (!article) {
      return jsonResponse({ error: `Artiklit id="${idFilter}" ei leitud` }, 404);
    }
    return jsonResponse(article, 200);
  }

  let result = articles;
  if (categoryFilter) {
    result = result.filter((a) => a.category === categoryFilter);
  }

  return jsonResponse({ count: result.length, articles: result }, 200);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
