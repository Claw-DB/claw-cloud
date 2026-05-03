import { Injectable } from '@nestjs/common';
import { CollectionStat, SearchResult, VectorRecord } from '@claw/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HostedVectorService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionWorkspaceSchema(workspaceId: string): Promise<void> {
    const schema = this.schemaName(workspaceId);
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await this.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector SCHEMA ${schema}`);
  }

  async createCollection(
    workspaceId: string,
    collectionName: string,
    dimensions: number,
    distanceMetric: 'cosine' | 'l2' | 'ip',
  ): Promise<void> {
    await this.provisionWorkspaceSchema(workspaceId);
    const schema = this.schemaName(workspaceId);
    const table = this.safeIdentifier(collectionName);
    const operator = distanceMetric === 'l2' ? 'vector_l2_ops' : distanceMetric === 'ip' ? 'vector_ip_ops' : 'vector_cosine_ops';

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${schema}.${table} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT,
        metadata JSONB,
        tags TEXT[],
        embedding vector(${dimensions}),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS ${table}_embedding_idx
      ON ${schema}.${table} USING ivfflat (embedding ${operator}) WITH (lists = 100)
    `);
  }

  async upsert(workspaceId: string, collectionName: string, records: VectorRecord[]): Promise<void> {
    if (!records.length) {
      return;
    }

    const schema = this.schemaName(workspaceId);
    const table = this.safeIdentifier(collectionName);
    for (const record of records) {
      const id = record.id ? `'${record.id}'::uuid` : 'gen_random_uuid()';
      const content = record.content ? `$json$${record.content}$json$` : 'NULL';
      const metadata = record.metadata ? `$json$${JSON.stringify(record.metadata)}$json$::jsonb` : 'NULL';
      const tags = record.tags?.length
        ? `ARRAY[${record.tags.map((tag) => `'${tag.replace(/'/g, "''")}'`).join(',')}]::text[]`
        : 'ARRAY[]::text[]';
      const embedding = `'[${record.embedding.join(',')}]'`;

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO ${schema}.${table} (id, content, metadata, tags, embedding)
        VALUES (${id}, ${content}, ${metadata}, ${tags}, ${embedding}::vector)
        ON CONFLICT (id)
        DO UPDATE SET
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          tags = EXCLUDED.tags,
          embedding = EXCLUDED.embedding
      `);
    }
  }

  async search(
    workspaceId: string,
    collectionName: string,
    queryVector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    const schema = this.schemaName(workspaceId);
    const table = this.safeIdentifier(collectionName);
    const where = filter ? `WHERE metadata @> '${JSON.stringify(filter)}'::jsonb` : '';
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT id::text, content, metadata, tags, 1 - (embedding <=> '[${queryVector.join(',')}]'::vector) AS score
      FROM ${schema}.${table}
      ${where}
      ORDER BY embedding <=> '[${queryVector.join(',')}]'::vector
      LIMIT ${topK}
    `);

    return rows.map((row) => ({
      id: String(row.id),
      content: (row.content as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      tags: (row.tags as string[] | null) ?? [],
      score: Number(row.score ?? 0),
    }));
  }

  async deleteCollection(workspaceId: string, collectionName: string): Promise<void> {
    const schema = this.schemaName(workspaceId);
    const table = this.safeIdentifier(collectionName);
    await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${schema}.${table}`);
  }

  async getCollectionStats(workspaceId: string): Promise<{ collections: CollectionStat[] }> {
    const schema = this.schemaName(workspaceId);
    await this.provisionWorkspaceSchema(workspaceId);
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        c.relname AS name,
        COALESCE(s.n_live_tup, 0) AS row_count,
        pg_total_relation_size(c.oid) AS total_bytes,
        COALESCE(pg_indexes_size(c.oid), 0) AS index_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = '${schema}' AND c.relkind = 'r'
    `);

    return {
      collections: rows.map((row) => ({
        name: String(row.name),
        rowCount: Number(row.row_count ?? 0),
        totalBytes: Number(row.total_bytes ?? 0),
        indexBytes: Number(row.index_bytes ?? 0),
      })),
    };
  }

  private schemaName(workspaceId: string) {
    return `vectors_${workspaceId.replace(/-/g, '_')}`;
  }

  private safeIdentifier(value: string) {
    return value.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}