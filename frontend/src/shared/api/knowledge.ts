import type {
  KnowledgeDocumentCreate,
  KnowledgeDocumentUpdate,
  KnowledgeDocumentUpsertResponse,
  KnowledgeDocumentVersionsResponse,
  KnowledgeDocumentsResponse,
  KnowledgeSearchResponse,
} from "../types/knowledge";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchKnowledgeDocuments(): Promise<KnowledgeDocumentsResponse> {
  return requestJson<KnowledgeDocumentsResponse>("/knowledge/documents");
}

export function searchKnowledge(query: string, limit = 5): Promise<KnowledgeSearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return requestJson<KnowledgeSearchResponse>(`/knowledge/search?${params.toString()}`);
}

export function createKnowledgeDocument(
  payload: KnowledgeDocumentCreate,
  token = "demo-token-admin_001",
): Promise<KnowledgeDocumentUpsertResponse> {
  return requestJson<KnowledgeDocumentUpsertResponse>("/knowledge/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function updateKnowledgeDocument(
  documentId: string,
  payload: KnowledgeDocumentUpdate,
  token = "demo-token-admin_001",
): Promise<KnowledgeDocumentUpsertResponse> {
  return requestJson<KnowledgeDocumentUpsertResponse>(`/knowledge/documents/${documentId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function offlineKnowledgeDocument(
  documentId: string,
  token = "demo-token-admin_001",
): Promise<KnowledgeDocumentUpsertResponse> {
  return requestJson<KnowledgeDocumentUpsertResponse>(
    `/knowledge/documents/${documentId}/status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "已下线",
        maintainer: "平台管理员",
      }),
    },
  );
}

export function fetchKnowledgeDocumentVersions(
  documentId: string,
): Promise<KnowledgeDocumentVersionsResponse> {
  return requestJson<KnowledgeDocumentVersionsResponse>(
    `/knowledge/documents/${documentId}/versions`,
  );
}
