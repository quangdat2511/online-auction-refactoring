import knex from 'knex';
export default knex({
  client: 'pg',
  connection: {
    host: 'aws-1-ap-southeast-2.pooler.supabase.com',
    post: 5432,
    user: 'postgres.oirldpzqsfngdmisrakp',
    password: 'WYaxZ0myJw9fIbPH',
    database: 'postgres'
  },
  pool: { min: 0, max: 7 }
});