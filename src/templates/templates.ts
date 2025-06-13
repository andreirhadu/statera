export const generateInvoiceTemplate = ({ companyName }: { companyName: string}) => (
  `Bună ziua,
<br><br>
Vă transmitem atașată factura cu detaliile serviciilor/produselor furnizate.
<br><br>
Vă mulțumim și vă dorim o zi excelentă!
<br><br>
Cu stimă,<br>
${companyName}
`
)