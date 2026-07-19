import { Request, Response, NextFunction } from 'express';
import { TenantModel } from '../models/tenantModel';

const getAllTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenants = await TenantModel.fetchAllTenantsFromDB();
        const formatted = tenants.map((t: any) => ({
            tenantId: t.tenant_id,
            tenantName: t.tenant_name,
            idPicture: t.id_picture
        }));
        res.json(formatted); 
    } catch (err)  {
        next(err);
    }
};

const createTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantName, phoneNumbers, idPictureUrl } = req.body; 

        if (!tenantName || !phoneNumbers || !Array.isArray(phoneNumbers) ) {
            return res.status(400).json({ error: "Invalid data format."});
        }

        const newProfile = await TenantModel.insertTenantIntoDB({
            tenant_name: tenantName,
            phone_numbers: phoneNumbers.map((p: any) => ({
                number: p.number,
                provider: p.provider,
                is_primary: p.isPrimary
            })),
            id_picture_url: idPictureUrl || ""
        });

        return res.status(201).json({
            tenantId: newProfile.tenant_id,
            tenantName: newProfile.tenant_name,
            idPicture: newProfile.id_picture,
            phoneNumbers: newProfile.phoneNumbers.map((p: any) => ({
                number: p.phone_number,
                provider: p.provider,
                isPrimary: p.is_primary
            }))
        });
    } catch (err) {
        next(err);
    }
};

const updateTenant = async (req: Request, res: Response, next: NextFunction) => { 
    try { 
        const tenantId = parseInt(req.params.id as string, 10);
        const { tenantName, phoneNumbers, occupationName, occupationCompany } = req.body;

        if ( isNaN(tenantId) || !tenantName || !phoneNumbers || !Array.isArray(phoneNumbers) ) {
            return res.status(400).json( {error: "Invalid data format or missing tenant id." } )
        }

        const updateProfile = await TenantModel.editTenantFromDB({
            tenant_id: tenantId, 
            tenant_name: tenantName, 
            phone_numbers: phoneNumbers.map((p: any) => ({
                number: p.number,
                provider: p.provider,
                is_primary: p.isPrimary
            })), 
            occupation_name: occupationName || "", 
            occupation_company: occupationCompany || "" 
        });

        if(!updateProfile) return res.status(404).json({error: "Tenant not found."});

        return res.status(200).json({
            tenantId: updateProfile.tenant_id,
            tenantName: updateProfile.tenant_name,
            idPicture: updateProfile.id_picture,
            occupation: {
                occupationName: updateProfile.occupation?.occupation_name,
                occupationCompany: updateProfile.occupation?.occupation_company
            },
            phoneNumbers: updateProfile.phoneNumbers.map((p: any) => ({
                number: p.phone_number,
                provider: p.provider,
                isPrimary: p.is_primary
            }))
        });
    } catch (err) {
        next(err);
    }
};

const deleteTenant = async (req: Request, res: Response, next: NextFunction) => { 
    try {
        const tenantId = parseInt(req.params.id as string, 10);
        if (isNaN(tenantId)) return res.status(400).json({ error: "Invalid tenant id."});

        const deactivatedTenant = await TenantModel.deactivateTenantFromDB(tenantId);
        if(!deactivatedTenant) return res.status(404).json({ error: "Tenant not found"});
        
        return res.status(200).json({ 
            message: "Tenant successfully deactivated", 
            data: {
                tenantId: deactivatedTenant.tenant_id,
                isActive: deactivatedTenant.is_active
            }
        });
    } catch (err) {
        next(err);
    }
};

const getTenant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = parseInt(req.params.id as string, 10);
        if (isNaN(tenantId)) return res.status(400).json({error: "Invalid tenant id"});

        const tenant = await TenantModel.fetchTenantByIdFromDB(tenantId);
        if(!tenant) return res.status(404).json({error: "Tenant not found"});

        return res.status(200).json({
            message: "Successfully found tenant", 
            data: {
                tenantId: tenant.tenant_id,
                tenantName: tenant.tenant_name,
                idPicture: tenant.id_picture
            }
        }); 
    } catch (err) {
        next(err);
    }
};

const createLease = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tenantId, roomId, leaseStart, leaseEnd, leaseAmount } = req.body;
        
        if (!tenantId || !roomId || !leaseStart || !leaseEnd || !leaseAmount ) {
            return res.status(400).json({error: "Incomplete or invalid data"});
        }

        const lease = await TenantModel.createLeaseIntoDB({
            tenant_id: tenantId, 
            room_id: roomId,
            start_date: leaseStart,
            end_date: leaseEnd,
            rent_amount: leaseAmount
        });

        return res.status(201).json({
            message: "Lease successfully created", 
            data: {
                leaseId: lease.lease_id,
                tenantId: lease.tenant_id,
                roomId: lease.room_id,
                leaseStart: lease.lease_start,
                leaseEnd: lease.lease_end,
                leaseAmount: lease.lease_amount,
                leaseStatus: lease.lease_status
            }
        });
    } catch (err) {
        next(err)
    }
};

const getOverdueLease = async (req: Request, res: Response, next: NextFunction) => {
    try {  
        const overdueLease = await TenantModel.fetchOverdueTenantsFromDB();
        if (overdueLease.length === 0) return res.status(404).json({error: "No overdue lease found"}); 
        
        const formatted = overdueLease.map((l: any) => ({
            tenantId: l.tenant_id,
            tenantName: l.tenant_name,
            roomNumber: l.room_number,
            leaseId: l.lease_id,
            leaseEnd: l.lease_end
        }));

        return res.status(200).json({message: "Successfully fetch all tenants having overdue lease", data: formatted});
    } catch (err) {
        next (err);
    }
};

