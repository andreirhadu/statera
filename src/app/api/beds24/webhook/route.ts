import { db } from "@/lib/db"
import { generateInvoiceTemplate } from "@/templates/templates"
import { sendMail } from "@/utils/sendMail"
import axios from "axios"
import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const booking = data?.booking

    const invoice = await db.collection('invoices').findOne({ bookingId: booking?.id })

    if ( invoice ) {
      return Response.json({ success: true })
    }

    // Salvează webhook-ul pentru audit
    await db.collection('bookings').insertOne({ type: 'POST', data, bookingId: booking?.id })

    const invoiceItems = data?.invoiceItems || []

    const randomNumber = Math.floor(Math.random() * 6) + 1

    // Date client
    var name = `${booking.firstName} ${booking.lastName}`
    var contact = `${booking.firstName} ${booking.lastName}`
    var email = booking.email
    var phone = booking.phone
    var city = booking.city
    var country = booking.country ? (booking.country.length != 0 ? booking.country.toUpperCase() : 'RO') : 'RO'
    var county = data.booking.custom7.length != 0 ? data.booking.custom7.replace("Judet/County : ", "") : null
    var address = data.booking.custom9.length != 0 ? data.booking.custom9.replace("Strada, nr/Street, no : ", "") : null
    var vatCode = data.booking?.custom6?.replace("Cod fiscal/VAT number : ", "").length > 3 ? data.booking?.custom6?.replace("Cod fiscal/VAT number : ", "") : undefined
    var company = data.booking?.custom5?.replace("Denumire firma/ Company name : ", "").length > 3 ? data.booking?.custom5?.replace("Denumire firma/ Company name : ", "") : null
    var isConfirmed = booking.status == 'confirmed' ? true : false
    var isPaid = invoiceItems
    .filter((item: any) => (item.type === 'payment'))
    .findIndex((item: any) => item.status === 'Paid' || item.status === 'Plata' ) !== -1

    const channel = booking.lastName.toLowerCase().includes('szallas') ? 'travelminit' : (booking.channel === 'airbnb' ? 'airbnb' : (booking.channel === 'expedia' ? 'expedia' : 'other'))

    const charge = invoiceItems
    .filter((item: any) => (item.type === 'charge'))?.[0]

    if ( channel === 'travelminit' ) {
      name = 'Travelminit International SRL'
      vatCode = 'RO38869249'
      address = 'Str. Gării, Nr. 21, D1/1B'
      city = 'Cluj Napoca'
      county = 'Cluj'
      isPaid = (charge && charge.amount !== 0) ? true : false
    }

    if ( channel === 'airbnb' ) {
      name = 'Earthport PLC/Airbnb'
      vatCode = undefined
      address = "-"
      city = 'San Francisco'
      county = 'USA'
      isPaid = (charge && charge.amount !== 0) ? true : false
    }

    if ( channel === 'expedia' ) {
      name = 'Expedia Lodging Partner Services Sàrl'
      vatCode = 'CHE115256336'
      address = "Rue du 31 Décembre 40-42 et 44-46"
      city = 'Genève'
      county = 'Switzerland'
    }

    await db.collection('logs').insertOne({ bookingId: booking.id, address, county, isConfirmed, isPaid, invoiceItems })

    if ( !address || !county || !isConfirmed || !isPaid ) {
      return Response.json({ success: true })
    }

    try {
      if ( city.toLowerCase() === 'bucuresti' || city.toLowerCase() === 'bucurești' || city.toLowerCase() === 'bucharest' ) {
        if ( !county.toLowerCase().includes('sector')) {
          county = 'Sector' + String(randomNumber)
        }
      }
    } catch (e: any) {
      await db.collection('errors').insertOne({ data: e?.response?.data, message: e.message })
    }

    const price = invoiceItems
    .filter((item: any) => (item.type === 'payment'))
    .reduce((prev: any, curr: any) => curr.amount + prev, 0)

    const paymentMethod = invoiceItems
    .filter((item: any) => (item.type === 'payment'))?.[0]?.description

    if ( channel === 'other' && price === 0 ) {
      return Response.json({ success: true })
    }

    var products = [{
      name: `Servicii cazare perioada ${booking.arrival} - ${booking.departure} (${paymentMethod})`,
      isDiscount: false,
      measuringUnitName: 'sejur',
      currency: 'RON',
      quantity: 1,
      price,
      isTaxIncluded: true,
      taxName: 'Redusa',
      taxPercentage: 9,
      saveToDb: false
    }]

    if ( channel === 'travelminit' && charge ) {
      products = [{
        name: charge.description,
        isDiscount: false,
        measuringUnitName: 'sejur',
        currency: 'RON',
        quantity: 1,
        price: charge.amount,
        isTaxIncluded: true,
        taxName: 'Redusa',
        taxPercentage: 9,
        saveToDb: false
      }]
    }

    if ( channel === 'airbnb' && charge ) {
      products = [{
        name: `Servicii cazare perioada ${booking.arrival} - ${booking.departure}`,
        isDiscount: false,
        measuringUnitName: 'sejur',
        currency: 'RON',
        quantity: 1,
        price: charge.amount,
        isTaxIncluded: true,
        taxName: 'Redusa',
        taxPercentage: 9,
        saveToDb: false
      }]
    }

    // Emitere factură SmartBill
    const response = await axios.post(
      'https://ws.smartbill.ro/SBORO/api/invoice',
      {
        companyVatCode: 'RO35750609', // înlocuiește cu CIF-ul tău
        seriesName: 'GLD',         // seria ta din SmartBill
        currency: 'RON',
        client: {
          name: company || name,
          contact,
          email,
          // phone,
          address,
          city,
          county,
          country,
          vatCode,
          isTaxPayer: false,
          saveToDb: true
        },
        products,
        payment: {
          value: price,
          type: 'Card',
          isCash: false
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'authorization': `Basic ${process.env.SMARTBILL_KEY}`
        }
      }
    )

    const response1 = await axios.get(`https://ws.smartbill.ro/SBORO/api/invoice/pdf?cif=RO35750609&seriesname=${response.data.series}&number=${response.data.number}`, {
      responseType: 'arraybuffer',
      responseEncoding: 'binary',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/octet-stream',
        'authorization': `Basic ${process.env.SMARTBILL_KEY}`,
        'Content-Disposition': 'attachment; filename=new.pdf'
      }
    })

    const base64 = Buffer.from(response1.data).toString("base64")

    try {
      if ( channel === 'other' ) {
        await sendMail({
          to: email,
          nameSender: booking.propertyId == 129475 ? 'Aria Boutique Oradea' : 'Moonlight Central Apartments Oradea',
          subject: `Factura ${response.data.series}-${response.data.number} - ${booking.propertyId == 129475 ? 'Aria Boutique Oradea' : 'Moonlight Central Apartments Oradea'}`, 
          html: generateInvoiceTemplate({ name: booking?.firstName || "" }),
          attachments: [{ content: base64, name: `Factura ${response.data.series}-${response.data.number}.pdf`}],
        })
      }
    } catch (e: any) {
      console.log(e)
    }

    try {
      const response = await axios.get('https://api.beds24.com/v2/authentication/token', {
        headers: {
          refreshToken: process.env.BEDS24_REFRESH_TOKEN
        }
      })

      const token = response.data.token

      await axios.post('https://api.beds24.com/v2/bookings', [{
        id: booking.id,
        flagText: 'Facturat'
      }], {
        headers: {
          'accept': 'application/json',
          'token': token,
          'Content-Type': 'application/json'
        }
      })
    } catch (e: any) {
      await db.collection('errors').insertOne({ data: e?.response?.data, message: e.message, bookingId: booking.id })
    }

    await db.collection('invoices').insertOne({ bookingId: booking?.id, series: response.data.series, number: response.data.number })
    return Response.json({ success: true })
  } catch (e: any) {
    console.log(e?.response?.data || e.message)
    await db.collection('errors').insertOne({ data: e?.response?.data, message: e.message })
    return Response.json({ error: e.message || 'Eroare necunoscută' }, { status: 400 })
  }
}