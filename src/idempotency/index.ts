import { Pool } from "pg";
export class IdempotencyStore{
    constructor(private pool:Pool){}

    async runOnce(key:string,fn:()=> Promise<void>){
        const client = await this.pool.connect();

        try{
            await client.query('BEGIN')

            const res = await client.query(
                `INSERT INTO outbox_idempotency (key) VALUES ($1) ON CONFLICT DO NOTHING`,[key]
            )

            if(res.rowCount ===0){
                await client.query('COMMIT');
                return;
            }

            await fn();
            await client.query('COMMIT')

        }
        catch(e){
            await client.query('COMMIT');
            throw e;

        }
        finally{
            client.release();

        }

    }
}