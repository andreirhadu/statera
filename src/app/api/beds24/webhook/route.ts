import { db } from "@/lib/db"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const data = await req.json()
    await db.collection('bookings').insertOne({ type: 'GET', data, bookingId: data?.booking?.id  })

    return Response.json({ received: true })
  } catch (e: any) {
    console.log(e)

    return Response.json({message: e.message || '' }, {status: 400})
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    await db.collection('bookings').insertOne({ type: 'POST', data, bookingId: data?.booking?.id })

    return Response.json({ received: true })
  } catch (e: any) {
    console.log(e)

    return Response.json({message: e.message || '' }, {status: 400})
  }
}