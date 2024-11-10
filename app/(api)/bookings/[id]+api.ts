import { neon } from "@neondatabase/serverless";

export async function GET(request: Request, { id }: { id: string }) {
  if (!id) {
    console.error("Error: Missing required fields");
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const sql = neon(`${process.env.DATABASE_URL}`);

    // Fetch bookings and check for associated trips
    const response = await sql`
      SELECT 
        b.id as "bookingId",
        b."scheduledDateTime" as "journeyDate",
        b.status,
        h.name as "hydrantName",
        h.address as "hydrantAddress",
        c.name as "customerName",
        c."contactNumber" as "customerContact",
        c.address as "customerAddress",
        d.name as "destinationName",
        d.address as "destinationAddress",
        t.id as "tripId",
        t.status as "tripStatus"
      FROM "Booking" b
      LEFT JOIN "Hydrant" h ON b."hydrantId" = h.id
      LEFT JOIN "Customer" c ON b."customerId" = c.id
      LEFT JOIN "Destination" d ON b."destinationId" = d.id
      LEFT JOIN "Trip" t ON t."bookingId" = b.id
      WHERE b."vehicleId" = ${id}
      AND b.status NOT IN ('pending', 'disapproved')
      ORDER BY b."scheduledDateTime" DESC;
    `;

    console.log(`Found ${response.length} non-pending or approved bookings`);

    const formattedBookings = response.map(booking => ({
      bookingId: booking.bookingId,
      journeyDate: booking.journeyDate ? new Date(booking.journeyDate).toLocaleString() : null,
      hydrant: {
        name: booking.hydrantName,
        address: booking.hydrantAddress,
      },
      destination: {
        name: booking.destinationName,
        address: booking.destinationAddress,
      },
      customer: {
        name: booking.customerName,
        contactNumber: booking.customerContact,
        address: booking.customerAddress,
      },
      status: booking.status,
      trip: {
        tripId: booking.tripId,
        status: booking.tripStatus,
      }
    }));

    return Response.json(
      {
        success: true,
        bookings: formattedBookings,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching vehicle bookings:", error);
    return Response.json(
      { error: "Internal Server Error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
