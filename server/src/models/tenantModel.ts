import pool from "../config/db";

interface RenewalData {
    lease_id: number;
    tenant_id: number;
    room_id: number;
    amount: number;
    lease_end: string | Date;
    new_lease_end: string | Date;
    status: string;
}

interface InserTenantData {
    tenant_name: string;
    id_picture_url: string;
    phone_numbers: Array<{
        number: string;
        provider?: string;
        is_primary?: boolean;
    }>;
}

interface EditTenantData {
    tenant_id: number;
    id_picture_url?: string;
    tenant_name: string;
    occupation_name: string;
    occupation_company: string;
    phone_numbers: Array<{
        number: string;
        provider?: string;
        is_primary?: boolean;
    }>;
}

interface CreateLeaseData {
    tenant_id: number;
    room_id: number;
    start_date: string;
    end_date: string;
    rent_amount: number;
}

interface TransferRoomData {
    lease_id: number;
    new_room_id: number;
    new_rent_amount: number;
}

interface fetchTenantData {
    tenant_id: number;
    tenant_name: string;
    id_picture: string;
}

export class TenantModel {

    static fetchAllTenantsFromDB = async (): Promise<fetchTenantData[]> => {
        const result = await pool.query('SELECT * FROM tenants;');
        return result.rows;
    }

    static fetchTenantByIdFromDB = async (tenantId: number) => {
        const result = await pool.query(
            `
                SELECT *
                FROM tenants
                WHERE tenant_id = $1
            `,
            [tenantId]
        );
        if (result.rows.length === 0) return null;
        return result.rows[0];
    }

    static fetchTenantDetails = async (tenantId: number) => {
        const result = await pool.query(`
            SELECT 
                t.tenant_id,
                t.tenant_name,
                t.id_picture,

                o.occupation_name,
                o.occupation_company,
                p.property_name,
                r.room_number,
                l.lease_id,
                l.lease_status
            FROM tenants t
            LEFT JOIN tenant_occupations o ON t.tenant_id = o.tenant_id
            LEFT JOIN leases l ON t.tenant_id = l.tenant_id AND l.lease_status = 'active'
            LEFT JOIN rooms r ON l.room_id = r.room_id
            LEFT JOIN properties p ON r.property_id = p.property_id
            WHERE t.tenant_id = $1;
        `, [tenantId]);

        if (result.rows.length === 0) throw new Error("Tenant not found");
        return result.rows[0];
    }

    static insertTenantIntoDB = async (data: InserTenantData) => {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const tenantResult = await client.query(
                "INSERT INTO tenants(tenant_name, id_picture) VALUES ($1, $2) RETURNING *;",
                [data.tenant_name, data.id_picture_url || null]
            );
            const newTenant = tenantResult.rows[0];
            const tenantId = newTenant.tenant_id;

            const savedPhones: any[] = [];
            for (const phone of data.phone_numbers) {
                const phoneResult = await client.query(
                    `INSERT INTO tenants_phone_numbers(tenant_id, phone_number, provider, is_primary)
                    VALUES ($1, $2, COALESCE($3, 'not specified'), COALESCE($4, false)) RETURNING *;`,
                    [
                        tenantId,
                        phone.number,
                        phone.provider !== undefined ? phone.provider : null,
                        phone.is_primary !== undefined ? phone.is_primary : null,
                    ]
                );
                savedPhones.push(phoneResult.rows[0]);
            }
            await client.query("COMMIT");
            return {
                ...newTenant,
                phoneNumbers: savedPhones,
            };
        } catch (err: unknown) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    static editTenantFromDB = async (data: EditTenantData) =>{
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const editTenant = await client.query(`
                UPDATE tenants
                SET 
                    tenant_name = $1,
                    id_picture = COALESCE($2, id_picture)
                WHERE tenant_id = $3
                RETURNING *;`, [data.tenant_name, data.id_picture_url ||null, data.tenant_id]);
            const updatedTenant = editTenant.rows[0];

            const editOccupation = await client.query(`
                INSERT INTO tenant_occupations (tenant_id, occupation_name, occupation_company)
            VALUES ($1, $2, $3)
                ON CONFLICT (tenant_id)
                DO UPDATE SET
                    occupation_name = EXCLUDED.occupation_name,
                    occupation_company = EXCLUDED.occupation_company
                RETURNING *;`, [data.tenant_id, data.occupation_name || 'not specified', data.occupation_company ||'not specified']);
            const updatedOccupation = editOccupation.rows[0];

            await client.query(`
                    DELETE FROM tenants_phone_numbers
                    WHERE tenant_id = $1;
                `,
                [data.tenant_id]
            );

            const savedPhones: any[] = [];
            for (const phone of data.phone_numbers) {
                const phoneResult = await client.query(
                    `INSERT INTO tenants_phone_numbers(tenant_id, phone_number, provider, is_primary)
                    VALUES ($1, $2, COALESCE($3, 'not specified'), COALESCE($4, false)) RETURNING *;
                `,
                    [
                        data.tenant_id,
                        phone.number,
                        phone.provider !== undefined ? phone.provider:null,
                        phone.is_primary !== undefined ? phone.is_primary : null,
                    ]
                );
                savedPhones.push(phoneResult.rows[0]);
            }
            await client.query("COMMIT");
            return {
                ...updatedTenant,
                occupation: updatedOccupation,
                phoneNumbers: savedPhones,
            };
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }


