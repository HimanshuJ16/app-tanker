import { neon } from "@neondatabase/serverless";

export async function GET(request: Request, { id }: { id: string }) {
  if (!id) {
    console.error("Error: Missing required fields");
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const response = await sql`
      SELECT 
        t.id as "tripId",
        t.status as "tripStatus",
        t."startTime",
        t."endTime",
        t.distance,
        b.id as "bookingId",
        b."scheduledDateTime" as "journeyDate",
        b.status as "bookingStatus",
        h.name as "hydrantName",
        h.address as "hydrantAddress",
        d.name as "destinationName",
        d.address as "destinationAddress",
        c.name as "customerName",
        c."contactNumber" as "customerContact",
        c.address as "customerAddress"
      FROM "Trip" t
      LEFT JOIN "Booking" b ON t."bookingId" = b.id
      LEFT JOIN "Hydrant" h ON b."hydrantId" = h.id
      LEFT JOIN "Customer" c ON b."customerId" = c.id
      LEFT JOIN "Destination" d ON b."destinationId" = d.id
      WHERE t.id = ${id}::uuid
    `;

    if (response.length === 0) {
      return new Response(JSON.stringify({ error: "Trip not found" }), { status: 404 });
    }

    const trip = response[0];
    const formattedTrip = {
      tripId: trip.tripId,
      status: trip.tripStatus,
      startTime: trip.startTime,
      endTime: trip.endTime,
      distance: trip.distance,
      booking: {
        id: trip.bookingId,
        journeyDate: trip.journeyDate ? new Date(trip.journeyDate).toISOString() : null,
        status: trip.bookingStatus
      },
      hydrant: {
        name: trip.hydrantName,
        address: trip.hydrantAddress
      },
      destination: {
        name: trip.destinationName,
        address: trip.destinationAddress
      },
      customer: {
        name: trip.customerName,
        contactNumber: trip.customerContact,
        address: trip.customerAddress
      }
    };

    return new Response(
      JSON.stringify({ success: true, trip: formattedTrip }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error fetching trip details:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
