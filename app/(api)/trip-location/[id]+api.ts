import { neon } from "@neondatabase/serverless";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const tripId = params.id;
  if (!tripId) {
    return Response.json({ success: false, error: "Missing trip ID" }, { status: 400 });
  }

  try {
    const { latitude, longitude, altitude, speed, heading } = await request.json();
    
    if (!latitude || !longitude) {
      return Response.json({ success: false, error: "Missing required location data" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);

    const result = await sql`
      INSERT INTO "GpsLocation" (
        "latitude",
        "longitude",
        "altitude",
        "speed",
        "heading",
        "timestamp",
        "tripId"
      ) VALUES (
        ${latitude},
        ${longitude},
        ${altitude || null},
        ${speed || null},
        ${heading || null},
        NOW(),
        ${tripId}::uuid
      ) RETURNING id
    `;

    if (result.length === 0) {
      throw new Error("Failed to insert GPS location");
    }

    return Response.json({
      success: true,
      message: 'GPS location updated successfully',
      locationId: result[0].id
    }, { status: 200 });

  } catch (error) {
    console.error("Error updating GPS location:", error);
    return Response.json(
      { success: false, error: "Internal Server Error", details: (error as Error).message },
      { status: 500 }
    );
  }
}