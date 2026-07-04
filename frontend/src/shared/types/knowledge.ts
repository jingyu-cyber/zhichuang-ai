export type KnowledgeDocument = {
  document_id: string;
  title: string;
  source_type: string;
  path: string;
  tags: string[];
  chunk_count: number;
  status: string;
  source_url?: string | null;
  maintainer: string;
  version: number;
  updated_at: string;
};

export type KnowledgeDocumentsResponse = {
  total: number;
  documents: KnowledgeDocument[];
};

export type KnowledgeDocumentCreate = {
  title: string;
  source_type: string;
  path: string;
  tags: string[];
  content: string;
  source_url?: string | null;
};

export type KnowledgeDocumentUpdate = {
  title?: string;
  source_type?: string;
  path?: string;
  tags?: string[];
  content?: string;
  source_url?: string | null;
  maintainer?: string;
};

export type KnowledgeDocumentVersion = {
  version: number;
  action: string;
  maintainer: string;
  updated_at: string;
  summary: string;
};

export type KnowledgeDocumentVersionsResponse = {
  document_id: string;
  versions: KnowledgeDocumentVersion[];
};

export type KnowledgeDocumentUpsertResponse = {
  document: KnowledgeDocument;
  searchable: boolean;
  message: string;
};

export type KnowledgeSearchResult = {
  title: string;
  source_type: string;
  path: string;
  snippet: string;
  score: number;
  tags: string[];
};

export type KnowledgeSearchResponse = {
  query: string;
  total: number;
  results: KnowledgeSearchResult[];
};
