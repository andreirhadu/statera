// pages/api/cron/flag-invoices.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

const bedsRefreshToken = process.env.BEDS24_REFRESH_TOKEN!

export async function POST(req: NextRequest) {
  try {

    const invoicesCol = db.collection('invoices')

    const invoices = await invoicesCol.find({
      flagSet: { $ne: true },
      bookingId: { $exists: true }
    }).toArray()

    if (!invoices.length) return Response.json({ message: 'No invoices to update' })

    const { data: { token } } = await axios.get(
      'https://api.beds24.com/v2/authentication/token',
      { headers: { refreshToken: bedsRefreshToken } }
    )

    const batch = invoices.map(inv => ({
      id: inv.bookingId,
      flagText: 'Facturat'
    }))

    await axios.post('https://api.beds24.com/v2/bookings', batch, {
      headers: {
        accept: 'application/json',
        token,
        'Content-Type': 'application/json'
      }
    })

    await invoicesCol.updateMany(
      { _id: { $in: invoices.map(inv => new ObjectId(inv._id)) } },
      { $set: { flagSet: true, updatedAt: new Date() } }
    )

    return Response.json({ updated: invoices.length })
  } catch (e: any) {
    console.error('[cron error]', e.response?.data || e.message)
    return Response.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