    static deactivateTenantFromDB = async (tenantId: number) => {
        const result = await pool.query(`
                UPDATE tenants
                SET is_active = false
                WHERE tenant_id = $1
                RETURNING *;
            `,
            [tenantId]
        );
        return result.rows[0];
    }

    static createLeaseIntoDB = async (data: CreateLeaseData) =>{
        const result = await pool.query(
            `
                INSERT INTO leases (tenant_id, room_id, lease_start, lease_end, lease_amount, lease_status)
                VALUES ($1, $2, $3, $4, $5, 'active')
                RETURNING *;
            `,
            [data.tenant_id, data.room_id, data.start_date, data.end_date, data.rent_amount]
        );
        return result.rows[0];
    }

    static fetchLeaseByID = async (leaseId: number, client = pool) => {
        const result = await client.query(
            `
                SELECT tenant_id, room_id, lease_end 
                FROM leases 
                WHERE lease_id = $1
            `,
            [leaseId]
        );
        if (result.rows.length === 0) return null;
        return result.rows[0];
    }

    static createRenewalLease = async (data: RenewalData, client= pool) => {
        const result = await client.query(
            `
                INSERT INTO leases (tenant_id, room_id, lease_amount, lease_start, lease_end, lease_status)
                VALUES ($1, $2, $3, CAST($4 AS DATE) + INTERVAL '1 day', $5, 'pending') RETURNING *;
            `,
            [data.tenant_id, data.room_id, data.amount, data.lease_end, data.new_lease_end]
        );
        if (result.rows.length === 0) return null;
        return result.rows[0];
    }

    static fetchExpiringLeaseFromDB = async (daysAhead: number= 30) => {
        const result = await pool.query(
            `
                SELECT leases.*, tenants.tenant_name, rooms.room_number
                FROM leases
                JOIN tenants ON leases.tenant_id = tenants.tenant_id
                JOIN rooms ON rooms.room_id = leases.room_id
                WHERE leases.lease_end = CURRENT_DATE + CAST($1 AS INT) AND leases.lease_status = 'active';
            `,
            [daysAhead]
        );
        return result.rows;
    }

    static fetchLeaseHistoryByTenant = async (tenantId: number) => {
        const result = await pool.query(
            `
                SELECT l.*, r.room_number
                FROM leases l  
                JOIN rooms r ON l.room_id = r.room_id
                WHERE l.tenant_id = $1
                ORDER BY l.lease_start DESC
            `,
            [tenantId]
        );
        return result.rows;
    }

    static fetchOverdueTenantsFromDB = async ()=> {
        const result = await pool.query(`
            SELECT 
                t.tenant_id,
                t.tenant_name,
                r.room_number,
                l.lease_id,
                l.lease_end
            FROM leases l
            JOIN tenants t ON t.tenant_id = l.tenant_id
            JOIN rooms r ON r.room_id = l.room_id
            WHERE l.lease_end <= CURRENT_DATE AND l.lease_status = 'active';
        `);
        return result.rows;
    }

    static terminateEarlyLease = async (leaseId: number) => {
        const result = await pool.query(`
            UPDATE leases
            SET 
                lease_status = 'terminated',
                lease_end = CURRENT_DATE
            WHERE
                lease_id = $1 AND lease_status = 'active'
            RETURNING *;
        `, [leaseId]);
        if (result.rows.length === 0) return null;
        return result.rows[0];
    }

    static markLeaseAsBreached = async (leaseId: number) => {
        const result = await pool.query(`
            UPDATE leases
            SET lease_status = 'breached'
            WHERE lease_id = $1 AND lease_status = 'active'
            RETURNING *
        `, [leaseId]);

        if (result.rows.length === 0) return null;
        return result.rows[0];
    }

    static cancelPendingLease = async (leaseId: number) => {
        const result = await pool.query(`
            UPDATE leases
            SET lease_status = 'cancelled'
            WHERE lease_id = $1 AND lease_status = 'pending'
            RETURNING *
        `, [leaseId]);
        if (result.rows.length === 0) return null;
        return result.rows[0];
    }



    static transferTenantRoom = async (data: TransferRoomData) => {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const oldLease = await client.query(
                `
                UPDATE leases
                SET lease_status = 'terminated', lease_end = CURRENT_DATE
                WHERE lease_id = $1 AND lease_status = 'active'
                RETURNING tenant_id, lease_end;
            `,
                [data.lease_id]
            );

            if (oldLease.rows.length === 0) throw new Error("Active lease not found");
            const { tenant_id } = oldLease.rows[0];

            const newLease = await client.query(
                `
                    INSERT INTO leases (tenant_id, room_id, lease_amount, lease_start, lease_end, lease_status)
                    VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 'active')
                    RETURNING *;
                `,
                [tenant_id, data.new_room_id, data.new_rent_amount]
            );
            await client.query('COMMIT');

            return newLease.rows[0];
        } catch (err: unknown) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }
}