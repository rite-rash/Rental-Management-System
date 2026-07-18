import {Response, Request, NextFunction} from 'express';
import {PropertyModel} from '../models/propertyModel';



const getTotalPropertyCount = async(req: Request, res: Response, next: NextFunction) => {
    try {
        const countData = await PropertyModel.fetchTotalPropertyCount();

        return res.status(200).json({message: "Successfully retrieved total property count", data: { totalProperties: countData.total_properties } }); 

    } catch (err) {
        next(err);
    }
}

const getTaxAndPermitHistory = async (req: Request, res:Response, next: NextFunction) => {
    try {
        const propertyId = parseInt(req.params.id as string, 10);
        if(isNaN(propertyId)) return res.status(400).json({error: "Invalid property id"});

        
        const result = await PropertyModel.fetchTaxAndPermitHistory({propertyId}); 
        const formatted = result.map((bill: any) => ({   
            billId: bill.bill_id,
            billType: bill.bill_type,
            amountDue: Number(bill.amount_due), 
            dueDate: bill.due_date,
            isPaid: bill.is_paid,
            paidAt: bill.paid_at

        }));

        return res.status(200).json({message: `Successfully retireved tax and permit history of ${propertyId}`, data: formatted});

    } catch (err) {
        next(err)
    }
}


const getRoomTypeStatusByProperty = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const propertyId = parseInt(req.params.id as string, 10);
        if (isNaN(propertyId)) return res.status(400).json({error: "Invalid property id"});

        const result = await PropertyModel.fetchRoomTypeStatusByProperty({propertyId});

        const formatted = result.map((room: any)=> ({

            roomType: room.room_type,
            roomCount : room.room_count
        }));
        return res.status(200).json({message: `Successfully retrieved room type distributions for property ${propertyId}`, data: formatted});


    } catch (err) {
        next(err);
    }

}


const getPropertyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const propertyId = parseInt(req.params.id as string, 10);
        if(isNaN(propertyId)) return res.status(400).json({error: "invalid property id"});

        const result = await PropertyModel.fetchPropertyProfile(propertyId);
        return res.status(200).json({message: "successfully retrieved propert profile", 

            data: { 
                propertyId: result.property_id, 
                propertyName: result.property_name,
                fullAddress: result.full_address
            }})
    } catch (err) {

        if (err.message === "Property not found") return res.status(404).json({ error: err.message });
        next(err);
    }
}


const createPropertyDocument = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const { propertyId, documentName, documentUrl, expiryDate } = req.body; 
        const parsedId = Number(propertyId); 


        if (isNaN(parsedId) || !documentName || !documentUrl || !expiryDate) {
            return res.status(400).json({error: "invalid or incomplete parameter"});
        }

        const result = await PropertyModel.createPropertyDocument({
            propertyId: parsedId, 
            documentName, 
            documentUrl, 
            expiryDate 
        });


        return res.status(201).json({message: "Successfully recorded new property document", 
            data:{
                documentId: result.document_id,
                propertyId: result.property_id,
                documentName: result.document_name,
                documentUrl: result.document_url,
                uploadAt: result.uploaded_at,
                expirDate: result.expiry_date
            }
        });
    } catch(err) {
        next(err);
    }
}


const getOccupiedRoomStats = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string, 10) : undefined;

        if (propertyId !== undefined&& isNaN(propertyId)) {

            return res.status(400).json({error: "invalid query syntax for propertyId"});
        }

        const result = await PropertyModel.fetchOccupiedRoomStats( {propertyId});

        const formatted = result.map( (item) => ({
            propertyId: item.property_id,
            propertyName: item.property_name,
            occupiedRooms: item.occupied_rooms,
            occupancyRatePercentage: item.occupancy_rate_percentage
        }) );

        return res.status(200).json ({ message: "occupancy rate computed successfully",
            data: formatted
        });

    } catch (err) {
        next(err);
    }
}


const getRoomCountByProperty = async (req: Request, res: Response, next: NextFunction) => {

    try {
        const propertyId = parseInt(req.params.id as string, 10);
        if(isNaN(propertyId)) return res.status(400).json({error: "invalid property id"});

        const result = await PropertyModel.fetchRoomCountByProperty(propertyId); 
        return res.status(200).json({message: "",
            data: {
                propertyId: result.property_id,
                propertyName: result.property_name,
                totalRooms: result.total_rooms
            }
        })
    } catch (err) {

        if (err.message === "Property not found") return res.status(404).json({error: err.message});
        next(err);
    }
}


// TODO: probably add filter for only expiring documents in specified properties
const getExpiringDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead as string, 10) : undefined;
        if (daysAhead !== undefined && isNaN(daysAhead)) {
            return res.status(400).json({error: "Invalid daysAhead"});
        }

        const result = await PropertyModel.fetchExpiringDocuments({daysAhead}) 
        const formatted = result.map((doc) => ({
            documentId : doc.document_id,
            propertyId: doc.property_id,
            propertyName: doc.property_name,
            documentName: doc.document_name,
            documentUrl: doc.document_url,
            uploadedAt: doc.uploaded_at
            })
        );
        return res.status(200).json({message: `Retrieved documents near expiration date of ${daysAhead}`, data: formatted}) 

    } catch (err) {
        next(err);
    }
}


const getPropertyFinancialSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const propertyId= parseInt(req.params.id as string, 10);

        const period = req.query.period as 'month' | 'quarter' | 'year';
        if(isNaN(propertyId)) return res.status(400).json({error: "invalid property id"});


        if (!['month', 'quarter', 'year'].includes(period)) return res.status(400).json({ error: "Period query string must be 'month', 'quarter', or 'year'." });
        
        const revenueResult = await PropertyModel.fetchPropertyFinancialRevenue({propertyId, period});
        const expenseResult = await PropertyModel.fetchPropertyFinancialExpense({propertyId, period});

        return res.status(200).json({ message: `Financial analysis for this ${period} `,
            data: {
                propertyId,
                period,
                totalRevenue: Number(revenueResult),
                totalExpense: Number(expenseResult),
                netIncome: Number(revenueResult) - Number(expenseResult)
            }

        });

    } catch (err) {
        next(err);
    }
}












export {
    getTotalPropertyCount,
    getTaxAndPermitHistory,
    getPropertyFinancialSummary,
    createPropertyDocument,
    getPropertyProfile,
    getOccupiedRoomStats,
    getRoomCountByProperty,
    getExpiringDocuments,
    getRoomTypeStatusByProperty

}