export const POSTGRES_SCHEMA = `CREATE TABLE domains(name text primary key, registrar_id text not null, registrant_id text not null, nameservers jsonb not null default '[]', status text not null, created_at timestamptz not null, updated_at timestamptz not null, expires_at timestamptz not null);\nCREATE TABLE contacts(id text primary key, name text not null, email text not null, organization text, country text);\nCREATE TABLE hosts(name text primary key, addresses jsonb not null);\nCREATE TABLE audit_events(id text primary key, at timestamptz not null, actor text not null, action text not null, object_type text not null, object_id text not null, before_json jsonb, after_json jsonb);`;
export interface PostgresExecutor { query<T=unknown>(sql:string,params?:unknown[]):Promise<T[]>; }
export class PostgresRegistryAdapter {
  constructor(private db:PostgresExecutor) {}
  async availability(name:string){const rows=await this.db.query<{name:string}>('SELECT name FROM domains WHERE name=$1',[name]);return rows.length===0;}
  async getDomain(name:string){const rows=await this.db.query('SELECT * FROM domains WHERE name=$1',[name]);return rows[0];}
}
