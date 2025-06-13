type Props = { 
  nameSender?: string
  from?: string
  to: string 
  subject: string 
  text?: string 
  html?: string 
  attachments?: any  
}

export const sendMail = async ({ nameSender="RapidBill", from="noreply@rapidbill.ro", to, subject, text, html, attachments }: Props) => {
  const { TransactionalEmailsApi, SendSmtpEmail } = require('@getbrevo/brevo')

  var p = new Promise(async (resolve, reject) => {
    var apiInstance = new TransactionalEmailsApi()
    var apiKey = apiInstance.authentications['apiKey']
    apiKey.apiKey = process.env.BREVO_API_KEY
    
    var sendSmtpEmail = new SendSmtpEmail()

    sendSmtpEmail.subject = subject
    sendSmtpEmail.htmlContent = html || null
    sendSmtpEmail.textContent = text || null
    sendSmtpEmail.sender = { "name": nameSender, "email": from }
    sendSmtpEmail.to = [ { "email": to } ]
    sendSmtpEmail.attachment = attachments

    try {
      const response = await apiInstance.sendTransacEmail(sendSmtpEmail)
      resolve(response)
    } catch (e: any) {
      reject (e)
    }
  })

  return p
}