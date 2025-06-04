import { db } from "@/lib/db"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const data = await req.json()
    await db.collection('bookings').insertOne({ type: 'GET', data })
  } catch (e: any) {
    console.log(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    await db.collection('bookings').insertOne({ type: 'POST', data })
  } catch (e: any) {
    console.log(e)
  }
}