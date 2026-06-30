import pool from '../config/db';

export const fetchAllTenantsFromDB = async () => {
    try {
        const result = await pool.query('SELECT * FROM tenants;')
        return result.rows;
    } catch (err){
        throw err;
    }
};

export const insertTenantIntoDB = async (
    tenantName: string,
    phoneNumbers: Array<{ number: string; provider?: string; is_primary?: boolean }>
) => {
    const client = await pool.connect();
    try{
        await client.query('BEGIN');
        const tenantResult = await client.query(
            'INSERT INTO tenants(tenant_name) VALUES ($1) RETURNING *;'
            [tenantName]
        );
        const newTenant = tenantResult.rows[0];
        const tenantId = newTenant.tenant_id;

        const savedPhones: any[] = [];
        for (const phone of phoneNumbers) {
            const phoneResult = await client.query(
                `INSERT INTO tenants_phone_numbers(tenant_id, phone_number, provider, is_primary)
                VALUES ($1, $2, COALESCE($3, DEFAULT), COALESCE($4, DEFAULT)) RETURNING *;`,
                [
                    tenantId,
                    phone.number,
                    phone.provider !== undefined ? phone.provider : null,
                    phone.is_primary !== undefined ? phone.is_primary : null
                ]
            ); savedPhones.push(phoneResult.rows[0]);
        }
        await client.query('COMMIT');
        return {
            ...newTenant,
            phoneNumbers: savedPhones
        }
    }
    catch(err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};

export const editTenantFromDB = async (
    tenant_id: number,
    tenant_name: string,
    phoneNumbers: Array<{ number: string; provider?: string; is_primary?: boolean }>
) => {
    const client = await pool.connect();
    try{
        await client.query('BEGIN');
        const editedTenant = await client.query(`
            UPDATE tenants
            SET tenant_name = $1
            WHERE tenant_id = $2
            RETURNING *;
        `,
        [tenant_name, tenant_id]);
        const updatedTenant = editedTenant.rows[0];

        await client.query(`
            DELETE FROM tenants.phone_numbers
            WHERE tenant_id = $1;
        `, [tenant_id] );

        const savedPhones: any[] = [];
        for (const phone of phoneNumbers) {
            const phoneResult = await client.query(
                `INSERT INTO tenants_phone_numbers(tenant_id, phone_number, provider, is_primary)
                VALUES ($1, $2, COALESCE($3, DEFAULT), COALESCE($4, DEFAULT)) RETURNING *;`,
                [
                    tenant_id,
                    phone.number,
                    phone.provider !== undefined ? phone.provider : null,
                    phone.is_primary !== undefined ? phone.is_primary : null
                ]
            ); savedPhones.push(phoneResult.rows[0]);
        }
        await client.query('COMMIT');
        return {
            ...updatedTenant,
            phoneNumbers: savedPhones
        }
    }
    catch(err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};

export const deactivateTenantFromDB = async (tenant_id: number) => {
    const result = await pool.query(`
        UPDATE tenants
        SET is_active = false
        WHERE tenant_)id = $
        RETURNING *;
    `, [tenant_id] );
    return result.rows[0];
}