export const generateInvoiceTemplate = ({ name }: { name: string}) => (
  `Bună ziua, ${name},
<br><br>
Vă transmitem atașată factura cu detaliile rezervării.
<br><br>
Vă mulțumim și vă dorim o zi excelentă!
`
)

// <br><br>
// Cu stimă,<br>
// ${companyName}