const terminateLease = async (req: Request, res: Response, next: NextFunction) => { 
    try {
        const leaseId = parseInt( req.params.id as string, 10);
        if ( isNaN(leaseId)) return res.status(400).json({error: "invalid lease id"});

        const lease = await TenantModel.terminateEarlyLease(leaseId);
        if (!lease) return res.status(404).json({message: "no lease found given id"}); 
        return res.status(200).json({message: "lease successfully terminated"});
    } catch (err) {
        next(err);
    }
};

const markAsBreached = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leaseId = parseInt(req.params.id as string, 10);
        if ( isNaN(leaseId)) return res.status(400).json({error:"invalid lease id"});

        const lease = await TenantModel.markLeaseAsBreached(leaseId);
        if (!lease) return res.status(404).json({message: " no lease found having the id provided"});
        
        return res.status(200).json({
            message: "successfully marked lease as breached", 
            data: {
                leaseId: lease.lease_id,
                leaseStatus: lease.lease_status
            }
        }); 
    } catch (err) {
        next(err);
    }
};

const markAsCancelled = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leaseId = parseInt(req.params.id as string, 10);
        if (isNaN(leaseId)) return res.status(400).json({error: "invalid lease id"});

        const lease = await TenantModel.cancelPendingLease(leaseId);
        if (!lease) return res.status(404).json({message: "no lease found having the id"});
        
        return res.status(200).json({
            message: "successfully marked the lease cancelled", 
            data: {
                leaseId: lease.lease_id,
                leaseStatus: lease.lease_status
            }
        });
    } catch(err) {
        next(err);   
    }
};

const renewLease = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leaseId = parseInt( req.params.id as string, 10 ); 
        if (isNaN(leaseId)) return res.status(400).json({error: "invalid lease id"});

        const foundLease = await TenantModel.fetchLeaseByID(leaseId);
        if (!foundLease) return res.status(404).json({error: "lease not found"}); 

        const { tenantId, roomId, leaseAmount, leaseEnd, newLeaseEnd, leaseStatus } = req.body;
        const lease = await TenantModel.createRenewalLease({
            lease_id: leaseId,
            tenant_id: tenantId, 
            room_id: roomId, 
            amount: leaseAmount, 
            lease_end: leaseEnd, 
            new_lease_end: newLeaseEnd, 
            status: leaseStatus
        });
        
        if (!lease) return res.status(500).json({error: "error in server"});
        
        return res.status(201).json({
            message: "renewed lease successfully", 
            data: {
                leaseId: lease.lease_id,
                tenantId: lease.tenant_id,
                roomId: lease.room_id,
                leaseAmount: lease.lease_amount,
                leaseStatus: lease.lease_status
            }
        });
    } catch (err  ) {
        next(err);
    }
};

const getTenantLeaseHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = parseInt(req.params.id as string, 10) ;
        if (isNaN(tenantId)) return res.status(400).json({error: "Invalid tenant id"});

        const leaseHistory = await TenantModel.fetchLeaseHistoryByTenant(tenantId);

        if (leaseHistory.length === 0) return res.status(404).json({message: "no history found"});
        
        const formatted = leaseHistory.map((l: any) => ({
            leaseId: l.lease_id,
            tenantId: l.tenant_id,
            roomId: l.room_id,
            roomNumber: l.room_number,
            leaseStart: l.lease_start,
            leaseEnd: l.lease_end,
            leaseAmount: l.lease_amount,
            leaseStatus: l.lease_status
        }));

        res.status(200).json({message: `Successfully found lease history for tenant ${tenantId}`, data: formatted});
    } catch (err) {
        next(err);
    }
};



const transferRoom = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { leaseId, newRoomId, newRentAmount } = req.body;

        if (!leaseId || isNaN(Number(leaseId))) return res.status(400).json({ error: "A valid leaseId is required" });
        if (!newRoomId || isNaN(Number(newRoomId))) return res.status(400).json({ error: "A valid newRoomId is required" });
        if (!newRentAmount || isNaN(Number(newRentAmount))) return res.status(400).json({ error: "A valid newRentAmount is required" });

        const newActiveLease = await TenantModel.transferTenantRoom({
            lease_id: Number(leaseId),
            new_room_id: Number(newRoomId),
            new_rent_amount: Number(newRentAmount)
        });

        return res.status(200).json({
            message: "Successfully transferred tenant to another room with lease history preserved", 
            data: {
                leaseId: newActiveLease.lease_id,
                tenantId: newActiveLease.tenant_id,
                roomId: newActiveLease.room_id,
                leaseAmount: newActiveLease.lease_amount,
                leaseStart: newActiveLease.lease_start,
                leaseEnd: newActiveLease.lease_end,
                leaseStatus: newActiveLease.lease_status
            }
        });
    } catch (err) {
        if (err.message === "Active lease not found") return res.status(404).json({error: err.message});
        next(err);
    }
};


export { 
        getAllTenant, 
        createTenant, 
        updateTenant, 
        deleteTenant, 
        getTenant,
        createLease, 
        getOverdueLease, 
        terminateLease, 
        markAsBreached, 
        markAsCancelled, 
        renewLease, 
        getTenantLeaseHistory,
        transferRoom 
};





