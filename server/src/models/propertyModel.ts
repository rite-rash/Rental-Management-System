import pool from '../config/db';

interface PropertyCountData {
    total_properties: number;
}

interface RoomTypeStatsParams {
    propertyId: number;
}

interface RoomTypeStatsData {
    room_type: string;
    room_count: number;
}

interface TaxHistoryData {
    bill_id: number;
    bill_type: string;
    amount_due: number; 
    due_date: Date | string;
    is_paid: boolean;
    paid_at: Date | string | null;
}

interface PropertyOccupancyParams {
    propertyId?: number;
}

interface PropertyOccupancyStatsData {
    property_id: number;
    property_name: string;
    total_rooms: number;
    occupied_rooms: number;
    occupancy_rate_percentage: number;
}

interface CreateDocumentParams {
    propertyId: number;
    documentName: string;
    documentUrl: string;
    expiryDate?: string | Date; 
}

interface CreateDocumentData {
    document_id: number;
    property_id: number;
    document_name: string;
    document_url: string;
    uploaded_at: Date | string;
    expiry_date: Date | string | null;
}

interface ExpiringDocumentsData {
    document_id: number;
    property_id: number;
    document_name: string;
    document_url: string;
    uploaded_at: Date | string;
    property_name: string;
}

interface ExpiringDocumentParams {
    daysAhead?: number;
}

interface PropertyRoomStatsData {
    property_id: number;
    property_name: string;
    total_rooms: number;
}

interface financialSummaryParams {
    propertyId: number;
    period: 'month' | 'quarter' | 'year';
}

interface propertyProfileData {
    property_id: number;
    property_name: string;
    full_address: string;
}

interface permitHistoryParams {
    propertyId: number;
}

export class PropertyModel {

    static fetchTotalPropertyCount = async (): Promise<PropertyCountData> => {
        const result = await pool.query(`
            SELECT COUNT(property_id)::INT AS total_properties
            FROM properties;
        `);
        return result.rows[0];
    }

    static fetchTaxAndPermitHistory = async (data: permitHistoryParams): Promise<TaxHistoryData[]> => {
        const result = await pool.query(`
            SELECT
                bill_id,
                bill_type,
                amount_due::NUMERIC,
                due_date,
                is_paid,    
                paid_at
            FROM properties_bills
            WHERE property_id = $1 AND bill_type IN ('tax', 'permit')
            ORDER BY due_date DESC;
        `, [data.propertyId]);
        
        return result.rows;
    }

    static fetchRoomTypeStatusByProperty = async (data: RoomTypeStatsParams): Promise<RoomTypeStatsData[]> => {
        const result = await pool.query(`
            SELECT 
                room_type,
                COUNT(room_id)::INT AS room_count
            FROM rooms
            WHERE property_id = $1
            GROUP BY room_type;
        `, [data.propertyId]);
        return result.rows;
    }

    static fetchPropertyProfile = async (propertyId: number): Promise<propertyProfileData> => {
        const result = await pool.query(`
            SELECT
                p.property_id,
                p.property_name,
                CONCAT (
                    'BLK ', a.property_block_number,
                    ' L ', a.property_lot_number,
                    ', ', a.property_street_number,
                    ', ', a.property_city_name,
                    ', ', a.property_postal_code
                ) AS full_address
            FROM properties p
            INNER JOIN property_address a ON p.address_id = a.address_id
            WHERE p.property_id = $1;
        `, [propertyId]);

        if (result.rows.length === 0) {
            throw new Error("Property not found");
        }
        return result.rows[0];
    }

    static createPropertyDocument = async (data: CreateDocumentParams): Promise<CreateDocumentData> => {
        const result = await pool.query(`
            INSERT INTO property_documents(property_id, document_name, document_url, expiry_date)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `, [data.propertyId, data.documentName, data.documentUrl, data.expiryDate || null]);
    
        return result.rows[0];
    }

