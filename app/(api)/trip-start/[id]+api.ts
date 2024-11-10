import { neon } from "@neondatabase/serverless";

export async function POST(request: Request, { id }: { id: string }) {
  if (!id) {
    console.error("Error: Missing required fields");
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Update trip start time and status
    const result = await sql`
      UPDATE "Trip"
      SET "startTime" = NOW(),
          "status" = 'ongoing',
          "updatedAt" = NOW()
      WHERE "id" = ${id}
      RETURNING "id", "startTime", "status"
    `;

    if (result.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    const updatedTrip = result[0];

    return Response.json({
      success: true,
      message: 'Trip started successfully',
      trip: {
        id: updatedTrip.id,
        startTime: updatedTrip.startTime,
        status: updatedTrip.status
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Error starting trip:", error);
    return Response.json(
      { error: "Internal Server Error", details: (error as Error).message },
      { status: 500 }
    );
  }
}