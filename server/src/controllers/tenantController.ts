import {Request, Response} from 'express';
import * as TenantModel from '../models/tenantModel';

//encrypt pw
export const getAllTenant = async (req: Request, res: Response) => {
    try {
        const tenants = await TenantModel.fetchAllTenantsFromDB();
        res.json(tenants); 
    } catch (err: unknown)  {
        if (err instanceof Error) {
            return res.status(500).json({ error: err.message }); 
        }
        return res.status(500).json ({error: "An unexpected system error occured."})
    }
};

export const createTenant = async (req: Request, res: Response) => {
    try {
        const {tenant_name, phone_numbers} = req.body;

        if (!tenant_name || !phone_numbers || !Array.isArray(phone_numbers) ) {
            return res.status(400).json({ error: "Invalid data format."});
        }
        const newProfile = await TenantModel.insertTenantIntoDB(tenant_name, phone_numbers);
        return res.status(201).json(newProfile);
    } catch (err: unknown) {
        if (err instanceof Error) {
            return res.status(500).json({ error: err.message });        
        }
        return res.status(500).json ({error: "An unexpected system error occured."})
    }
 };

export const updateTenant = async (req: Request, res: Response) => { 
    try{ 
        const tenant_id = parseInt(req.params.id as string, 10);
        const { tenant_name, phone_numbers} = req.body;

        if ( isNaN(tenant_id) || !tenant_name || !phone_numbers || !Array.isArray(phone_numbers) ) {
            return res.status(400).json( {error: "Invalid data format or missing tenant id." } )
        }

        const updateProfile = await TenantModel.editTenantFromDB(tenant_id, tenant_name, phone_numbers)
        if(!updateProfile) {
            return res.status(404).json({error: "Tenant not found."});
        }
        return res.status(200).json(updateProfile);
    } catch (err: unknown) {
        if (err instanceof Error) {
            return res.status(500).json({ error: err.message }); 
        }
        return res.status(500).json ({error: "An unexpected system error occured."})
    }
 };

export const deleteTenant = async (req: Request, res: Response) => { 
    try {
        const tenant_id = parseInt(req.params.id as string, 10);
        if (isNaN(tenant_id)) {
            return res.status(400).json({ error: "Invalid tenant ID."});
        }

        const deactivatedTenant = await TenantModel.deactivateTenantFromDB(tenant_id);
        if(!deactivatedTenant) {
            return res.status(404).json({ error: "Tenant not found."});
        }
        return res.status(200).json({ message: "Tenant successfully deactivated", tenant: deactivatedTenant});

    } catch (err: unknown) {
        if (err instanceof Error) {
            return res.status(500).json({ error: err.message });        
        }
        return res.status(500).json ({error: "An unexpected system error occured."})
    }
 };