    static fetchRoomCountByProperty = async (propertyId: number): Promise<PropertyRoomStatsData> => {
        const result = await pool.query(`
            SELECT
                p.property_id, 
                p.property_name,
                COUNT(r.room_id)::INT AS total_rooms
            FROM properties p
            LEFT JOIN rooms r ON p.property_id = r.property_id
            WHERE p.property_id = $1
            GROUP BY p.property_id, p.property_name;
        `, [propertyId]);

        if (result.rows.length === 0) throw new Error("Property not found");
        return result.rows[0];
    }

    static fetchOccupiedRoomStats = async (data: PropertyOccupancyParams = {}): Promise<PropertyOccupancyStatsData[]> => {
        const result = await pool.query(`
            SELECT 
                p.property_id,
                p.property_name,
                COUNT(DISTINCT r.room_id)::INT AS total_rooms,
                COUNT(DISTINCT l.room_id)::INT AS occupied_rooms,
                CASE
                    WHEN COUNT(DISTINCT r.room_id) = 0 THEN 0.00
                    ELSE ROUND((COUNT(DISTINCT l.room_id)::NUMERIC / COUNT(DISTINCT r.room_id)::NUMERIC) * 100, 2)
                END::FLOAT AS occupancy_rate_percentage
            FROM properties p
            LEFT JOIN rooms r ON p.property_id = r.property_id
            LEFT JOIN leases l ON r.room_id = l.room_id AND l.lease_status = 'active'
            WHERE ($1::INT IS NULL OR p.property_id = $1)
            GROUP BY p.property_id, p.property_name
            ORDER BY occupancy_rate_percentage DESC;
        `, [data.propertyId || null]);
        return result.rows; 
    }

    static fetchExpiringDocuments = async (data: ExpiringDocumentParams = {}): Promise<ExpiringDocumentsData[]> => {
        const { daysAhead = 30 } = data;
        const result = await pool.query(`
            SELECT d.*, p.property_name
            FROM property_documents d
            JOIN properties p ON d.property_id = p.property_id
            WHERE d.expiry_date <= CURRENT_DATE + (INTERVAL '1 day' * CAST($1 AS INT))
                AND d.expiry_date >= CURRENT_DATE
            ORDER BY d.expiry_date ASC;
        `, [daysAhead]);
        return result.rows;
    }

    static fetchPropertyFinancialRevenue = async (data: financialSummaryParams): Promise<string> => { 
        let dataFilter = '';

        if (data.period === 'month') {
            dataFilter = "l.start_date >= CURRENT_DATE - INTERVAL '1 month' ";    
        } else if (data.period === 'quarter') {
            dataFilter = "l.start_date >= CURRENT_DATE - INTERVAL '3 months'";
        } else if (data.period === 'year') {
            dataFilter = "l.start_date >= CURRENT_DATE - INTERVAL '1 year' ";
        }

        const result = await pool.query(`
            SELECT
                COALESCE(SUM(l.lease_amount), 0.00)::NUMERIC AS total_revenue
            FROM rooms r
            JOIN leases l ON r.room_id = l.room_id
            WHERE r.property_id = $1 AND l.lease_status = 'active' AND ${dataFilter};
        `, [data.propertyId]);
        return result.rows[0].total_revenue; 
    }

    static fetchPropertyFinancialExpense = async (data: financialSummaryParams): Promise<string> => {
        let dataFilter = '';

        if (data.period === 'month') {
            dataFilter = "b.due_date >= CURRENT_DATE - INTERVAL '1 month'";
        } else if (data.period === 'quarter') {
            dataFilter = "b.due_date >= CURRENT_DATE - INTERVAL '3 months'";
        } else if (data.period === 'year') {
            dataFilter = "b.due_date >= CURRENT_DATE - INTERVAL '1 year' ";
        }

        const result = await pool.query(`
            SELECT 
                COALESCE(SUM(b.amount_due), 0.00)::NUMERIC AS total_bills
            FROM properties_bills b
            WHERE b.property_id = $1 AND b.is_paid = false AND ${dataFilter};
        `, [data.propertyId]);
        return result.rows[0].total_bills;
    }
}