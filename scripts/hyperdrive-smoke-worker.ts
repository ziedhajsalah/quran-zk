import { Client } from 'pg'

type SmokeEnvironment = { HYPERDRIVE: { connectionString: string } }

export default {
  async fetch(_request: Request, env: SmokeEnvironment): Promise<Response> {
    const client = new Client({
      connectionString: env.HYPERDRIVE.connectionString,
      connectionTimeoutMillis: 10000,
    })
    try {
      await client.connect()
      const { rows } = await client.query(
        'select current_database() as database',
      )
      await client.query('begin')
      await client.query(
        'create temporary table hyperdrive_smoke (value integer)',
      )
      await client.query('insert into hyperdrive_smoke values (1)')
      await client.query('rollback')
      const result = await client.query(
        "select to_regclass('pg_temp.hyperdrive_smoke') is null as rolled_back",
      )
      if (!result.rows[0].rolled_back)
        throw new Error('Remote rollback failed.')
      return Response.json({
        ok: true,
        database: rows[0].database,
        transactionRollback: true,
      })
    } catch (error) {
      console.error(
        'Hyperdrive smoke check failed',
        error instanceof Error ? error.message : 'Unknown error',
      )
      return Response.json({ ok: false }, { status: 500 })
    } finally {
      await client.end()
    }
  },
}
