alter table app.insights
  add column embedding extensions.vector(384);

create index insights_embedding_idx
  on app.insights
  using hnsw (embedding extensions.vector_cosine_ops);
